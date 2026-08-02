import { describe, expect, test } from 'vitest';
import { buildWeeklyFacts } from './buildWeeklyFacts.js';
import { weeklyFactsSchema } from './contracts.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

describe('buildWeeklyFacts', () => {
  test('builds anonymous weekly facts from the inclusive 7-day window', () => {
    const facts = buildWeeklyFacts(
      {
        medications: [
          {
            id: 'med-1',
            user_id: 'user-1',
            name: 'Secret Medicine A',
            status: 'active',
            stock_quantity: 3,
            low_stock_threshold: 7,
            deleted_at: null,
          },
          {
            id: 'med-2',
            name: 'Secret Medicine B',
            status: 'active',
            stock_quantity: 9,
            low_stock_threshold: 7,
          },
          {
            id: 'med-3',
            name: 'Deleted Medicine',
            status: 'deleted',
            stock_quantity: 1,
            low_stock_threshold: 7,
            deleted_at: '2026-08-01T00:00:00.000Z',
          },
        ],
        medicationLogs: [
          { id: 'log-start', scheduled_date: '2026-07-27', status: 'taken', deleted_at: null },
          { id: 'log-end', scheduled_date: '2026-08-02', status: 'skipped', note: 'private note' },
          { id: 'log-old', scheduled_date: '2026-07-26', status: 'taken' },
          { id: 'log-deleted', scheduled_date: '2026-08-01', status: 'taken', deleted_at: '2026-08-02T00:00:00.000Z' },
        ],
        healthRecords: [
          { id: 'bp-1', record_type: 'blood_pressure', recorded_at: '2026-07-27T00:00:00.000Z', values: { systolic: 120 } },
          { id: 'sugar-1', record_type: 'blood_sugar', recorded_at: '2026-08-02T23:59:59.000Z', values: { value: 6.1 } },
          { id: 'weight-1', record_type: 'weight', recorded_at: '2026-07-26T23:59:59.000Z', values: { value: 50 } },
          { id: 'other-1', record_type: 'mood', recorded_at: '2026-08-01T00:00:00.000Z', values: { score: 4 } },
          { id: 'deleted-health', record_type: 'weight', recorded_at: '2026-08-01T00:00:00.000Z', deleted_at: '2026-08-02T00:00:00.000Z' },
        ],
        appointments: [
          { id: 'appt-1', hospital_name: 'Secret Hospital', doctor_name: 'Secret Doctor', appointment_date: '2026-08-05', status: 'scheduled' },
          { id: 'appt-2', appointment_date: '2026-08-20', status: 'scheduled' },
          { id: 'appt-3', appointment_date: '2026-08-04', status: 'cancelled' },
        ],
      },
      NOW
    );

    expect(weeklyFactsSchema.parse(facts)).toEqual(facts);
    expect(facts.periodStart).toBe('2026-07-27');
    expect(facts.periodEnd).toBe('2026-08-02');
    expect(facts.recordedTakenCount).toBe(1);
    expect(facts.recordedSkippedCount).toBe(1);
    expect(facts.activeMedicationCount).toBe(2);
    expect(facts.lowStockMedicationCount).toBe(1);
    expect(facts.healthRecordCounts).toEqual({
      bloodPressure: 1,
      bloodSugar: 1,
      weight: 0,
      other: 1,
    });
    expect(facts.hasUpcomingAppointment).toBe(true);
    expect(facts.nextAppointmentInDays).toBe(3);
    expect(facts.dataGapCodes).toEqual([]);

    const serialized = JSON.stringify(facts);
    expect(serialized).not.toMatch(/user-1|Secret|med-1|log-start|bp-1|appt-1|120|6\.1|private note/);
    expect(facts).not.toHaveProperty('adherenceRate');
    expect(new Set(Object.keys(facts.evidence)).size).toBe(Object.keys(facts.evidence).length);
  });

  test('reports stable data gaps when there are no records', () => {
    const facts = buildWeeklyFacts({}, NOW);

    expect(facts.recordedTakenCount).toBe(0);
    expect(facts.recordedSkippedCount).toBe(0);
    expect(facts.activeMedicationCount).toBe(0);
    expect(facts.lowStockMedicationCount).toBe(0);
    expect(facts.healthRecordCounts).toEqual({
      bloodPressure: 0,
      bloodSugar: 0,
      weight: 0,
      other: 0,
    });
    expect(facts.hasUpcomingAppointment).toBe(false);
    expect(facts.nextAppointmentInDays).toBe(null);
    expect(facts.dataGapCodes).toEqual([
      'no_active_medications',
      'no_recorded_checkins',
      'no_health_records',
      'no_upcoming_appointments',
    ]);
  });
});
