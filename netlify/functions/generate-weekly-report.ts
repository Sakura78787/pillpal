import type { Config, Context } from '@netlify/functions';
import { ZodError } from 'zod';
import {
  actionCodeSchema,
  weeklyFactsV2Schema,
  weeklyReportRequestSchema,
  weeklyReportV1Schema,
  weeklyReportV2Schema,
} from '../../src/features/ai-report/contracts.js';
import { getWeeklyReportConfig, type WeeklyReportFunctionConfig } from './_shared/weeklyReportConfig.ts';
import { FIXED_WEEKLY_REPORT_DISCLAIMER, buildWeeklyReportMessages, buildWeeklyReportRepairMessages } from './_shared/weeklyReportPrompts.ts';
import { SupabaseAuthVerificationError, verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

type PromptVersion = 'v0' | 'v1' | 'v2';
export type ReportDiagnostic =
  | 'response_json_parse_failed'
  | 'schema_invalid'
  | 'invalid_evidence_id'
  | 'invalid_medication_ref'
  | 'invalid_action_code'
  | 'invalid_data_gap_code'
  | 'internal_code_leakage';
type RepairRequest = { originalJson: string; diagnostic: ReportDiagnostic; path?: string };
type HandlerDeps = {
  getConfig: () => WeeklyReportFunctionConfig;
  verifyUser: (token: string) => Promise<unknown>;
  callModel: (input: { facts: unknown; promptVersion: PromptVersion; repair?: RepairRequest }, config: WeeklyReportFunctionConfig) => Promise<unknown>;
  logEvent?: (event: string, payload: Record<string, unknown>) => void;
};

export class QwenRequestTimeoutError extends Error {
  constructor() {
    super('Qwen request timed out');
    this.name = 'QwenRequestTimeoutError';
  }
}

export class ReportValidationError extends Error {
  diagnostic: ReportDiagnostic;
  path?: string;

  constructor(diagnostic: ReportDiagnostic, path?: string) {
    super(diagnostic);
    this.name = 'ReportValidationError';
    this.diagnostic = diagnostic;
    if (path) this.path = path;
  }
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const aiError = (code: string, error: string, status: number, diagnostic?: string) =>
  json(diagnostic ? { error, code, diagnostic } : { error, code }, status);
const extractBearerToken = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
export const isRecoverableQwenError = (value: unknown) => /AllocationQuota\.FreeTierOnly|quota|rate.?limit|429/i.test(JSON.stringify(value));

type QwenUpstreamHttpFailure = {
  upstreamHttpError: true;
  status: number;
  diagnostic: string;
};

const isMarkedQwenHttpFailure = (value: unknown): value is QwenUpstreamHttpFailure => Boolean(
  value
  && typeof value === 'object'
  && (value as Record<string, unknown>).upstreamHttpError === true
  && Number.isInteger((value as Record<string, unknown>).status),
);

export const isQwenUpstreamFailure = (value: unknown) => isMarkedQwenHttpFailure(value) || isRecoverableQwenError(value);

export const getQwenFailureDiagnostic = (value: unknown) => {
  if (isMarkedQwenHttpFailure(value)) {
    return [
      'qwen_free_tier_quota',
      'qwen_quota_exhausted',
      'qwen_burst_rate_limited',
      'qwen_rate_limited',
      'qwen_http_error',
    ].includes(value.diagnostic) ? value.diagnostic : 'qwen_http_error';
  }
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

export const normalizeModelResult = (value: unknown) => value && typeof value === 'object' && 'report' in value
  ? value as { report: unknown; usage?: unknown; rawContent?: string; parseError?: boolean }
  : { report: value, usage: undefined, rawContent: undefined, parseError: false };

export const sanitizeUsage = (usage: unknown) => {
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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsInternalToken = (text: string, token: string) => new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(token)}([^A-Za-z0-9_]|$)`).test(text);

export const validateReport = (report: unknown, facts: any, promptVersion: PromptVersion, model: string) => {
  if (promptVersion !== 'v2') {
    const normalized = { ...(report as object), disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER, meta: { promptVersion, model } };
    let parsed;
    try { parsed = weeklyReportV1Schema.parse(normalized); }
    catch (error) {
      const path = error instanceof ZodError ? error.issues[0]?.path.join('.') || 'root' : 'root';
      throw new ReportValidationError('schema_invalid', path);
    }
    const validIds = new Set(Object.keys(facts.evidence || {}));
    parsed.highlights.flatMap((item) => item.evidence_ids).forEach((id) => { if (!validIds.has(id)) throw new ReportValidationError('invalid_evidence_id'); });
    return parsed;
  }

  let v2Facts;
  try { v2Facts = weeklyFactsV2Schema.parse(facts); }
  catch (error) {
    const path = error instanceof ZodError ? error.issues[0]?.path.join('.') || 'root' : 'root';
    throw new ReportValidationError('schema_invalid', path);
  }
  const raw = report && typeof report === 'object' ? report as any : {};
  const validIds = new Set(Object.keys(v2Facts.evidence));
  const rawEvidenceIds = [
    ...(Array.isArray(raw.adherence?.evidence_ids) ? raw.adherence.evidence_ids : []),
    ...(Array.isArray(raw.insights) ? raw.insights.flatMap((item: any) => Array.isArray(item?.evidence_ids) ? item.evidence_ids : []) : []),
    ...(Array.isArray(raw.health_trends) ? raw.health_trends.flatMap((item: any) => Array.isArray(item?.evidence_ids) ? item.evidence_ids : []) : []),
    ...(Array.isArray(raw.actions) ? raw.actions.flatMap((item: any) => Array.isArray(item?.evidence_ids) ? item.evidence_ids : []) : []),
  ];
  if (rawEvidenceIds.some((id) => typeof id === 'string' && !validIds.has(id))) throw new ReportValidationError('invalid_evidence_id');
  const validRefs = new Set(v2Facts.medicationSummaries.map((item) => item.ref));
  const rawRefs = [
    ...(Array.isArray(raw.insights) ? raw.insights.flatMap((item: any) => Array.isArray(item?.related_medication_refs) ? item.related_medication_refs : []) : []),
    ...(Array.isArray(raw.actions) ? raw.actions.flatMap((item: any) => Array.isArray(item?.related_medication_refs) ? item.related_medication_refs : []) : []),
  ];
  if (rawRefs.some((ref) => typeof ref === 'string' && !validRefs.has(ref))) throw new ReportValidationError('invalid_medication_ref');
  if (Array.isArray(raw.actions) && raw.actions.some((item: any) => typeof item?.action_code === 'string' && !actionCodeSchema.safeParse(item.action_code).success)) {
    throw new ReportValidationError('invalid_action_code');
  }
  const validGapCodes = new Set(v2Facts.dataGapCodes);
  if (Array.isArray(raw.data_gaps) && raw.data_gaps.some((item: any) => typeof item?.code === 'string' && !validGapCodes.has(item.code))) {
    throw new ReportValidationError('invalid_data_gap_code');
  }
  const normalized = { ...(report as object), disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER, meta: { promptVersion: 'v2', model } };
  let parsed;
  try { parsed = weeklyReportV2Schema.parse(normalized); }
  catch (error) {
    const path = error instanceof ZodError ? error.issues[0]?.path.join('.') || 'root' : 'root';
    throw new ReportValidationError('schema_invalid', path);
  }
  evidenceIdsFromV2(parsed).forEach((id) => { if (!validIds.has(id)) throw new ReportValidationError('invalid_evidence_id'); });
  [...parsed.insights, ...parsed.actions].flatMap((item) => item.related_medication_refs).forEach((ref) => { if (!validRefs.has(ref)) throw new ReportValidationError('invalid_medication_ref'); });
  parsed.actions.forEach((item) => { if (!actionCodeSchema.safeParse(item.action_code).success) throw new ReportValidationError('invalid_action_code'); });
  parsed.data_gaps.forEach((item) => { if (!validGapCodes.has(item.code)) throw new ReportValidationError('invalid_data_gap_code'); });
  const userText = userTextFromV2(parsed);
  const internalTokens = new Set([
    ...Object.keys(v2Facts.evidence),
    ...v2Facts.medicationSummaries.map((item) => item.ref),
    ...v2Facts.dataGapCodes,
    ...actionCodeSchema.options,
  ]);
  if ([...internalTokens].some((token) => containsInternalToken(userText, token)) || /\b[a-z]+(?:_[a-z0-9]+)+\b/.test(userText)) {
    throw new ReportValidationError('internal_code_leakage');
  }
  return parsed;
};

export async function callQwenWeeklyReport(
  input: { facts: unknown; promptVersion: PromptVersion; repair?: RepairRequest },
  config: WeeklyReportFunctionConfig,
  fetchImpl: typeof fetch = fetch
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.requestTimeoutMs || 45000);

  try {
    const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: input.repair
          ? buildWeeklyReportRepairMessages({ facts: input.facts, ...input.repair })
          : buildWeeklyReportMessages({ facts: input.facts, promptVersion: input.promptVersion, model: config.model }),
        temperature: 0.2,
        max_tokens: config.maxOutputTokens || 1400,
        response_format: { type: 'json_object' },
        extra_body: { enable_thinking: false },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        upstreamHttpError: true,
        status: response.status,
        diagnostic: isRecoverableQwenError(payload) ? getQwenFailureDiagnostic(payload) : 'qwen_http_error',
      } satisfies QwenUpstreamHttpFailure;
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return payload;
    const usage = sanitizeUsage(payload?.usage);
    try {
      return { report: JSON.parse(content), rawContent: content, usage };
    } catch {
      return { report: undefined, rawContent: content, parseError: true, usage };
    }
  } catch (error) {
    if (timedOut || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new QwenRequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleWeeklyReportRequest(request: Request, deps: HandlerDeps) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const requestStartedAt = Date.now();
  const config = deps.getConfig();
  if (!config.enabled || !config.apiKey) {
    logWeeklyReportEvent(deps, 'weekly_report_config_unavailable', { stage: 'configuration', code: !config.enabled ? 'disabled' : 'missing_api_key' });
    return aiError('AI_WEEKLY_REPORT_NOT_CONFIGURED', 'AI weekly report is temporarily unavailable', 503);
  }
  const token = extractBearerToken(request);
  if (!token) {
    logWeeklyReportEvent(deps, 'weekly_report_auth_failure', { stage: 'auth', code: 'missing_token' });
    return aiError('AI_WEEKLY_REPORT_AUTH_REQUIRED', 'Authentication required', 401);
  }
  const authStartedAt = Date.now();
  let authDurationMs = 0;
  try {
    await deps.verifyUser(token);
    authDurationMs = Date.now() - authStartedAt;
  }
  catch (error) {
    authDurationMs = Date.now() - authStartedAt;
    if (error instanceof SupabaseAuthVerificationError && error.reason !== 'invalid_token') {
      logWeeklyReportEvent(deps, 'weekly_report_auth_failure', { stage: 'auth', code: error.reason });
      return aiError('AI_WEEKLY_REPORT_AUTH_SERVICE_UNAVAILABLE', 'Authentication service is temporarily unavailable', 503);
    }
    logWeeklyReportEvent(deps, 'weekly_report_auth_failure', { stage: 'auth', code: 'invalid_token' });
    return aiError('AI_WEEKLY_REPORT_AUTH_REQUIRED', 'Authentication required', 401);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON payload' }, 400); }
  const parsedRequest = weeklyReportRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    logWeeklyReportEvent(deps, 'weekly_report_input_failure', { stage: 'input', code: 'invalid_facts' });
    return aiError('AI_WEEKLY_REPORT_INVALID_INPUT', 'Invalid weekly report facts', 400);
  }
  const promptVersion: PromptVersion = config.evalMode && parsedRequest.data.promptVersion
    ? parsedRequest.data.promptVersion
    : (config.promptVersion || 'v1');
  if (promptVersion === 'v2' && !weeklyFactsV2Schema.safeParse(parsedRequest.data.facts).success) {
    logWeeklyReportEvent(deps, 'weekly_report_input_failure', { stage: 'input', code: 'invalid_v2_facts' });
    return aiError('AI_WEEKLY_REPORT_INVALID_INPUT', 'V2 weekly report facts required', 400);
  }
  let modelDurationMs = 0;
  let validationDurationMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let modelCallCount = 0;

  const metrics = () => ({
    modelCallCount, authDurationMs, modelDurationMs, validationDurationMs,
    totalDurationMs: Date.now() - requestStartedAt, inputTokens, outputTokens,
  });
  const callOnce = async (repair?: RepairRequest) => {
    const startedAt = Date.now();
    modelCallCount += 1;
    try {
      const result = await deps.callModel({ facts: parsedRequest.data.facts, promptVersion, ...(repair ? { repair } : {}) }, config);
      modelDurationMs += Date.now() - startedAt;
      const normalized = normalizeModelResult(result);
      const usage = sanitizeUsage(normalized.usage);
      inputTokens += usage?.inputTokens || 0;
      outputTokens += usage?.outputTokens || 0;
      return { result, normalized };
    } catch (error) {
      modelDurationMs += Date.now() - startedAt;
      throw error;
    }
  };
  const logFailure = (event: string, stage: string, code: string, path?: string) => {
    logWeeklyReportEvent(deps, event, { stage, code, ...(path ? { path } : {}), ...metrics() });
  };
  const modelErrorResponse = (error: unknown) => {
    const code = error instanceof QwenRequestTimeoutError ? 'qwen_request_timeout' : 'qwen_request_failed';
    logFailure('weekly_report_model_failure', 'model', code);
    return aiError('AI_WEEKLY_REPORT_GENERATION_FAILED', 'AI weekly report generation failed', 502, code);
  };
  const unavailableResponse = (result: unknown) => {
    const code = getQwenFailureDiagnostic(result);
    logFailure('weekly_report_model_unavailable', 'model', code);
    return aiError('AI_WEEKLY_REPORT_MODEL_UNAVAILABLE', 'AI weekly report is temporarily unavailable', 503, code);
  };
  const validate = (normalized: ReturnType<typeof normalizeModelResult>) => {
    const startedAt = Date.now();
    try {
      if (normalized.parseError) throw new ReportValidationError('response_json_parse_failed');
      return validateReport(normalized.report, parsedRequest.data.facts, promptVersion, config.model);
    } finally {
      validationDurationMs += Date.now() - startedAt;
    }
  };

  let firstCall;
  try { firstCall = await callOnce(); }
  catch (error) { return modelErrorResponse(error); }
  if (isQwenUpstreamFailure(firstCall.result)) return unavailableResponse(firstCall.result);

  let report;
  try {
    report = validate(firstCall.normalized);
  } catch (error) {
    const firstError = error instanceof ReportValidationError ? error : new ReportValidationError('schema_invalid', 'root');
    if (promptVersion !== 'v2') {
      logFailure('weekly_report_model_failure', 'validation', firstError.diagnostic, firstError.path);
      return aiError('AI_WEEKLY_REPORT_GENERATION_FAILED', 'AI weekly report generation failed', 502, firstError.diagnostic);
    }
    const repair: RepairRequest = {
      originalJson: firstCall.normalized.rawContent || JSON.stringify(firstCall.normalized.report ?? {}),
      diagnostic: firstError.diagnostic,
      ...(firstError.path ? { path: firstError.path } : {}),
    };
    let repairCall;
    try { repairCall = await callOnce(repair); }
    catch (repairError) { return modelErrorResponse(repairError); }
    if (isQwenUpstreamFailure(repairCall.result)) return unavailableResponse(repairCall.result);
    try {
      report = validate(repairCall.normalized);
    } catch (repairValidationError) {
      const finalError = repairValidationError instanceof ReportValidationError
        ? repairValidationError
        : new ReportValidationError('schema_invalid', 'root');
      logFailure('weekly_report_model_failure', 'validation', finalError.diagnostic, finalError.path);
      return aiError('AI_WEEKLY_REPORT_GENERATION_FAILED', 'AI weekly report generation failed', 502, finalError.diagnostic);
    }
  }

  const usage = { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  logWeeklyReportEvent(deps, 'weekly_report_model_success', { stage: 'completed', code: 'ok', ...metrics(), totalTokens: usage.totalTokens });
  return json((inputTokens || outputTokens) ? { report, usage } : { report });
}

export default async (request: Request, _context: Context) => handleWeeklyReportRequest(request, { getConfig: getWeeklyReportConfig, verifyUser: verifySupabaseUser, callModel: callQwenWeeklyReport });

export const config: Config = {
  path: '/api/ai/weekly-report',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
