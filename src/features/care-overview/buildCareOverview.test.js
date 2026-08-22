import { describe, expect, test } from 'vitest';
import { buildCareOverview } from './buildCareOverview.js';

const NOW = new Date(2026, 7, 4, 9, 0, 0);

const dailyMedication = {
  id: 'med-1',
  name: '仅本地展示的药名',
  status: 'active',
  frequency_type: 'daily',
  frequency_config: { dailyTimes: 1 },
  reminder_times: ['08:00'],
  start_date: '2026-07-29',
  dosage: 1,
  stock_quantity: 2,
  low_stock_threshold: 7,
};

describe('buildCareOverview', () => {
  test('summarizes the same seven-day facts used by the AI weekly report', () => {
    const overview = buildCareOverview({
      medications: [dailyMedication],
      medicationLogs: [
        { medication_id: 'med-1', scheduled_date: '2026-08-03', scheduled_time: '08:00', status: 'taken' },
        { medication_id: 'med-1', scheduled_date: '2026-08-02', scheduled_time: '08:00', status: 'skipped' },
      ],
      healthRecords: [
        { record_type: 'blood_pressure', recorded_at: '2026-08-03T01:00:00.000Z', values: { systolic: 120, diastolic: 80 } },
        { record_type: 'weight', recorded_at: '2026-08-04T01:00:00.000Z', values: { value: 50 } },
      ],
      appointments: [
        { appointment_date: '2026-08-06', status: 'scheduled' },
      ],
    }, NOW);

    expect(overview).toMatchObject({
      periodStart: '2026-07-29',
      periodEnd: '2026-08-04',
      metrics: {
        due: 7,
        taken: 1,
        skipped: 1,
        unrecorded: 5,
        lowStock: 1,
        healthRecords: 2,
        nextAppointmentInDays: 2,
      },
    });
  });

  test('keeps skipped and unrecorded separate and emits actions in a stable order', () => {
    const { actions } = buildCareOverview({
      medications: [dailyMedication],
      medicationLogs: [
        { medication_id: 'med-1', scheduled_date: '2026-08-02', scheduled_time: '08:00', status: 'skipped' },
      ],
      healthRecords: [],
      appointments: [{ appointment_date: '2026-08-07', status: 'scheduled' }],
    }, NOW);

    expect(actions.map((item) => item.code)).toEqual([
      'low_stock',
      'appointment_soon',
      'skipped_doses',
      'unrecorded_doses',
      'no_health_records',
    ]);
    expect(actions.find((item) => item.code === 'skipped_doses').description).toContain('明确标记跳过');
    expect(actions.find((item) => item.code === 'unrecorded_doses').description).toContain('待确认');
    expect(JSON.stringify(actions)).not.toContain('漏服');
    expect(JSON.stringify(actions)).not.toMatch(/异常|诊断|病情/);
  });

  test('shows a neutral fallback when no priority action exists', () => {
    const overview = buildCareOverview({
      medications: [{ ...dailyMedication, stock_quantity: 30 }],
      medicationLogs: Array.from({ length: 7 }, (_, index) => ({
        medication_id: 'med-1',
        scheduled_date: `2026-0${index < 3 ? '7' : '8'}-${String(index < 3 ? 29 + index : index - 2).padStart(2, '0')}`,
        scheduled_time: '08:00',
        status: 'taken',
      })),
      healthRecords: [
        { record_type: 'weight', recorded_at: '2026-08-04T01:00:00.000Z', values: { value: 50 } },
      ],
      appointments: [{ appointment_date: '2026-08-10', status: 'scheduled' }],
    }, NOW);

    expect(overview.actions).toEqual([{
      code: 'no_priority_actions',
      level: 'info',
      title: '本周暂无需要优先确认的事项',
      description: '可以按现有节奏继续关注记录情况。',
    }]);
  });

  test('empty data only reports missing context without medical inference', () => {
    const overview = buildCareOverview({}, NOW);

    expect(overview.metrics).toEqual({
      due: 0,
      taken: 0,
      skipped: 0,
      unrecorded: 0,
      lowStock: 0,
      healthRecords: 0,
      nextAppointmentInDays: null,
    });
    expect(overview.actions.map((item) => item.code)).toEqual(['no_health_records']);
    expect(JSON.stringify(overview)).not.toMatch(/异常|健康风险|漏服|病情/);
  });

  test('counts only blood pressure, blood sugar, and weight as care health records', () => {
    const overview = buildCareOverview({
      healthRecords: [
        { record_type: 'mood', recorded_at: '2026-08-03T01:00:00.000Z', values: { score: 4 } },
      ],
    }, NOW);

    expect(overview.metrics.healthRecords).toBe(0);
    expect(overview.actions.map((item) => item.code)).toContain('no_health_records');
  });
});
