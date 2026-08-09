import { describe, expect, test } from 'vitest';
import { buildHealthFacts } from './buildHealthFacts.js';

describe('buildHealthFacts', () => {
  test('keeps valid anonymous samples, caps each metric, and separates blood sugar timing', () => {
    const bloodPressure = Array.from({ length: 16 }, (_, index) => ({
      record_type: 'blood_pressure',
      recorded_at: `2026-08-${String(index + 1).padStart(2, '0')}T08:00:00+08:00`,
      values: { systolic: 120 + index, diastolic: 75 + index, heart_rate: 70 + index },
      note: 'private note',
    }));
    const result = buildHealthFacts([
      ...bloodPressure,
      { record_type: 'blood_sugar', recorded_at: '2026-08-08T08:00:00+08:00', values: { value: 5.8, timing: 'fasting' } },
      { record_type: 'blood_sugar', recorded_at: '2026-08-09T10:00:00+08:00', values: { value: 7.1, timing: 'post_meal' } },
      { record_type: 'weight', recorded_at: '2026-08-09T07:00:00+08:00', values: { value: 65, bmi: 22.1 } },
    ]);

    expect(result.samples.bloodPressure).toHaveLength(14);
    expect(result.totalCounts.bloodPressure).toBe(16);
    expect(result.sentCounts.bloodPressure).toBe(14);
    expect(result.trends.bloodSugar.fasting.count).toBe(1);
    expect(result.trends.bloodSugar.postMeal.count).toBe(1);
    expect(result.trends.bloodSugar).not.toHaveProperty('combinedDelta');
    expect(JSON.stringify(result)).not.toContain('private note');
  });

  test('drops non-positive and non-finite values and reports a data-quality gap', () => {
    const result = buildHealthFacts([
      { record_type: 'blood_pressure', recorded_at: '2026-08-09T08:00:00+08:00', values: { systolic: -1, diastolic: 80 } },
      { record_type: 'blood_sugar', recorded_at: '2026-08-09T08:00:00+08:00', values: { value: 'oops', timing: 'fasting' } },
      { record_type: 'weight', recorded_at: '2026-08-09T08:00:00+08:00', values: { value: 0 } },
    ]);

    expect(result.invalidRecordCount).toBe(3);
    expect(result.samples.bloodPressure).toEqual([]);
    expect(result.dataGapCodes).toContain('invalid_health_values_excluded');
  });
});
