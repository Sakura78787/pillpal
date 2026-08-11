import { describe, expect, test, vi } from 'vitest';
import { buildWeeklyFacts } from '../../src/features/ai-report/buildWeeklyFacts.js';
import { handleProcessWeeklyReportRequest } from '../functions/process-weekly-report-background.ts';
import { QwenRequestTimeoutError } from '../functions/generate-weekly-report.ts';

const FACTS = buildWeeklyFacts({ medications: [], medicationLogs: [], healthRecords: [], appointments: [] }, new Date(2026, 7, 9, 12));
const JOB = { id: '11111111-1111-4111-8111-111111111111', user_id: 'user-1', status: 'queued' };
const REPORT = {
  summary: '本周记录较少，建议继续记录。',
  adherence: { headline: '记录不足', interpretation: '未记录不等于确认漏服。', evidence_ids: ['dueDoseCount'] },
  insights: [], health_trends: [], actions: [],
  data_gaps: [{ code: 'no_health_records', text: '健康记录不足。' }],
  disclaimer: '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。',
  meta: { promptVersion: 'v2', model: 'qwen3.7-flash' },
};

const makeRequest = () => new Request('https://pillpal.test/api/ai/weekly-report/process', {
  method: 'POST',
  headers: { authorization: 'Bearer access-token', 'content-type': 'application/json' },
  body: JSON.stringify({ jobId: JOB.id, facts: FACTS }),
});

const deps = (overrides = {}) => ({
  getConfig: () => ({
    enabled: true,
    apiKey: 'qwen-key',
    model: 'qwen3.7-flash',
    promptVersion: 'v2',
    requestTimeoutMs: 45000,
    backgroundRequestTimeoutMs: 90000,
  }),
  verifyUser: vi.fn(async () => ({ id: 'user-1' })),
  jobs: {
    claim: vi.fn(async () => ({ ...JOB, status: 'running' })),
    complete: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
  },
  callModel: vi.fn(async () => ({ report: REPORT, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } })),
  now: () => new Date('2026-08-10T10:00:00.000Z'),
  logEvent: vi.fn(),
  ...overrides,
});
const sortedKeys = (value) => Object.keys(value).sort();

