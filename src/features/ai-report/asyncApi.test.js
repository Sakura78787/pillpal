import { describe, expect, test, vi } from 'vitest';
import { getWeeklyReportJob, startWeeklyReportJob, waitForWeeklyReportJob } from './api.js';
import { buildWeeklyFacts } from './buildWeeklyFacts.js';

const FACTS = buildWeeklyFacts({ medications: [], medicationLogs: [], healthRecords: [], appointments: [] }, new Date(2026, 7, 9, 12));
const JOB = { id: 'job-1', status: 'queued', createdAt: '2026-08-10T10:00:00Z', expiresAt: '2026-08-11T10:00:00Z' };
const supabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'token' } }, error: null })),
    refreshSession: vi.fn(async () => ({ data: { session: { access_token: 'fresh-token' } }, error: null })),
  },
};

describe('async weekly report API', () => {
  test('starts a job and returns the server polling interval', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init.headers.authorization).toBe('Bearer fresh-token');
      expect(JSON.parse(init.body)).toEqual({ facts: FACTS });
      return Response.json({ job: JOB, pollAfterMs: 2000 }, { status: 202 });
    });
    await expect(startWeeklyReportJob({ supabase, facts: FACTS, fetchImpl })).resolves.toEqual({
      success: true, job: JOB, pollAfterMs: 2000,
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/ai/weekly-report/jobs', expect.any(Object));
  });

  test('queries a job and retries once with a refreshed token after 401', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'AI_WEEKLY_REPORT_AUTH_REQUIRED' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ job: { ...JOB, status: 'running' } }));
    const result = await getWeeklyReportJob({ supabase, jobId: JOB.id, fetchImpl });
    expect(result).toEqual({ success: true, job: { ...JOB, status: 'running' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1].headers.authorization).toBe('Bearer fresh-token');
  });

  test('polls until success without holding one long browser request', async () => {
    const getJob = vi.fn()
      .mockResolvedValueOnce({ success: true, job: { ...JOB, status: 'queued' } })
      .mockResolvedValueOnce({ success: true, job: { ...JOB, status: 'running' } })
      .mockResolvedValueOnce({ success: true, job: { ...JOB, status: 'succeeded', report: { summary: 'done' } } });
    const sleep = vi.fn(async () => {});
    const result = await waitForWeeklyReportJob({ jobId: JOB.id, getJob, sleep, pollIntervalMs: 2000, maxWaitMs: 180000 });
    expect(result).toMatchObject({ success: true, job: { status: 'succeeded' } });
    expect(getJob).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('keeps polling after a transient network failure and preserves the job', async () => {
    const getJob = vi.fn()
      .mockResolvedValueOnce({ success: false, transient: true, job: null, error: '查询失败' })
      .mockResolvedValueOnce({ success: true, job: { ...JOB, status: 'running' } })
      .mockResolvedValueOnce({ success: true, job: { ...JOB, status: 'succeeded', report: { summary: 'done' } } });
    const sleep = vi.fn(async () => {});

    const result = await waitForWeeklyReportJob({ jobId: JOB.id, getJob, sleep });

    expect(result).toMatchObject({ success: true, job: { status: 'succeeded' } });
    expect(getJob).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('stops polling after the client wait budget without marking the server job failed', async () => {
    let now = 0;
    const result = await waitForWeeklyReportJob({
      jobId: JOB.id,
      getJob: vi.fn(async () => ({ success: true, job: { ...JOB, status: 'running' } })),
      sleep: vi.fn(async () => { now += 2000; }),
      now: () => now,
      pollIntervalMs: 2000,
      maxWaitMs: 4000,
    });
    expect(result).toEqual({
      success: false,
      pending: true,
      job: { ...JOB, status: 'running' },
      error: '任务仍在处理中，可稍后继续查看',
    });
  });
});
