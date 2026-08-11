import { expect, test, vi } from 'vitest';
import { generateWeeklyReport } from './api.js';
import { FIXED_WEEKLY_REPORT_DISCLAIMER } from './contracts.js';

const facts = {
  periodStart: '2026-08-03',
  periodEnd: '2026-08-09',
  recordedTakenCount: 1,
  recordedSkippedCount: 0,
  activeMedicationCount: 1,
  lowStockMedicationCount: 0,
  healthRecordCounts: { bloodPressure: 0, bloodSugar: 0, weight: 0, other: 0 },
  hasUpcomingAppointment: false,
  nextAppointmentInDays: null,
  dataGapCodes: [],
  evidence: { recorded_taken_count: 1 },
};

const supabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'token' } }, error: null })),
  },
};

test('surfaces the safe upstream diagnostic without exposing model payloads', async () => {
  const result = await generateWeeklyReport({
    supabase,
    facts,
    fetchImpl: vi.fn(async () => new Response(JSON.stringify({
      error: 'AI weekly report is temporarily unavailable',
      code: 'AI_WEEKLY_REPORT_MODEL_UNAVAILABLE',
      diagnostic: 'qwen_free_tier_quota',
    }), { status: 503 })),
  });

  expect(result.success).toBe(false);
  expect(result.error).toContain('qwen_free_tier_quota');
  expect(result.error).not.toContain('token');
});

test('shows a clear Chinese message for an upstream Qwen timeout', async () => {
  const result = await generateWeeklyReport({
    supabase,
    facts,
    fetchImpl: vi.fn(async () => new Response(JSON.stringify({
      error: 'AI weekly report generation failed',
      code: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
      diagnostic: 'qwen_request_timeout',
    }), { status: 502 })),
  });

  expect(result).toMatchObject({
    success: false,
    error: '模型响应超时，请稍后重试',
  });
});

test('allows a valid model response to complete after 30 seconds', async () => {
  vi.useFakeTimers();
  let requestSignal;
  const report = {
    summary: 'A valid delayed report.',
    highlights: [{ type: 'checkins', text: 'One check-in was recorded.', evidence_ids: ['recorded_taken_count'] }],
    data_gaps: [],
    disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER,
    meta: { promptVersion: 'v1', model: 'qwen3.7-flash' },
  };
  const fetchImpl = vi.fn((_url, init) => {
    requestSignal = init.signal;
    return new Promise((resolve, reject) => {
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      setTimeout(() => resolve(new Response(JSON.stringify({ report }), { status: 200 })), 35_000);
    });
  });

  try {
    const pending = generateWeeklyReport({ supabase, facts, fetchImpl });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(requestSignal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(4_999);
    await expect(pending).resolves.toMatchObject({ success: true, report });
  } finally {
    vi.useRealTimers();
  }
});
