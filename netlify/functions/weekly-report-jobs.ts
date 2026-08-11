import type { Config, Context } from '@netlify/functions';
import { z } from 'zod';
import { weeklyFactsV2Schema, weeklyReportV2Schema } from '../../src/features/ai-report/contracts.js';
import { getWeeklyReportConfig, type WeeklyReportFunctionConfig } from './_shared/weeklyReportConfig.ts';
import { createWeeklyReportAdminClient, createWeeklyReportJobRepository, type WeeklyReportJob, type WeeklyReportJobRepository } from './_shared/weeklyReportJobs.ts';
import { SupabaseAuthVerificationError, verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

type JobsDeps = {
  getConfig: () => WeeklyReportFunctionConfig;
  verifyUser: (token: string) => Promise<any>;
  jobs: WeeklyReportJobRepository;
  triggerBackground: (input: { requestUrl: string; jobId: string; facts: unknown; authorization: string }) => Promise<Response>;
  now: () => Date;
};

const createRequestSchema = z.object({ facts: weeklyFactsV2Schema });
const jobIdSchema = z.string().uuid();
const json = (value: unknown, status = 200) => Response.json(value, { status });
const tokenFrom = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
const authorizationFrom = (request: Request) => request.headers.get('authorization') || '';

const publicJob = (job: WeeklyReportJob) => ({
  id: job.id,
  status: job.status,
  ...(job.status === 'succeeded' ? { report: weeklyReportV2Schema.parse(job.report) } : {}),
  ...(job.status === 'failed' ? { errorCode: job.error_code, diagnostic: job.diagnostic } : {}),
  createdAt: job.created_at,
  startedAt: job.started_at,
  completedAt: job.completed_at,
  expiresAt: job.expires_at,
});

const authenticate = async (request: Request, deps: JobsDeps) => {
  const token = tokenFrom(request);
  if (!token) return { user: null, response: json({ code: 'AI_WEEKLY_REPORT_AUTH_REQUIRED' }, 401) };
  try {
    const user = await deps.verifyUser(token);
    return user?.id
      ? { user, response: null }
      : { user: null, response: json({ code: 'AI_WEEKLY_REPORT_AUTH_UNAVAILABLE' }, 503) };
  } catch (error) {
    const invalidToken = error instanceof SupabaseAuthVerificationError && error.reason === 'invalid_token';
    return invalidToken
      ? { user: null, response: json({ code: 'AI_WEEKLY_REPORT_AUTH_REQUIRED' }, 401) }
      : { user: null, response: json({ code: 'AI_WEEKLY_REPORT_AUTH_UNAVAILABLE' }, 503) };
  }
};

async function createJob(request: Request, deps: JobsDeps) {
  const config = deps.getConfig();
  if (!config.enabled || !config.apiKey || !config.supabaseSecretKey) {
    return json({ code: 'AI_WEEKLY_REPORT_NOT_CONFIGURED' }, 503);
  }
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const user = auth.user;
  const body = await request.json().catch(() => null);
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) return json({ code: 'AI_WEEKLY_REPORT_INVALID_INPUT' }, 400);

  const now = deps.now();
  await deps.jobs.deleteExpired(now);
  let job = await deps.jobs.findActive(user.id);
  if (!job) {
    try {
      job = await deps.jobs.create({ userId: user.id, promptVersion: 'v2', model: config.model, now });
    } catch {
      job = await deps.jobs.findActive(user.id);
      if (!job) return json({ code: 'AI_WEEKLY_REPORT_JOB_CREATE_FAILED' }, 503);
    }
    const backgroundResponse = await deps.triggerBackground({
      requestUrl: request.url,
      jobId: job.id,
      facts: parsed.data.facts,
      authorization: authorizationFrom(request),
    }).catch(() => null);
    if (!backgroundResponse || backgroundResponse.status !== 202) {
      await deps.jobs.markFailed(job.id, user.id, {
        errorCode: 'AI_WEEKLY_REPORT_BACKGROUND_UNAVAILABLE',
        diagnostic: 'background_invocation_failed',
        now,
      });
      return json({ code: 'AI_WEEKLY_REPORT_BACKGROUND_UNAVAILABLE' }, 503);
    }
  }

  return json({
    job: { id: job.id, status: job.status, createdAt: job.created_at, expiresAt: job.expires_at },
    pollAfterMs: 2000,
  }, 202);
}

async function getJob(request: Request, jobId: string, deps: JobsDeps) {
  const auth = await authenticate(request, deps);
  if (auth.response) return auth.response;
  const user = auth.user;
  if (!jobIdSchema.safeParse(jobId).success) return json({ code: 'AI_WEEKLY_REPORT_JOB_NOT_FOUND' }, 404);
  let job = await deps.jobs.findOwned(jobId, user.id);
  if (!job) return json({ code: 'AI_WEEKLY_REPORT_JOB_NOT_FOUND' }, 404);
  const now = deps.now();
  if (new Date(job.expires_at).getTime() <= now.getTime()) {
    return json({ code: 'AI_WEEKLY_REPORT_JOB_EXPIRED' }, 410);
  }
  const activityStartedAt = job.status === 'running' ? job.started_at : job.created_at;
  const isStalled = (job.status === 'queued' || job.status === 'running')
    && activityStartedAt
    && now.getTime() - new Date(activityStartedAt).getTime() > 3 * 60 * 1000;
  if (isStalled) {
    await deps.jobs.markFailed(job.id, user.id, {
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic: 'background_stalled', now,
    });
    job = { ...job, status: 'failed', error_code: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic: 'background_stalled', completed_at: now.toISOString() };
  }
  return json({ job: publicJob(job) });
}

export async function handleWeeklyReportJobsRequest(request: Request, context: Pick<Context, 'params'>, deps: JobsDeps) {
  if (request.method === 'POST' && !context.params?.id) return createJob(request, deps);
  if (request.method === 'GET' && context.params?.id) return getJob(request, context.params.id, deps);
  return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
}

const triggerBackground = ({ requestUrl, jobId, facts, authorization }: { requestUrl: string; jobId: string; facts: unknown; authorization: string }) =>
  fetch(new URL('/api/ai/weekly-report/process', requestUrl), {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, facts }),
  });

export default async (request: Request, context: Context) => {
  const config = getWeeklyReportConfig();
  let jobs: WeeklyReportJobRepository;
  try {
    jobs = createWeeklyReportJobRepository(createWeeklyReportAdminClient(config.supabaseUrl, config.supabaseSecretKey));
  } catch {
    return json({ code: 'AI_WEEKLY_REPORT_NOT_CONFIGURED' }, 503);
  }
  return handleWeeklyReportJobsRequest(request, context, {
    getConfig: () => config, verifyUser: verifySupabaseUser, jobs, triggerBackground, now: () => new Date(),
  });
};

export const config: Config = {
  path: ['/api/ai/weekly-report/jobs', '/api/ai/weekly-report/jobs/:id'],
  method: ['GET', 'POST'],
  rateLimit: { windowLimit: 90, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
