import { describe, expect, test } from 'vitest';
import { buildSystemNotificationCandidates, medicationReminderText } from './buildNotificationCandidates.js';

const baseOverview = {
  periodEnd: '2026-08-23',
  metrics: { lowStock: 0, nextAppointmentInDays: null, unrecorded: 0 },
};

describe('buildSystemNotificationCandidates', () => {
  test('creates stable, non-medical system notifications from the care overview', () => {
    const result = buildSystemNotificationCandidates({
      ...baseOverview,
      metrics: { lowStock: 2, nextAppointmentInDays: 2, unrecorded: 3 },
    });

    expect(result).toEqual([
      expect.objectContaining({ type: 'low_stock', dedupeKey: 'low_stock:2026-08-23', link: '/inventory' }),
      expect.objectContaining({ type: 'appointment_soon', dedupeKey: 'appointment_soon:2026-08-23', link: '/appointments' }),
      expect.objectContaining({ type: 'record_pending', dedupeKey: 'record_pending:2026-08-23', link: '/logs' }),
    ]);
    expect(result[2].body).toContain('待确认');
    expect(result[2].body).not.toContain('漏服');
  });

  test('does not generate a health inference or empty notification', () => {
    expect(buildSystemNotificationCandidates(baseOverview)).toEqual([]);
  });
});

test('uses the fixed caregiver medication reminder copy', () => {
  expect(medicationReminderText()).toBe('家人提醒你按计划服药，请打开首页查看今日用药安排。');
});
