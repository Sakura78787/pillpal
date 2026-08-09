import { expect, test, vi } from 'vitest';
import { generateWeeklyReport } from './api.js';

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