describe('weekly report background processor', () => {
  test('claims a queued job once, validates the report, and persists success', async () => {
    const dependencies = deps();
    const response = await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(response.status).toBe(204);
    expect(dependencies.jobs.claim).toHaveBeenCalledWith(JOB.id, 'user-1', expect.any(Date));
    expect(dependencies.callModel).toHaveBeenCalledOnce();
    expect(dependencies.callModel).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ requestTimeoutMs: 90000 }),
    );
    expect(dependencies.jobs.complete).toHaveBeenCalledWith(JOB.id, 'user-1', expect.objectContaining({
      report: REPORT, inputTokens: 10, outputTokens: 20,
    }));
    const successLog = dependencies.logEvent.mock.calls.find(([event]) => event === 'weekly_report_background_succeeded')[1];
    expect(successLog).toMatchObject({ stage: 'completed', code: 'ok', modelCallCount: 1 });
    expect(sortedKeys(successLog)).toEqual([
      'authDurationMs', 'claimDurationMs', 'code', 'inputTokens', 'modelCallCount', 'modelDurationMs',
      'outputTokens', 'persistenceDurationMs', 'stage', 'totalDurationMs', 'validationDurationMs',
    ]);
  });

  test('does not call the model when another invocation already claimed the job', async () => {
    const dependencies = deps({ jobs: { ...deps().jobs, claim: vi.fn(async () => null) } });
    const response = await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(response.status).toBe(204);
    expect(dependencies.callModel).not.toHaveBeenCalled();
  });

  test('persists a safe timeout diagnostic instead of throwing and triggering a retry', async () => {
    const dependencies = deps({ callModel: vi.fn(async () => { throw new QwenRequestTimeoutError(); }) });
    const response = await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(response.status).toBe(204);
    expect(dependencies.jobs.markFailed).toHaveBeenCalledWith(JOB.id, 'user-1', expect.objectContaining({
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'qwen_request_timeout',
    }));
  });

  test('stops an ordinary upstream HTTP failure at the model stage without repair', async () => {
    const callModel = vi.fn(async () => ({
      upstreamHttpError: true,
      status: 500,
      diagnostic: 'qwen_http_error',
    }));
    const dependencies = deps({ callModel });

    await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(callModel).toHaveBeenCalledOnce();
    expect(dependencies.jobs.complete).not.toHaveBeenCalled();
    expect(dependencies.jobs.markFailed).toHaveBeenCalledWith(JOB.id, 'user-1', expect.objectContaining({
      errorCode: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE',
      diagnostic: 'qwen_http_error',
    }));
    expect(dependencies.logEvent).toHaveBeenCalledWith('weekly_report_background_failed', expect.objectContaining({
      stage: 'model', code: 'qwen_http_error', modelCallCount: 1,
    }));
  });

  test('repairs one invalid response once, then persists the fully revalidated report', async () => {
    const invalid = { ...REPORT, adherence: { ...REPORT.adherence, evidence_ids: ['invented_evidence'] } };
    const callModel = vi.fn()
      .mockResolvedValueOnce({ report: invalid, rawContent: JSON.stringify(invalid), usage: { inputTokens: 10, outputTokens: 20 } })
      .mockResolvedValueOnce({ report: REPORT, usage: { inputTokens: 4, outputTokens: 8 } });
    const dependencies = deps({ callModel });

    await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0]).toMatchObject({
      promptVersion: 'v2',
      repair: { diagnostic: 'invalid_evidence_id' },
    });
    expect(dependencies.jobs.complete).toHaveBeenCalledWith(JOB.id, 'user-1', expect.objectContaining({
      report: REPORT,
      inputTokens: 14,
      outputTokens: 28,
    }));
    expect(dependencies.logEvent).toHaveBeenCalledWith('weekly_report_background_succeeded', expect.objectContaining({
      stage: 'completed', code: 'ok', modelCallCount: 2, inputTokens: 14, outputTokens: 28,
    }));
  });

  test('after one repair failure persists the exact safe diagnostic, usage and timing', async () => {
    const invalid = { ...REPORT, actions: [{ action_code: 'change_dosage' }] };
    const callModel = vi.fn(async () => ({ report: invalid, rawContent: JSON.stringify(invalid), usage: { inputTokens: 5, outputTokens: 6 } }));
    const dependencies = deps({ callModel });

    await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(dependencies.jobs.markFailed).toHaveBeenCalledWith(JOB.id, 'user-1', expect.objectContaining({
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'invalid_action_code',
      inputTokens: 10,
      outputTokens: 12,
      modelDurationMs: expect.any(Number),
    }));
    expect(dependencies.logEvent).toHaveBeenCalledWith('weekly_report_background_failed', expect.objectContaining({
      stage: 'validation', code: 'invalid_action_code', modelCallCount: 2,
      inputTokens: 10, outputTokens: 12, validationDurationMs: expect.any(Number), totalDurationMs: expect.any(Number),
    }));
    const failureLog = dependencies.logEvent.mock.calls.find(([event]) => event === 'weekly_report_background_failed')[1];
    expect(sortedKeys(failureLog)).toEqual([
      'authDurationMs', 'claimDurationMs', 'code', 'inputTokens', 'modelCallCount', 'modelDurationMs',
      'outputTokens', 'persistenceDurationMs', 'stage', 'totalDurationMs', 'validationDurationMs',
    ]);
    const serializedLog = JSON.stringify(dependencies.logEvent.mock.calls);
    expect(serializedLog).not.toMatch(/user-1|change_dosage|qwen-key|access-token|本周记录较少/);
  });

  test('classifies a failed success write as job_persistence_failed without leaking report content', async () => {
    const jobs = {
      ...deps().jobs,
      complete: vi.fn(async () => { throw new Error('database unavailable'); }),
      markFailed: vi.fn(async () => {}),
    };
    const dependencies = deps({ jobs });

    await handleProcessWeeklyReportRequest(makeRequest(), dependencies);

    expect(jobs.markFailed).toHaveBeenCalledWith(JOB.id, 'user-1', expect.objectContaining({ diagnostic: 'job_persistence_failed' }));
    expect(dependencies.logEvent).toHaveBeenCalledWith('weekly_report_background_failed', expect.objectContaining({
      stage: 'persistence', code: 'job_persistence_failed', path: 'complete', modelCallCount: 1,
    }));
    const persistenceLog = dependencies.logEvent.mock.calls.find(([event]) => event === 'weekly_report_background_failed')[1];
    expect(sortedKeys(persistenceLog)).toEqual([
      'authDurationMs', 'claimDurationMs', 'code', 'inputTokens', 'modelCallCount', 'modelDurationMs',
      'outputTokens', 'path', 'persistenceDurationMs', 'stage', 'totalDurationMs', 'validationDurationMs',
    ]);
    expect(JSON.stringify(dependencies.logEvent.mock.calls)).not.toContain(REPORT.summary);
  });
});
