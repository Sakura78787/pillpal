import type { Config, Context } from '@netlify/functions';
import { z } from 'zod';
import { weeklyFactsV2Schema } from '../../src/features/ai-report/contracts.js';
import {
  QwenRequestTimeoutError,
  ReportValidationError,
  type ReportDiagnostic,
  callQwenWeeklyReport,
  getQwenFailureDiagnostic,
  isQwenUpstreamFailure,
  normalizeModelResult,
  sanitizeUsage,
  validateReport,
} from './generate-weekly-report.ts';
import { getWeeklyReportConfig, type WeeklyReportFunctionConfig } from './_shared/weeklyReportConfig.ts';
import { createWeeklyReportAdminClient, createWeeklyReportJobRepository, type WeeklyReportJobRepository } from './_shared/weeklyReportJobs.ts';
import { verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

const processRequestSchema = z.object({ jobId: z.string().uuid(), facts: weeklyFactsV2Schema });
type ProcessDeps = {
  getConfig: () => WeeklyReportFunctionConfig;
  verifyUser: (token: string) => Promise<any>;
  jobs: WeeklyReportJobRepository;
  callModel: typeof callQwenWeeklyReport;
  now: () => Date;
  logEvent?: (event: string, payload: Record<string, unknown>) => void;
};

const noContent = () => new Response(null, { status: 204 });
const tokenFrom = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
const safeLog = (deps: ProcessDeps, event: string, payload: Record<string, unknown>) =>
  (deps.logEvent || ((name, value) => console.log(name, JSON.stringify(value))))(event, payload);

export async function handleProcessWeeklyReportRequest(request: Request, deps: ProcessDeps) {
  const requestStartedAt = Date.now();
  if (request.method !== 'POST') return noContent();
  const config = deps.getConfig();
  if (!config.enabled || !config.apiKey) return noContent();
  const token = tokenFrom(request);
  if (!token) return noContent();
  const authStartedAt = Date.now();
  let user: any;
  try { user = await deps.verifyUser(token); } catch { return noContent(); }
  const authDurationMs = Date.now() - authStartedAt;
  if (!user?.id) return noContent();
  const parsed = processRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noContent();
  const claimStartedAt = Date.now();
  const claimed = await deps.jobs.claim(parsed.data.jobId, user.id, deps.now()).catch(() => null);
  const claimDurationMs = Date.now() - claimStartedAt;
  if (!claimed) return noContent();

  let modelDurationMs = 0;
  let validationDurationMs = 0;
  let persistenceDurationMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let modelCallCount = 0;

  const metrics = () => ({
    authDurationMs,
    claimDurationMs,
    modelDurationMs,
    validationDurationMs,
    persistenceDurationMs,
    totalDurationMs: Date.now() - requestStartedAt,
    inputTokens,
    outputTokens,
    modelCallCount,
  });

  const addUsage = (result: ReturnType<typeof normalizeModelResult>) => {
    const usage = sanitizeUsage(result.usage);
    inputTokens += usage?.inputTokens || 0;
    outputTokens += usage?.outputTokens || 0;
  };

  const persistFailure = async ({
    errorCode,
    diagnostic,
    stage,
    path,
  }: {
    errorCode: string;
    diagnostic: string;
    stage: string;
    path?: string;
  }) => {
    const persistenceStartedAt = Date.now();
    try {
      await deps.jobs.markFailed(claimed.id, user.id, {
        errorCode, diagnostic, inputTokens, outputTokens, modelDurationMs, now: deps.now(),
      });
      persistenceDurationMs += Date.now() - persistenceStartedAt;
      safeLog(deps, 'weekly_report_background_failed', {
        stage, code: diagnostic, ...(path ? { path } : {}), ...metrics(),
      });
    } catch {
      persistenceDurationMs += Date.now() - persistenceStartedAt;
      safeLog(deps, 'weekly_report_background_failed', {
        stage: 'persistence', code: 'job_persistence_failed', path: 'markFailed', ...metrics(),
      });
    }
  };

  const callModel = async (repair?: { originalJson: string; diagnostic: ReportDiagnostic; path?: string }) => {
    const modelStartedAt = Date.now();
    modelCallCount += 1;
    try {
      const result = await deps.callModel(
        { facts: parsed.data.facts, promptVersion: 'v2', ...(repair ? { repair } : {}) },
        { ...config, requestTimeoutMs: config.backgroundRequestTimeoutMs },
      );
      modelDurationMs += Date.now() - modelStartedAt;
      const normalized = normalizeModelResult(result);
      addUsage(normalized);
      return { result, normalized };
    } catch (error) {
      modelDurationMs += Date.now() - modelStartedAt;
      throw error;
    }
  };

  let firstCall;
  try {
    firstCall = await callModel();
  } catch (error) {
    const diagnostic = error instanceof QwenRequestTimeoutError ? 'qwen_request_timeout' : 'qwen_request_failed';
    await persistFailure({ errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic, stage: 'model' });
    return noContent();
  }

  if (isQwenUpstreamFailure(firstCall.result)) {
    const diagnostic = getQwenFailureDiagnostic(firstCall.result);
    await persistFailure({ errorCode: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE', diagnostic, stage: 'model' });
    return noContent();
  }

  const validate = (normalized: ReturnType<typeof normalizeModelResult>) => {
    const validationStartedAt = Date.now();
    try {
      if (normalized.parseError) throw new ReportValidationError('response_json_parse_failed');
      return validateReport(normalized.report, parsed.data.facts, 'v2', config.model);
    } finally {
      validationDurationMs += Date.now() - validationStartedAt;
    }
  };

  let report;
  try {
    report = validate(firstCall.normalized);
  } catch (error) {
    const firstValidationError = error instanceof ReportValidationError
      ? error
      : new ReportValidationError('schema_invalid', 'root');
    const originalJson = firstCall.normalized.rawContent
      || JSON.stringify(firstCall.normalized.report ?? {});
    let repairCall;
    try {
      repairCall = await callModel({
        originalJson,
        diagnostic: firstValidationError.diagnostic,
        ...(firstValidationError.path ? { path: firstValidationError.path } : {}),
      });
    } catch (repairError) {
      const diagnostic = repairError instanceof QwenRequestTimeoutError ? 'qwen_request_timeout' : 'qwen_request_failed';
      await persistFailure({ errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic, stage: 'model' });
      return noContent();
    }
    if (isQwenUpstreamFailure(repairCall.result)) {
      const diagnostic = getQwenFailureDiagnostic(repairCall.result);
      await persistFailure({ errorCode: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE', diagnostic, stage: 'model' });
      return noContent();
    }
    try {
      report = validate(repairCall.normalized);
    } catch (repairValidationError) {
      const finalError = repairValidationError instanceof ReportValidationError
        ? repairValidationError
        : new ReportValidationError('schema_invalid', 'root');
      await persistFailure({
        errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
        diagnostic: finalError.diagnostic,
        stage: 'validation',
        ...(finalError.path ? { path: finalError.path } : {}),
      });
      return noContent();
    }
  }

  const persistenceStartedAt = Date.now();
  try {
    await deps.jobs.complete(claimed.id, user.id, {
      report, inputTokens, outputTokens, modelDurationMs, now: deps.now(),
    });
    persistenceDurationMs += Date.now() - persistenceStartedAt;
    safeLog(deps, 'weekly_report_background_succeeded', {
      stage: 'completed', code: 'ok', ...metrics(),
    });
  } catch {
    persistenceDurationMs += Date.now() - persistenceStartedAt;
    await persistFailure({
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'job_persistence_failed',
      stage: 'persistence',
      path: 'complete',
    });
  }
  return noContent();
}

export default async (request: Request, _context: Context) => {
  const config = getWeeklyReportConfig();
  let jobs: WeeklyReportJobRepository;
  try {
    jobs = createWeeklyReportJobRepository(createWeeklyReportAdminClient(config.supabaseUrl, config.supabaseSecretKey));
  } catch {
    return noContent();
  }
  return handleProcessWeeklyReportRequest(request, {
    getConfig: () => config, verifyUser: verifySupabaseUser, jobs,
    callModel: callQwenWeeklyReport, now: () => new Date(),
  });
};

export const config: Config = {
  path: '/api/ai/weekly-report/process',
  method: 'POST',
  background: true,
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
