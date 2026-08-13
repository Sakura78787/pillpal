import { describe, expect, test, vi } from 'vitest';
import {
  callQwenWeeklyReport,
  handleWeeklyReportRequest,
  QwenRequestTimeoutError,
  ReportValidationError,
  validateReport,
} from '../functions/generate-weekly-report.ts';
import { SupabaseAuthVerificationError } from '../functions/_shared/verifySupabaseUser.ts';
import { buildWeeklyFacts } from '../../src/features/ai-report/buildWeeklyFacts.js';

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

const V2_FACTS = buildWeeklyFacts({
  medications: [{
    id: 'secret-med-id', name: '不应发给模型的药名', status: 'active', frequency_type: 'daily',
    frequency_config: { dailyTimes: 1 }, reminder_times: ['08:00'], start_date: '2026-08-03',
    dosage: 1, stock_quantity: 5, low_stock_threshold: 7,
  }],
  medicationLogs: [], healthRecords: [], appointments: [],
}, new Date(2026, 7, 9, 12, 0, 0));

const VALID_V2_REPORT = {
  summary: '本周晚间存在需要核实的未记录计划。',
  adherence: {
    headline: '计划记录仍有缺口',
    interpretation: '未记录不代表确认漏服，需要先与老人核实。',
    evidence_ids: ['dueDoseCount', 'unrecordedDoseCount'],
  },
  insights: [{
    category: 'adherence', severity: 'attention', title: '存在未记录计划',
    detail: '请先核实实际服药情况。', evidence_ids: ['unrecordedDoseCount'], related_medication_refs: ['med_1'],
  }],
  health_trends: [],
  actions: [{
    action_code: 'confirm_unrecorded_schedule', text: '与老人确认未记录时段',
    reason: '当前存在未记录计划。', evidence_ids: ['unrecordedDoseCount'], related_medication_refs: ['med_1'],
  }],
  data_gaps: [{ code: 'no_health_records', text: '本周没有健康指标记录，暂不能形成趋势。' }],
  disclaimer: '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。',
  meta: { promptVersion: 'v2', model: 'qwen3.7-flash' },
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
    promptVersion: 'v1',
  }),
  verifyUser: vi.fn(async () => ({ id: 'user-1' })),
  callModel: vi.fn(async () => VALID_REPORT),
  ...overrides,
});

const json = async (response) => response.json();
const sortedKeys = (value) => Object.keys(value).sort();

