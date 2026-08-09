import type { Config, Context } from '@netlify/functions';
import { weeklyReportRequestSchema, weeklyReportSchema } from '../../src/features/ai-report/contracts.js';
import { getWeeklyReportConfig, type WeeklyReportFunctionConfig } from './_shared/weeklyReportConfig.ts';
import {
  FIXED_WEEKLY_REPORT_DISCLAIMER,
  buildWeeklyReportMessages,
} from './_shared/weeklyReportPrompts.ts';
import {
  SupabaseAuthVerificationError,
  verifySupabaseUser,
} from './_shared/verifySupabaseUser.ts';

type PromptVersion = 'v0' | 'v1';

type HandlerDeps = {
  getConfig: () => WeeklyReportFunctionConfig;
  verifyUser: (accessToken: string) => Promise<unknown>;
  callModel: (input: { facts: unknown; promptVersion: PromptVersion }, config: WeeklyReportFunctionConfig) => Promise<unknown>;
  logEvent?: (event: string, payload: Record<string, unknown>) => void;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const aiError = (code: string, error: string, status: number) => json({ error, code }, status);

const extractBearerToken = (request: Request) => {
  const value = request.headers.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
};

const isRecoverableQwenError = (value: unknown) => {
  const text = JSON.stringify(value);
  return /AllocationQuota\.FreeTierOnly|quota|rate.?limit|429/i.test(text);
};

const validateEvidenceIds = (report: unknown, facts: Record<string, unknown>) => {
  const parsed = weeklyReportSchema.parse(report);
  const validIds = new Set(Object.keys(facts.evidence as Record<string, unknown>));
  for (const highlight of parsed.highlights) {
    for (const evidenceId of highlight.evidence_ids) {
      if (!validIds.has(evidenceId)) {
        throw new Error(`Invalid evidence id: ${evidenceId}`);
      }
    }
  }
  return {
    ...parsed,
    disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER,
  };
};

const normalizeModelResult = (modelResult: unknown) => {
  if (
    modelResult &&
    typeof modelResult === 'object' &&
    'report' in modelResult &&
    'usage' in modelResult
  ) {
    return modelResult as { report: unknown; usage?: unknown };
  }
  return { report: modelResult, usage: undefined };
};

const sanitizeUsage = (usage: unknown) => {
  if (!usage || typeof usage !== 'object') return undefined;
  const value = usage as Record<string, unknown>;
  const inputTokens = Number(value.inputTokens || value.prompt_tokens || 0);
  const outputTokens = Number(value.outputTokens || value.completion_tokens || 0);
  const totalTokens = Number(value.totalTokens || value.total_tokens || inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
};

const logWeeklyReportEvent = (
  deps: HandlerDeps,
  event: string,
  payload: Record<string, unknown>
) => {
  const logger = deps.logEvent || ((name, value) => console.log(name, JSON.stringify(value)));
  logger(event, payload);
};

export async function callQwenWeeklyReport(
  input: { facts: unknown; promptVersion: PromptVersion },
  config: WeeklyReportFunctionConfig
) {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildWeeklyReportMessages({
        facts: input.facts as never,
        promptVersion: input.promptVersion,
        model: config.model,
      }),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      extra_body: { enable_thinking: false },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return payload;

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return payload;
  return {
    report: JSON.parse(content),
    usage: sanitizeUsage(payload?.usage),
  };
}

export async function handleWeeklyReportRequest(request: Request, deps: HandlerDeps) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const config = deps.getConfig();
  if (!config.enabled) {
    logWeeklyReportEvent(deps, 'weekly_report_config_unavailable', {
      reason: 'disabled',
      model: config.model,
    });
    return aiError(
      'AI_WEEKLY_REPORT_NOT_CONFIGURED',
      'AI weekly report is temporarily unavailable',
      503
    );
  }
  if (!config.apiKey) {
    logWeeklyReportEvent(deps, 'weekly_report_config_unavailable', {
      reason: 'missing_api_key',
      model: config.model,
    });
    return aiError(
      'AI_WEEKLY_REPORT_NOT_CONFIGURED',
      'AI weekly report is temporarily unavailable',
      503
    );
  }

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    logWeeklyReportEvent(deps, 'weekly_report_auth_failure', {
      reason: 'missing_token',
    });
    return aiError('AI_WEEKLY_REPORT_AUTH_REQUIRED', 'Authentication required', 401);
  }

  try {
    await deps.verifyUser(accessToken);
  } catch (error) {
    if (
      error instanceof SupabaseAuthVerificationError &&
      error.reason !== 'invalid_token'
    ) {
      logWeeklyReportEvent(deps, 'weekly_report_auth_failure', {
        reason: error.reason,
      });
      return aiError(
        'AI_WEEKLY_REPORT_AUTH_SERVICE_UNAVAILABLE',
        'Authentication service is temporarily unavailable',
        503
      );
    }
    logWeeklyReportEvent(deps, 'weekly_report_auth_failure', {
      reason: 'invalid_token',
    });
    return aiError('AI_WEEKLY_REPORT_AUTH_REQUIRED', 'Authentication required', 401);
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const parsedRequest = weeklyReportRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    logWeeklyReportEvent(deps, 'weekly_report_input_failure', {
      reason: 'invalid_facts',
    });
    return aiError('AI_WEEKLY_REPORT_INVALID_INPUT', 'Invalid weekly report facts', 400);
  }

  const promptVersion = parsedRequest.data.promptVersion || 'v1';
  if (promptVersion === 'v0' && !config.evalMode) {
    return json({ error: 'Prompt V0 is only available in evaluation mode' }, 403);
  }

  try {
    const startedAt = Date.now();
    const modelResult = await deps.callModel(
      { facts: parsedRequest.data.facts, promptVersion },
      config
    );
    if (isRecoverableQwenError(modelResult)) {
      logWeeklyReportEvent(deps, 'weekly_report_model_unavailable', {
        model: config.model,
        promptVersion,
      });
      return aiError(
        'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE',
        'AI weekly report is temporarily unavailable',
        503
      );
    }
    const normalized = normalizeModelResult(modelResult);
    const report = validateEvidenceIds(normalized.report, parsedRequest.data.facts);
    const usage = sanitizeUsage(normalized.usage);
    logWeeklyReportEvent(deps, 'weekly_report_model_success', {
      model: config.model,
      promptVersion,
      durationMs: Date.now() - startedAt,
      inputTokens: usage?.inputTokens || 0,
      outputTokens: usage?.outputTokens || 0,
      totalTokens: usage?.totalTokens || 0,
    });
    return json(usage ? { report, usage } : { report });
  } catch {
    logWeeklyReportEvent(deps, 'weekly_report_model_failure', {
      model: config.model,
      promptVersion,
    });
    return aiError(
      'AI_WEEKLY_REPORT_GENERATION_FAILED',
      'AI weekly report generation failed',
      502
    );
  }
}

export default async (request: Request, _context: Context) => {
  return handleWeeklyReportRequest(request, {
    getConfig: getWeeklyReportConfig,
    verifyUser: verifySupabaseUser,
    callModel: callQwenWeeklyReport,
  });
};

export const config: Config = {
  path: '/api/ai/weekly-report',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
