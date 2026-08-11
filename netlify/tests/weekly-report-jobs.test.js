import { describe, expect, test, vi } from 'vitest';
import { handleWeeklyReportJobsRequest } from '../functions/weekly-report-jobs.ts';
import { SupabaseAuthVerificationError } from '../functions/_shared/verifySupabaseUser.ts';
import { buildWeeklyFacts } from '../../src/features/ai-report/buildWeeklyFacts.js';

const FACTS = buildWeeklyFacts(
  { medications: [], medicationLogs: [], healthRecords: [], appointments: [] },
  new Date(2026, 7, 9, 12)
);

const JOB = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-1',
  status: 'queued',
  prompt_version: 'v2',
  model: 'qwen3.7-flash',
  report: null,
  error_code: null,
  diagnostic: null,
  created_at: '2026-08-10T10:00:00.000Z',
  started_at: null,
  completed_at: null,
  expires_at: '2026-08-11T10:00:00.000Z',
};

const request = (url, init = {}) => new Request(url, {
  headers: { authorization: 'Bearer access-token', 'content-type': 'application/json', ...(init.headers || {}) },
  ...init,
});

const deps = (overrides = {}) => ({
  getConfig: () => ({ enabled: true, apiKey: 'qwen-key', model: 'qwen3.7-flash', promptVersion: 'v2', supabaseSecretKey: 'sb_secret_test' }),
  verifyUser: vi.fn(async () => ({ id: 'user-1' })),
  jobs: {
    deleteExpired: vi.fn(async () => {}),
    findActive: vi.fn(async () => null),
    create: vi.fn(async () => JOB),
    findOwned: vi.fn(async () => JOB),
    markFailed: vi.fn(async () => {}),
  },
  triggerBackground: vi.fn(async () => new Response(null, { status: 202 })),
  now: () => new Date('2026-08-10T10:00:00.000Z'),
  ...overrides,
});

describe('weekly report jobs endpoint', () => {
  test('creates a queued job, invokes background processing, and returns 202 immediately', async () => {
    const dependencies = deps();
    const response = await handleWeeklyReportJobsRequest(request(
      'https://pillpal.test/api/ai/weekly-report/jobs',
      { method: 'POST', body: JSON.stringify({ facts: FACTS }) }
    ), { params: {} }, dependencies);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      job: {
        id: JOB.id,
        status: 'queued',
        createdAt: JOB.created_at,
        expiresAt: JOB.expires_at,
      },
      pollAfterMs: 2000,
    });
    expect(dependencies.jobs.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', promptVersion: 'v2', model: 'qwen3.7-flash',
    }));
    expect(dependencies.triggerBackground).toHaveBeenCalledWith(expect.objectContaining({
      jobId: JOB.id, facts: FACTS, authorization: 'Bearer access-token',
    }));
  });

  test('returns the existing active job without starting a second background invocation', async () => {
    const dependencies = deps({ jobs: { ...deps().jobs, findActive: vi.fn(async () => JOB) } });
    const response = await handleWeeklyReportJobsRequest(request(
      'https://pillpal.test/api/ai/weekly-report/jobs',
      { method: 'POST', body: JSON.stringify({ facts: FACTS }) }
    ), { params: {} }, dependencies);

    expect(response.status).toBe(202);
    expect(dependencies.triggerBackground).not.toHaveBeenCalled();
    expect(dependencies.jobs.create).not.toHaveBeenCalled();
  });

  test('returns only an authenticated user own job and never exposes another account job', async () => {
    const own = deps();
    const response = await handleWeeklyReportJobsRequest(request(
      `https://pillpal.test/api/ai/weekly-report/jobs/${JOB.id}`,
      { method: 'GET' }
    ), { params: { id: JOB.id } }, own);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ job: { id: JOB.id, status: 'queued' } });
    expect(own.jobs.findOwned).toHaveBeenCalledWith(JOB.id, 'user-1');

    const denied = deps({ jobs: { ...deps().jobs, findOwned: vi.fn(async () => null) } });
    const deniedResponse = await handleWeeklyReportJobsRequest(request(
      `https://pillpal.test/api/ai/weekly-report/jobs/${JOB.id}`,
      { method: 'GET' }
    ), { params: { id: JOB.id } }, denied);
    expect(deniedResponse.status).toBe(404);
  });

  test('returns a retryable server error when Supabase Auth is temporarily unavailable', async () => {
    const dependencies = deps({
      verifyUser: vi.fn(async () => { throw new SupabaseAuthVerificationError('upstream_unavailable'); }),
    });
    const response = await handleWeeklyReportJobsRequest(request(
      `https://pillpal.test/api/ai/weekly-report/jobs/${JOB.id}`,
      { method: 'GET' }
    ), { params: { id: JOB.id } }, dependencies);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'AI_WEEKLY_REPORT_AUTH_UNAVAILABLE' });
    expect(dependencies.jobs.findOwned).not.toHaveBeenCalled();
  });

  test('returns 410 for expired jobs', async () => {
    const expired = { ...JOB, expires_at: '2026-08-10T09:59:59.000Z' };
    const dependencies = deps({ jobs: { ...deps().jobs, findOwned: vi.fn(async () => expired) } });
    const response = await handleWeeklyReportJobsRequest(request(
      `https://pillpal.test/api/ai/weekly-report/jobs/${JOB.id}`,
      { method: 'GET' }
    ), { params: { id: JOB.id } }, dependencies);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: 'AI_WEEKLY_REPORT_JOB_EXPIRED' });
  });

  test('marks a queued job as failed when background processing never starts', async () => {
    const stalled = { ...JOB, created_at: '2026-08-10T09:56:59.000Z' };
    const dependencies = deps({ jobs: { ...deps().jobs, findOwned: vi.fn(async () => stalled) } });
    const response = await handleWeeklyReportJobsRequest(request(
      `https://pillpal.test/api/ai/weekly-report/jobs/${JOB.id}`,
      { method: 'GET' }
    ), { params: { id: JOB.id } }, dependencies);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      job: { status: 'failed', diagnostic: 'background_stalled' },
    });
    expect(dependencies.jobs.markFailed).toHaveBeenCalledWith(
      JOB.id,
      'user-1',
      expect.objectContaining({ diagnostic: 'background_stalled' }),
    );
  });
});
