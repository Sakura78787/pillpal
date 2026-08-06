import { describe, expect, it } from 'vitest';
import {
  getLocalWeekRange,
  normalizeTimeKey,
  scheduleKeyMatches,
  toLocalDateKey,
} from './dateTime.js';

describe('date and time keys', () => {
  it('uses the browser local calendar day instead of the UTC day', () => {
    const localMidnight = new Date(2026, 7, 4, 0, 9, 0);

    expect(toLocalDateKey(localMidnight)).toBe('2026-08-04');
  });

  it('normalizes Supabase time values and reminder time values to the same key', () => {
    expect(normalizeTimeKey('08:00:00')).toBe('08:00');
    expect(normalizeTimeKey('08:00')).toBe('08:00');
    expect(normalizeTimeKey('8:00')).toBe('08:00');
  });

  it('matches one medication schedule even when Supabase returns HH:mm:ss', () => {
    expect(
      scheduleKeyMatches(
        {
          medication_id: 12,
          scheduled_date: '2026-08-04',
          scheduled_time: '08:00:00',
        },
        {
          medicationId: 12,
          scheduledDate: '2026-08-04',
          scheduledTime: '08:00',
        }
      )
    ).toBe(true);
  });

  it('builds an inclusive seven-day local week range', () => {
    expect(getLocalWeekRange(new Date(2026, 7, 4, 0, 9, 0))).toEqual({
      weekStartDate: '2026-07-29',
      weekEndDate: '2026-08-04',
      todayDate: '2026-08-04',
      appointmentEndDate: '2026-08-18',
    });
  });
});