describe('generate weekly report function', () => {
  test('caps Qwen output and aborts the upstream request at the configured deadline', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const config = {
      apiKey: 'server-only-key',
      baseUrl: 'https://example.test/v1',
      model: 'qwen3.7-flash',
      maxOutputTokens: 1400,
      requestTimeoutMs: 45000,
    };

    const resultPromise = callQwenWeeklyReport(
      { facts: FACTS, promptVersion: 'v1' },
      config,
      fetchImpl
    );

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.max_tokens).toBe(1400);
    const timeoutExpectation = expect(resultPromise).rejects.toBeInstanceOf(QwenRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(45000);
    await timeoutExpectation;
    vi.useRealTimers();
  });

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
      { stage: 'configuration', code: 'disabled' }
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
      { stage: 'configuration', code: 'missing_api_key' }
    );
  });

  test('rejects missing bearer tokens', async () => {
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest(undefined, { headers: { authorization: '' } }),
      deps({ logEvent })
    );

    expect(response.status).toBe(401);
    await expect(json(response)).resolves.toEqual({
      error: 'Authentication required',
      code: 'AI_WEEKLY_REPORT_AUTH_REQUIRED',
    });
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_auth_failure',
      { stage: 'auth', code: 'missing_token' }
    );
  });

  test('returns a safe diagnostic when Supabase rejects the access token', async () => {
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({
        verifyUser: vi.fn(async () => {
          throw new Error('token details must not be exposed');
        }),
        logEvent,
      })
    );

    expect(response.status).toBe(401);
    await expect(json(response)).resolves.toEqual({
      error: 'Authentication required',
      code: 'AI_WEEKLY_REPORT_AUTH_REQUIRED',
    });
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_auth_failure',
      { stage: 'auth', code: 'invalid_token' }
    );
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('token details must not be exposed');
  });

  test('does not misreport a server auth configuration failure as an expired login', async () => {
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({
        verifyUser: vi.fn(async () => {
          throw new SupabaseAuthVerificationError('missing_config');
        }),
        logEvent,
      })
    );

    expect(response.status).toBe(503);
    await expect(json(response)).resolves.toEqual({
      error: 'Authentication service is temporarily unavailable',
      code: 'AI_WEEKLY_REPORT_AUTH_SERVICE_UNAVAILABLE',
    });
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_auth_failure',
      { stage: 'auth', code: 'missing_config' }
    );
  });

  test('rejects invalid fact payloads', async () => {
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: { recordedTakenCount: -1 } }),
      deps({ logEvent })
    );

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: 'Invalid weekly report facts',
      code: 'AI_WEEKLY_REPORT_INVALID_INPUT',
    });
    expect(logEvent).toHaveBeenCalledWith(
      'weekly_report_input_failure',
      { stage: 'input', code: 'invalid_facts' }
    );
  });

  test('ignores client-selected prompt versions outside evaluation mode', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: FACTS, promptVersion: 'v0' }),
      deps()
    );

    expect(response.status).toBe(200);
  });

  test('returns a safe exact diagnostic for Qwen free-tier quota failures', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ callModel: vi.fn(async () => ({ errorCode: 'AllocationQuota.FreeTierOnly' })) })
    );

    expect(response.status).toBe(503);
    await expect(json(response)).resolves.toEqual({
      error: 'AI weekly report is temporarily unavailable',
      code: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE',
      diagnostic: 'qwen_free_tier_quota',
    });
  });

  test('stops on an ordinary upstream HTTP failure without attempting V2 repair', async () => {
    const callModel = vi.fn(async () => ({
      upstreamHttpError: true,
      status: 401,
      diagnostic: 'qwen_http_error',
    }));
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel,
        logEvent,
      }),
    );

    expect(callModel).toHaveBeenCalledOnce();
    expect(response.status).toBe(503);
    await expect(json(response)).resolves.toMatchObject({
      code: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE',
      diagnostic: 'qwen_http_error',
    });
    expect(logEvent).toHaveBeenCalledWith('weekly_report_model_unavailable', expect.objectContaining({
      stage: 'model', code: 'qwen_http_error', modelCallCount: 1,
    }));
  });

  test('marks non-2xx Qwen responses without exposing their body', async () => {
    const fetchImpl = vi.fn(async () => Response.json(
      { message: 'sensitive upstream body' },
      { status: 401 },
    ));

    const result = await callQwenWeeklyReport(
      { facts: V2_FACTS, promptVersion: 'v2' },
      { apiKey: 'server-only-key', baseUrl: 'https://example.test/v1', model: 'qwen3.7-flash' },
      fetchImpl,
    );

    expect(result).toEqual({ upstreamHttpError: true, status: 401, diagnostic: 'qwen_http_error' });
    expect(JSON.stringify(result)).not.toContain('sensitive upstream body');
  });

  test('returns a safe exact diagnostic when the upstream Qwen request times out', async () => {
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ callModel: vi.fn(async () => { throw new QwenRequestTimeoutError(); }) })
    );

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: 'AI weekly report generation failed',
      code: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'qwen_request_timeout',
    });
  });

  test('rejects model output that does not match the report schema', async () => {
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest(),
      deps({ callModel: vi.fn(async () => ({ report: { summary: 'missing fields' }, usage: { inputTokens: 7, outputTokens: 2 } })), logEvent })
    );
    const body = await json(response);

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: 'AI weekly report generation failed',
      code: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'schema_invalid',
    });
    expect(logEvent).toHaveBeenCalledWith('weekly_report_model_failure', expect.objectContaining({
      stage: 'validation', code: 'schema_invalid', path: 'highlights', modelCallCount: 1,
      inputTokens: 7, outputTokens: 2,
    }));
    expect(sortedKeys(logEvent.mock.calls[0][1])).toEqual([
      'authDurationMs', 'code', 'inputTokens', 'modelCallCount', 'modelDurationMs', 'outputTokens',
      'path', 'stage', 'totalDurationMs', 'validationDurationMs',
    ]);
  });

  test.each([
    ['schema_invalid', { ...VALID_V2_REPORT, health_trends: undefined }, 'health_trends'],
    ['invalid_evidence_id', { ...VALID_V2_REPORT, adherence: { ...VALID_V2_REPORT.adherence, evidence_ids: ['missing_evidence'] } }, undefined],
    ['invalid_medication_ref', { ...VALID_V2_REPORT, insights: [{ ...VALID_V2_REPORT.insights[0], related_medication_refs: ['med_99'] }] }, undefined],
    ['invalid_action_code', { ...VALID_V2_REPORT, actions: [{ ...VALID_V2_REPORT.actions[0], action_code: 'change_dosage' }] }, undefined],
    ['invalid_data_gap_code', { ...VALID_V2_REPORT, data_gaps: [{ code: 'invented_gap', text: '记录不足。' }] }, undefined],
    ['internal_code_leakage', { ...VALID_V2_REPORT, summary: '请关注 no_upcoming_appointments。' }, undefined],
  ])('classifies %s without exposing model content', (diagnostic, report, expectedPath) => {
    let error;
    try {
      validateReport(report, V2_FACTS, 'v2', 'qwen3.7-flash');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ReportValidationError);
    expect(error).toMatchObject({ diagnostic, ...(expectedPath ? { path: expectedPath } : {}) });
    expect(JSON.stringify(error)).not.toMatch(/不应发给模型的药名|no_upcoming_appointments/);
  });

  test('classifies invalid upstream JSON separately from transport failures', async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      choices: [{ message: { content: '{"summary":' } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    }));

    const result = await callQwenWeeklyReport(
      { facts: V2_FACTS, promptVersion: 'v2' },
      { apiKey: 'server-only-key', baseUrl: 'https://example.test/v1', model: 'qwen3.7-flash' },
      fetchImpl,
    );

    expect(result).toMatchObject({ parseError: true, rawContent: '{"summary":', usage: { inputTokens: 12, outputTokens: 3 } });
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
        authDurationMs: expect.any(Number),
        modelDurationMs: expect.any(Number),
        validationDurationMs: expect.any(Number),
        totalDurationMs: expect.any(Number),
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        stage: 'completed',
        code: 'ok',
        modelCallCount: 1,
      })
    );
    expect(sortedKeys(logEvent.mock.calls[0][1])).toEqual([
      'authDurationMs', 'code', 'inputTokens', 'modelCallCount', 'modelDurationMs', 'outputTokens',
      'stage', 'totalDurationMs', 'totalTokens', 'validationDurationMs',
    ]);
    expect(JSON.stringify(logEvent.mock.calls)).not.toMatch(/access-token|server-only-key|user-1/);
  });

  test('uses the server-selected V2 prompt and validates evidence, actions and medication refs', async () => {
    const callModel = vi.fn(async () => VALID_V2_REPORT);
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS, promptVersion: 'v0' }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel,
      })
    );

    expect(response.status).toBe(200);
    expect(callModel).toHaveBeenCalledWith(
      expect.objectContaining({ facts: V2_FACTS, promptVersion: 'v2' }),
      expect.any(Object)
    );
    await expect(json(response)).resolves.toMatchObject({ report: VALID_V2_REPORT });
  });

  test('repairs one invalid synchronous V2 response once and accumulates usage', async () => {
    const invalid = { ...VALID_V2_REPORT, adherence: { ...VALID_V2_REPORT.adherence, evidence_ids: ['invented_evidence'] } };
    const callModel = vi.fn()
      .mockResolvedValueOnce({ report: invalid, rawContent: JSON.stringify(invalid), usage: { inputTokens: 10, outputTokens: 20 } })
      .mockResolvedValueOnce({ report: VALID_V2_REPORT, usage: { inputTokens: 4, outputTokens: 8 } });
    const logEvent = vi.fn();
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel,
        logEvent,
      }),
    );

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toMatchObject({ usage: { inputTokens: 14, outputTokens: 28, totalTokens: 42 } });
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0]).toMatchObject({ repair: { diagnostic: 'invalid_evidence_id' } });
    expect(logEvent).toHaveBeenCalledWith('weekly_report_model_success', expect.objectContaining({
      stage: 'completed', code: 'ok', modelCallCount: 2, inputTokens: 14, outputTokens: 28,
    }));
  });

  test('returns repair metadata only in evaluation mode', async () => {
    const invalid = { ...VALID_V2_REPORT, adherence: { ...VALID_V2_REPORT.adherence, evidence_ids: ['invented_evidence'] } };
    const evalCallModel = vi.fn()
      .mockResolvedValueOnce({ report: invalid, rawContent: JSON.stringify(invalid) })
      .mockResolvedValueOnce({ report: VALID_V2_REPORT });
    const evalResponse = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS, promptVersion: 'v2' }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: true, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel: evalCallModel,
      })
    );

    await expect(json(evalResponse)).resolves.toMatchObject({
      evalMeta: {
        modelCallCount: 2,
        repairTriggered: true,
        modelDurationMs: expect.any(Number),
        validationDurationMs: expect.any(Number),
      },
    });

    const productionResponse = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel: vi.fn(async () => ({ report: VALID_V2_REPORT })),
      })
    );
    const productionPayload = await json(productionResponse);
    expect(productionPayload).not.toHaveProperty('evalMeta');
  });

  test('returns the second exact diagnostic when synchronous V2 repair still fails', async () => {
    const invalidEvidence = { ...VALID_V2_REPORT, adherence: { ...VALID_V2_REPORT.adherence, evidence_ids: ['invented_evidence'] } };
    const invalidAction = { ...VALID_V2_REPORT, actions: [{ ...VALID_V2_REPORT.actions[0], action_code: 'change_dosage' }] };
    const callModel = vi.fn().mockResolvedValueOnce(invalidEvidence).mockResolvedValueOnce(invalidAction);
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel,
      }),
    );

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toMatchObject({ diagnostic: 'invalid_action_code' });
  });

  test('maps a quota error from the synchronous V2 repair call', async () => {
    const invalid = { ...VALID_V2_REPORT, adherence: { ...VALID_V2_REPORT.adherence, evidence_ids: ['invented_evidence'] } };
    const callModel = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce({ errorCode: 'AllocationQuota.FreeTierOnly' });
    const response = await handleWeeklyReportRequest(
      makeRequest({ facts: V2_FACTS }),
      deps({
        getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
        callModel,
      }),
    );

    expect(response.status).toBe(503);
    await expect(json(response)).resolves.toMatchObject({ diagnostic: 'qwen_free_tier_quota' });
  });

  test('strictly rejects V2 reports with invalid evidence, action codes, refs or leaked internal codes', async () => {
    const invalidReports = [
      { ...VALID_V2_REPORT, adherence: { ...VALID_V2_REPORT.adherence, evidence_ids: ['missing_evidence'] } },
      { ...VALID_V2_REPORT, actions: [{ ...VALID_V2_REPORT.actions[0], action_code: 'change_dosage' }] },
      { ...VALID_V2_REPORT, insights: [{ ...VALID_V2_REPORT.insights[0], related_medication_refs: ['med_99'] }] },
      { ...VALID_V2_REPORT, summary: 'no_upcoming_appointments' },
      { ...VALID_V2_REPORT, summary: '请关注 dueDoseCount 的记录。' },
      { ...VALID_V2_REPORT, summary: '请关注 med_1。' },
      { ...VALID_V2_REPORT, summary: '请关注 no_health_records。' },
      { ...VALID_V2_REPORT, summary: '建议 confirm_unrecorded_schedule。' },
    ];

    for (const report of invalidReports) {
      const response = await handleWeeklyReportRequest(
        makeRequest({ facts: V2_FACTS }),
        deps({
          getConfig: () => ({ enabled: true, evalMode: false, apiKey: 'server-only-key', baseUrl: 'https://example.test', model: 'qwen3.7-flash', promptVersion: 'v2' }),
          callModel: vi.fn(async () => report),
        })
      );
      expect(response.status).toBe(502);
    }
  });
});
