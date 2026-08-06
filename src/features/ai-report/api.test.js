import { describe, expect, test, vi } from 'vitest';
import { generateWeeklyReport } from './api.js';

const FACTS = {
  periodStart: '2026-07-27',
  periodEnd: '2026-08-02',
  recordedTakenCount: 1,
  recordedSkippedCount: 0,
  activeMedicationCount: 1,
  lowStockMedicationCount: 0,
  healthRecordCounts: {
    bloodPressure: 0,
    bloodSugar: 0,
    weight: 0,
    other: 0,
  },
  hasUpcomingAppointment: false,
  nextAppointmentInDays: null,
  dataGapCodes: ['no_health_records', 'no_upcoming_appointments'],
  evidence: {
    recorded_taken_count: 1,
  },
};

const REPORT = {
  summary: 'One recorded taken event this week.',
  highlights: [{ type: 'checkins', text: 'One taken event was recorded.', evidence_ids: ['recorded_taken_count'] }],
  data_gaps: ['No health records were recorded.'],
  disclaimer: '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。',
  meta: { promptVersion: 'v1', model: 'qwen3.7-flash' },
};

const supabaseWithToken = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'access-token' } }, error: null })),
  },
};

describe('generateWeeklyReport', () => {
  test('sends only validated facts with bearer authorization', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init.headers.authorization).toBe('Bearer access-token');
      expect(JSON.parse(init.body)).toEqual({ facts: FACTS });
      expect(init.body).not.toContain('access-token');
      return new Response(JSON.stringify({ report: REPORT }), { status: 200 });
    });

    const result = await generateWeeklyReport({ supabase: supabaseWithToken, facts: FACTS, fetchImpl });

    expect(result).toEqual({ success: true, report: REPORT });
    expect(fetchImpl).toHaveBeenCalledWith('/api/ai/weekly-report', expect.any(Object));
  });

  test('fails when there is no authenticated session', async () => {
    const result = await generateWeeklyReport({
      supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } },
      facts: FACTS,
      fetchImpl: vi.fn(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('请先登录后再生成周报');
  });

  test('fails on non-2xx, timeout, and invalid response schema', async () => {
    await expect(
      generateWeeklyReport({
        supabase: supabaseWithToken,
        facts: FACTS,
        fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: 'nope' }), { status: 503 })),
      })
    ).resolves.toMatchObject({ success: false });

    await expect(
      generateWeeklyReport({
        supabase: supabaseWithToken,
        facts: FACTS,
        fetchImpl: vi.fn(async () => new Response(JSON.stringify({ report: { summary: 'bad' } }), { status: 200 })),
      })
    ).resolves.toMatchObject({ success: false });

    await expect(
      generateWeeklyReport({
        supabase: supabaseWithToken,
        facts: FACTS,
        timeoutMs: 1,
        fetchImpl: vi.fn((_url, init) => {
          init.signal.dispatchEvent(new Event('abort'));
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }),
      })
    ).resolves.toMatchObject({ success: false });
  });

  test('maps safe server diagnostic codes to user-facing messages', async () => {
    await expect(
      generateWeeklyReport({
        supabase: supabaseWithToken,
        facts: FACTS,
        fetchImpl: vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: 'AI weekly report is temporarily unavailable',
              code: 'AI_WEEKLY_REPORT_NOT_CONFIGURED',
            }),
            { status: 503 }
          )
        ),
      })
    ).resolves.toMatchObject({
      success: false,
      error: 'AI 周报服务未完成生产配置，请稍后重试',
    });

    await expect(
      generateWeeklyReport({
        supabase: supabaseWithToken,
        facts: FACTS,
        fetchImpl: vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: 'AI weekly report generation failed',
              code: 'AI_WEEKLY_REPORT_GENERATION_FAILED',
            }),
            { status: 502 }
          )
        ),
      })
    ).resolves.toMatchObject({
      success: false,
      error: 'AI 周报生成失败，请稍后重试',
    });
  });
});
