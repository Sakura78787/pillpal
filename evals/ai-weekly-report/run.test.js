import { describe, expect, test, vi } from 'vitest';
import { normalizeV2Endpoint, runAsyncCase, runCaseWithRetry } from './run.mjs';

const CASE = {
  id: 'v2-typical-1',
  category: 'typical',
  facts: {},
  expected: {},
};

describe('evaluation runner retry policy', () => {
  test('retries one transient failure and consumes the shared retry budget', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, diagnostic: 'qwen_request_timeout' })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const retryBudget = { remaining: 3 };

    const result = await runCaseWithRetry({ execute, retryBudget, sleepImpl: async () => {} });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(retryBudget.remaining).toBe(2);
    expect(result).toMatchObject({ ok: true, attemptCount: 2, retried: true });
  });

  test('does not retry a content validation failure', async () => {
    const execute = vi.fn(async () => ({
      ok: false,
      status: 502,
      code: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'schema_invalid',
    }));
    const retryBudget = { remaining: 3 };

    const result = await runCaseWithRetry({ execute, retryBudget, sleepImpl: async () => {} });

    expect(execute).toHaveBeenCalledOnce();
    expect(retryBudget.remaining).toBe(3);
    expect(result).toMatchObject({ ok: false, attemptCount: 1, retried: false });
  });

  test('does not retry when the global retry budget is exhausted', async () => {
    const execute = vi.fn(async () => ({ ok: false, status: 429 }));

    const result = await runCaseWithRetry({
      execute,
      retryBudget: { remaining: 0 },
      sleepImpl: async () => {},
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ attemptCount: 1, retried: false });
  });

  test('retries a transient model failure returned by a completed async job', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 200, diagnostic: 'qwen_request_timeout' })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const retryBudget = { remaining: 3 };

    const result = await runCaseWithRetry({ execute, retryBudget, sleepImpl: async () => {} });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(retryBudget.remaining).toBe(2);
    expect(result).toMatchObject({ ok: true, attemptCount: 2, retried: true });
  });

  test('normalizes both base and trailing-slash jobs endpoints', () => {
    expect(normalizeV2Endpoint('https://pillpal.test/api/ai/weekly-report')).toBe('https://pillpal.test/api/ai/weekly-report/jobs');
    expect(normalizeV2Endpoint('https://pillpal.test/api/ai/weekly-report/jobs/')).toBe('https://pillpal.test/api/ai/weekly-report/jobs');
  });
});

describe('V2 async evaluation runner', () => {
  test('creates one job, polls it to success, and grades the final report with eval metadata', async () => {
    const report = {
      summary: 'request succeeded',
      adherence: { headline: 'ok', interpretation: 'ok', evidence_ids: [] },
      insights: [], health_trends: [], actions: [], data_gaps: [],
      disclaimer: '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。',
      meta: { promptVersion: 'v2', model: 'qwen3.7-flash' },
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: { id: 'job-1', status: 'queued' }, pollAfterMs: 1,
      }), { status: 202, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: { id: 'job-1', status: 'running' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: 'job-1', status: 'succeeded', report,
          evalMeta: { modelCallCount: 2, repairTriggered: true, inputTokens: 10, outputTokens: 20 },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await runAsyncCase({
      endpoint: 'https://pillpal.test/api/ai/weekly-report/jobs',
      accessToken: 'access-token',
      caseItem: CASE,
      fetchImpl,
      sleepImpl: async () => {},
      now: (() => { let value = 0; return () => (value += 10); })(),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://pillpal.test/api/ai/weekly-report/jobs');
    expect(fetchImpl.mock.calls[2][0]).toBe('https://pillpal.test/api/ai/weekly-report/jobs/job-1');
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      usage: { inputTokens: 10, outputTokens: 20 },
      evalMeta: { modelCallCount: 2, repairTriggered: true },
      grade: { requestSuccess: true, modelCallCount: 2, repairTriggered: true },
    });
  });

  test('returns the completed job diagnostic without creating a second job', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: { id: 'job-2', status: 'queued' }, pollAfterMs: 1,
      }), { status: 202, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: { id: 'job-2', status: 'failed', errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic: 'schema_invalid' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await runAsyncCase({
      endpoint: 'https://pillpal.test/api/ai/weekly-report/jobs',
      accessToken: 'access-token',
      caseItem: CASE,
      fetchImpl,
      sleepImpl: async () => {},
      now: (() => { let value = 0; return () => (value += 10); })(),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false, status: 200, diagnostic: 'schema_invalid' });
  });
});
