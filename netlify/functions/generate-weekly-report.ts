import type { Config, Context } from '@netlify/functions';
import {
  actionCodeSchema,
  weeklyFactsV2Schema,
  weeklyReportRequestSchema,
  weeklyReportV1Schema,
  weeklyReportV2Schema,
} from '../../src/features/ai-report/contracts.js';
import { getWeeklyReportConfig, type WeeklyReportFunctionConfig } from './_shared/weeklyReportConfig.ts';
import { FIXED_WEEKLY_REPORT_DISCLAIMER, buildWeeklyReportMessages } from './_shared/weeklyReportPrompts.ts';
import { SupabaseAuthVerificationError, verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

type PromptVersion = 'v0' | 'v1' | 'v2';
type HandlerDeps = {
  getConfig: () => WeeklyReportFunctionConfig;
  verifyUser: (token: string) => Promise<unknown>;
  callModel: (input: { facts: unknown; promptVersion: PromptVersion }, config: WeeklyReportFunctionConfig) => Promise<unknown>;
  logEvent?: (event: string, payload: Record<string, unknown>) => void;
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const aiError = (code: string, error: string, status: number, diagnostic?: string) =>
  json(diagnostic ? { error, code, diagnostic } : { error, code }, status);
const extractBearerToken = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
const isRecoverableQwenError = (value: unknown) => /AllocationQuota\.FreeTierOnly|quota|rate.?limit|429/i.test(JSON.stringify(value));

const getQwenFailureDiagnostic = (value: unknown) => {
  const serialized = JSON.stringify(value);
  if (/AllocationQuota\.FreeTierOnly/i.test(serialized)) return 'qwen_free_tier_quota';
  if (/Throttling\.AllocationQuota|insufficient_quota|quota/i.test(serialized)) return 'qwen_quota_exhausted';
  if (/Throttling\.BurstRate/i.test(serialized)) return 'qwen_burst_rate_limited';
  if (/rate.?limit|429/i.test(serialized)) return 'qwen_rate_limited';
  return 'qwen_model_unavailable';
};

const logWeeklyReportEvent = (deps: HandlerDeps, event: string, payload: Record<string, unknown>) => {
  (deps.logEvent || ((name, value) => console.log(name, JSON.stringify(value))))(event, payload);
};

const normalizeModelResult = (value: unknown) => value && typeof value === 'object' && 'report' in value
  ? value as { report: unknown; usage?: unknown }
  : { report: value, usage: undefined };

const sanitizeUsage = (usage: unknown) => {
  if (!usage || typeof usage !== 'object') return undefined;
  const value = usage as Record<string, unknown>;
  const inputTokens = Number(value.inputTokens || value.prompt_tokens || 0);
  const outputTokens = Number(value.outputTokens || value.completion_tokens || 0);
  return { inputTokens, outputTokens, totalTokens: Number(value.totalTokens || value.total_tokens || inputTokens + outputTokens) };
};

const evidenceIdsFromV2 = (report: any) => [
  ...(report.adherence?.evidence_ids || []),
  ...(report.insights || []).flatMap((item: any) => item.evidence_ids || []),
  ...(report.health_trends || []).flatMap((item: any) => item.evidence_ids || []),
  ...(report.actions || []).flatMap((item: any) => item.evidence_ids || []),
];

const userTextFromV2 = (report: any) => [
  report.summary, report.adherence?.headline, report.adherence?.interpretation,
  ...(report.insights || []).flatMap((item: any) => [item.title, item.detail]),
  ...(report.health_trends || []).map((item: any) => item.summary),
  ...(report.actions || []).flatMap((item: any) => [item.text, item.reason]),
  ...(report.data_gaps || []).map((item: any) => item.text),
].filter(Boolean).join('\n');

const validateReport = (report: unknown, facts: any, promptVersion: PromptVersion, model: string) => {
  if (promptVersion !== 'v2') {
    const normalized = { ...(report as object), disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER, meta: { promptVersion, model } };
    const parsed = weeklyReportV1Schema.parse(normalized);
    const validIds = new Set(Object.keys(facts.evidence || {}));
    parsed.highlights.flatMap((item) => item.evidence_ids).forEach((id) => { if (!validIds.has(id)) throw new Error('invalid evidence'); });
    return parsed;
  }

  const v2Facts = weeklyFactsV2Schema.parse(facts);
  const normalized = { ...(report as object), disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER, meta: { promptVersion: 'v2', model } };
  const parsed = weeklyReportV2Schema.parse(normalized);
  const validIds = new Set(Object.keys(v2Facts.evidence));
  evidenceIdsFromV2(parsed).forEach((id) => { if (!validIds.has(id)) throw new Error('invalid evidence'); });
  const validRefs = new Set(v2Facts.medicationSummaries.map((item) => item.ref));
  [...parsed.insights, ...parsed.actions].flatMap((item) => item.related_medication_refs).forEach((ref) => { if (!validRefs.has(ref)) throw new Error('invalid medication ref'); });
  parsed.actions.forEach((item) => actionCodeSchema.parse(item.action_code));
  const validGapCodes = new Set(v2Facts.dataGapCodes);
  parsed.data_gaps.forEach((item) => { if (!validGapCodes.has(item.code)) throw new Error('invalid data gap'); });
  if (/\b[a-z]+(?:_[a-z0-9]+)+\b/.test(userTextFromV2(parsed))) throw new Error('internal code leakage');
  return parsed;
};

export async function callQwenWeeklyReport(input: { facts: unknown; promptVersion: PromptVersion }, config: WeeklyReportFunctionConfig) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: buildWeeklyReportMessages({ facts: input.facts, promptVersion: input.promptVersion, model: config.model }),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      extra_body: { enable_thinking: false },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return payload;
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return payload;
  return { report: JSON.parse(content), usage: sanitizeUsage(payload?.usage) };
}

export async function handleWeeklyReportRequest(request: Request, deps: HandlerDeps) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const config = deps.getConfig();
  if (!config.enabled || !config.apiKey) {
    logWeeklyReportEvent(deps, 'weekly_report_config_unavailable', { reason: !config.enabled ? 'disabled' : 'missing_api_key', model: config.model });
    return aiError('AI_WEEKLY_REPORT_NOT_CONFIGURED', 'AI weekly report is temporarily unavailable', 503);
  }
  const token = extractBearerToken(request);
  if (!token) {
    logWeeklyReportEvent(deps, 'weekly_report_auth_failure', { reason: 'missing_token' });
    return aiError('AI_WEEKLY_REPORT_AUTH_REQUIRED', 'Authentication required', 401);
  }
  try { await deps.verifyUser(token); }
  catch (error) {
    if (error instanceof SupabaseAuthVerificationError && error.reason !== 'invalid_token') {
      logWeeklyReportEvent(deps, 'weekly_report_auth_failure', { reason: error.reason });
      return aiError('AI_WEEKLY_REPORT_AUTH_SERVICE_UNAVAILABLE', 'Authentication service is temporarily unavailable', 503);
    }
    logWeeklyReportEvent(deps, 'weekly_report_auth_failure', { reason: 'invalid_token' });
    return aiError('AI_WEEKLY_REPORT_AUTH_REQUIRED', 'Authentication required', 401);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON payload' }, 400); }
  const parsedRequest = weeklyReportRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    logWeeklyReportEvent(deps, 'weekly_report_input_failure', { reason: 'invalid_facts' });
    return aiError('AI_WEEKLY_REPORT_INVALID_INPUT', 'Invalid weekly report facts', 400);
  }
  const promptVersion: PromptVersion = config.evalMode && parsedRequest.data.promptVersion
    ? parsedRequest.data.promptVersion
    : (config.promptVersion || 'v1');
  if (promptVersion === 'v2' && !weeklyFactsV2Schema.safeParse(parsedRequest.data.facts).success) {
    return aiError('AI_WEEKLY_REPORT_INVALID_INPUT', 'V2 weekly report facts required', 400);
  }
  const startedAt = Date.now();
  let modelResult: unknown;
  try {
    modelResult = await deps.callModel({ facts: parsedRequest.data.facts, promptVersion }, config);
  } catch {
    const diagnostic = 'qwen_request_failed';
    logWeeklyReportEvent(deps, 'weekly_report_model_failure', { model: config.model, promptVersion, diagnostic, durationMs: Date.now() - startedAt });
    return aiError('AI_WEEKLY_REPORT_GENERATION_FAILED', 'AI weekly report generation failed', 502, diagnostic);
  }

  if (isRecoverableQwenError(modelResult)) {
    const diagnostic = getQwenFailureDiagnostic(modelResult);
    logWeeklyReportEvent(deps, 'weekly_report_model_unavailable', { model: config.model, promptVersion, diagnostic, durationMs: Date.now() - startedAt });
    return aiError('AI_WEEKLY_REPORT_MODEL_UNAVAILABLE', 'AI weekly report is temporarily unavailable', 503, diagnostic);
  }

  try {
    const normalized = normalizeModelResult(modelResult);
    const report = validateReport(normalized.report, parsedRequest.data.facts, promptVersion, config.model);
    const usage = sanitizeUsage(normalized.usage);
    logWeeklyReportEvent(deps, 'weekly_report_model_success', { model: config.model, promptVersion, durationMs: Date.now() - startedAt, inputTokens: usage?.inputTokens || 0, outputTokens: usage?.outputTokens || 0, totalTokens: usage?.totalTokens || 0 });
    return json(usage ? { report, usage } : { report });
  } catch {
    const diagnostic = 'response_validation_failed';
    logWeeklyReportEvent(deps, 'weekly_report_model_failure', { model: config.model, promptVersion, diagnostic, durationMs: Date.now() - startedAt });
    return aiError('AI_WEEKLY_REPORT_GENERATION_FAILED', 'AI weekly report generation failed', 502, diagnostic);
  }
}

export default async (request: Request, _context: Context) => handleWeeklyReportRequest(request, { getConfig: getWeeklyReportConfig, verifyUser: verifySupabaseUser, callModel: callQwenWeeklyReport });

export const config: Config = {
  path: '/api/ai/weekly-report',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
