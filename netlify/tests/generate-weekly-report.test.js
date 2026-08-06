import { describe, expect, test, vi } from 'vitest';
import { handleWeeklyReportRequest } from '../functions/generate-weekly-report.ts';

const FACTS = {
  periodStart: '2026-07-27',
  periodEnd: '2026-08-02',
  recordedTakenCount: 4,
  recordedSkippedCount: 1,
  activeMedicationCount: 2,
  lowStockMedicationCount: 1,
  healthRecordCounts: {
    bloodPressure: 1,
    bloodSugar: 0,
    weight: 0,
    other: 0,
  },
  hasUpcomingAppointment: true,
  nextAppointmentInDays: 3,
  dataGapCodes: ['no_blood_sugar_records'],
  evidence: {
    recorded_taken_count: 4,
    recorded_skipped_count: 1,
    active_medication_count: 2,
    low_stock_medication_count: 1,
    health_blood_pressure_count: 1,
    has_upcoming_appointment: true,
  },
};

const VALID_REPORT = {
  summary: 'This week has recorded medication activity and one upcoming appointment.',
  highlights: [
    {
      type: 'checkins',
      text: 'There were 4 recorded taken events and 1 recorded skipped event.',
      evidence_ids: ['recorded_taken_count', 'recorded_skipped_count'],
    },
  ],
  data_gaps: ['Blood sugar was not recorded this week.'],
  disclaimer: '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。',
  meta: { promptVersion: 'v1', model: 'qwen3.7-flash' },
};

const makeRequest = (body = { facts: FACTS }, init = {}) =>
  new Request('https://pillpal.test/api/ai/weekly-report', {
    method: 'POST',
    headers: {
      authorization: 'Bearer access-token',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });

const deps = (overrides = {}) => ({
  getConfig: () => ({
    enabled: true,
    evalMode: false,
    apiKey: 'server-only-key',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.7-flash',
  }),
  verifyUser: vi.fn(async () => ({ id: 'user-1' })),
  callModel: vi.fn(async () => VALID_REPORT),
  ...overrides,
});

const json = async (response) => response.json();

describe('generate weekly report function', () => {
  test('rejects non-POST requests', async () => {
    const response = await handleWeeklyReportRequest(new Request('https://pillpal.test/api/ai/weekly-report'), deps());

    expect(response.status).toBe(405);
  });

  test('returns 503 without model calls when the server flag is disabled', async () => {
    const callModel = vi.fn();
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ getConfig: () => ({ enabled: false, evalMode: false, apiKey: 'server-only-key', model: 'qwen3.7-flash' }), callModel, logEvent })
    );
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'AI weekly report is temporarily unavailable',
      code: 'AI_WEEKLY_REPORT_NOT_CONFIGURED',
    });
    expect(callModel).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_config_unavailable',
      expect.objectContaining({ reason: 'disabled' })
    );
  });

  test('returns 503 without external calls when the Qwen key is missing', async () => {
    const callModel = vi.fn();
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ getConfig: () => ({ enabled: true, evalMode: false, apiKey: '', model: 'qwen3.7-flash' }), callModel, logEvent })
    );
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'AI weekly report is temporarily unavailable',
      code: 'AI_WEEKLY_REPORT_NOT_CONFIGURED',
    });
    expect(callModel).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_config_unavailable',
      expect.objectContaining({ reason: 'missing_api_key' })
    );
  });

  test('rejects missing bearer tokens', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest(undefined, { headers: { authorization: '' } }),
      deps()
    );

    expect(response.status).toBe(401);
  });

  test('rejects invalid fact payloads', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: { recordedTakenCount: -1 } }),
      deps()
    );

    expect(response.status).toBe(400);
  });

  test('forbids Prompt V0 outside evaluation mode', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: FACTS, promptVersion: 'v0' }),
      deps()
    );

    expect(response.status).toBe(403);
  });

  test('maps Qwen quota and rate-limit failures to a generic 503', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ callModel: vi.fn(async () => ({ errorCode: 'AllocationQuota.FreeTierOnly' })) })
    );

    expect(response.status).toBe(503);
    await expect(json(response)).resolves.toEqual({
      error: 'AI weekly report is temporarily unavailable',
      code: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE',
    });
  });

  test('rejects model output that does not match the report schema', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ callModel: vi.fn(async () => ({ summary: 'missing fields' })) })
    );
    const body = await json(response);

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: 'AI weekly report generation failed',
      code: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
    });
  });

  test('returns a valid report without echoing secrets or user identifiers', async () => {
    const verifyUser = vi.fn(async () => ({ id: 'user-1' }));
    const logEvent = vi.fn();
    const callModel = vi.fn(async () => ({
      report: VALID_REPORT,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }));
    const response = await handleWeeklyReportRequest(makeRequest(), deps({ verifyUser, callModel, logEvent }));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(verifyUser).toHaveBeenCalledWith('access-token');
    expect(callModel).toHaveBeenCalledWith(
      expect.objectContaining({ facts: FACTS, promptVersion: 'v1' }),
      expect.objectContaining({ apiKey: 'server-only-key' })
    );
    expect(JSON.stringify(body)).not.toMatch(/access-token|server-only-key|user-1/);
    expect(body.report).toEqual(VALID_REPORT);
    expect(body.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_model_success',
      expect.objectContaining({
        model: 'qwen3.7-flash',
        promptVersion: 'v1',
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      })
    );
    expect(JSON.stringify(logEvent.mock.calls)).not.toMatch(/access-token|server-only-key|user-1/);
  });
});
