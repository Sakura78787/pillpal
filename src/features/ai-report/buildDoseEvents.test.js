import { describe, expect, test } from 'vitest';
import { buildDoseEventFacts } from './buildDoseEvents.js';

const NOW = new Date(2026, 7, 9, 12, 0, 0);

const medication = (overrides = {}) => ({
  id: 'daily-med',
  name: '不应发送的药名',
  status: 'active',
  deleted_at: null,
  frequency_type: 'daily',
  frequency_config: { dailyTimes: 2 },
  reminder_times: ['08:00', '20:00'],
  start_date: '2026-08-03',
  end_date: null,
  dosage: 1,
  stock_quantity: 10,
  ...overrides,
});

describe('buildDoseEventFacts', () => {
  test('expands daily, weekly and interval plans while excluding future and custom doses', () => {
    const result = buildDoseEventFacts({
      medications: [
        medication(),
        medication({
          id: 'weekly-med',
          frequency_type: 'weekly',
          frequency_config: { weeklyDays: [1, 3] },
          reminder_times: ['09:00'],
        }),
        medication({
          id: 'interval-med',
          frequency_type: 'interval',
          frequency_config: { intervalDays: 2 },
          reminder_times: ['10:00'],
        }),
        medication({ id: 'custom-med', frequency_type: 'custom', reminder_times: [] }),
      ],
      medicationLogs: [],
      now: NOW,
      periodStart: '2026-08-03',
      periodEnd: '2026-08-09',
    });

    expect(result.dueDoseCount).toBe(13 + 2 + 4);
    expect(result.unrecordedDoseCount).toBe(result.dueDoseCount);
    expect(result.excludedCustomMedicationCount).toBe(1);
    expect(result.medicationSummaries.map((item) => item.ref)).toEqual(['med_1', 'med_2', 'med_3']);
    expect(JSON.stringify(result)).not.toContain('不应发送的药名');
  });

  test('classifies taken, skipped, unrecorded, conflicts and unmatched logs deterministically', () => {
    const result = buildDoseEventFacts({
      medications: [medication({ reminder_times: ['08:00'] })],
      medicationLogs: [
        { medication_id: 'daily-med', scheduled_date: '2026-08-03', scheduled_time: '08:00:00', status: 'taken' },
        { medication_id: 'daily-med', scheduled_date: '2026-08-04', scheduled_time: '08:00', status: 'skipped', skip_reason: 'forgot' },
        { medication_id: 'daily-med', scheduled_date: '2026-08-05', scheduled_time: '08:00', status: 'taken', feeling_score: 2 },
        { medication_id: 'daily-med', scheduled_date: '2026-08-05', scheduled_time: '08:00', status: 'skipped' },
        { medication_id: 'missing-med', scheduled_date: '2026-08-06', scheduled_time: '08:00', status: 'taken' },
      ],
      now: NOW,
      periodStart: '2026-08-03',
      periodEnd: '2026-08-09',
    });

    expect(result).toMatchObject({
      dueDoseCount: 7,
      takenDoseCount: 2,
      skippedDoseCount: 1,
      unrecordedDoseCount: 4,
      recordedTakenRate: 2 / 7,
      statusCoverageRate: 3 / 7,
      unmatchedLogCount: 1,
      conflictingLogCount: 1,
      feelingScoreCount: 1,
      lowFeelingScoreCount: 1,
      skipReasonCounts: { forgot: 1 },
    });
    expect(result.maxConsecutiveUnrecordedDays).toBe(4);
  });

  test('does not count a reminder later today as due', () => {
    const result = buildDoseEventFacts({
      medications: [medication({ reminder_times: ['08:00', '20:00'] })],
      medicationLogs: [],
      now: NOW,
      periodStart: '2026-08-09',
      periodEnd: '2026-08-09',
    });

    expect(result.dueDoseCount).toBe(1);
    expect(result.timeSlotStats.morning.due).toBe(1);
    expect(result.timeSlotStats.evening.due).toBe(0);
  });
});
