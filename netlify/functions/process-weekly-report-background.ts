import type { Config, Context } from '@netlify/functions';
import { z } from 'zod';
import { weeklyFactsV2Schema } from '../../src/features/ai-report/contracts.js';
import {
  QwenRequestTimeoutError,
  callQwenWeeklyReport,
  getQwenFailureDiagnostic,
  isRecoverableQwenError,
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
  if (request.method !== 'POST') return noContent();
  const config = deps.getConfig();
  if (!config.enabled || !config.apiKey) return noContent();
  const token = tokenFrom(request);
  if (!token) return noContent();
  let user: any;
  try { user = await deps.verifyUser(token); } catch { return noContent(); }
  if (!user?.id) return noContent();
  const parsed = processRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noContent();
  const claimed = await deps.jobs.claim(parsed.data.jobId, user.id, deps.now()).catch(() => null);
  if (!claimed) return noContent();

  const modelStartedAt = Date.now();
  let modelResult: unknown;
  try {
    modelResult = await deps.callModel(
      { facts: parsed.data.facts, promptVersion: 'v2' },
      { ...config, requestTimeoutMs: config.backgroundRequestTimeoutMs },
    );
  } catch (error) {
    const diagnostic = error instanceof QwenRequestTimeoutError ? 'qwen_request_timeout' : 'qwen_request_failed';
    await deps.jobs.markFailed(claimed.id, user.id, {
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic, now: deps.now(),
    });
    safeLog(deps, 'weekly_report_background_failed', { diagnostic, modelDurationMs: Date.now() - modelStartedAt });
    return noContent();
  }

  const modelDurationMs = Date.now() - modelStartedAt;
  if (isRecoverableQwenError(modelResult)) {
    const diagnostic = getQwenFailureDiagnostic(modelResult);
    await deps.jobs.markFailed(claimed.id, user.id, {
      errorCode: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE', diagnostic, now: deps.now(),
    });
    safeLog(deps, 'weekly_report_background_failed', { diagnostic, modelDurationMs });
    return noContent();
  }

  try {
    const normalized = normalizeModelResult(modelResult);
    const report = validateReport(normalized.report, parsed.data.facts, 'v2', config.model);
    const usage = sanitizeUsage(normalized.usage);
    await deps.jobs.complete(claimed.id, user.id, {
      report,
      inputTokens: usage?.inputTokens || 0,
      outputTokens: usage?.outputTokens || 0,
      modelDurationMs,
      now: deps.now(),
    });
    safeLog(deps, 'weekly_report_background_succeeded', {
      model: config.model, promptVersion: 'v2', modelDurationMs,
      inputTokens: usage?.inputTokens || 0, outputTokens: usage?.outputTokens || 0,
    });
  } catch {
    await deps.jobs.markFailed(claimed.id, user.id, {
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic: 'response_validation_failed', now: deps.now(),
    });
    safeLog(deps, 'weekly_report_background_failed', { diagnostic: 'response_validation_failed', modelDurationMs });
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
