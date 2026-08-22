import { describe, expect, test } from 'vitest';
import { weeklyReportReturnTarget } from './WeeklyReport.jsx';

describe('weekly report return navigation', () => {
  test('returns to care overview only when opened from care', () => {
    expect(weeklyReportReturnTarget('?from=care')).toBe('/care');
  });

  test('keeps the existing dashboard return target for all other entries', () => {
    expect(weeklyReportReturnTarget('')).toBe('/dashboard');
    expect(weeklyReportReturnTarget('?from=other')).toBe('/dashboard');
  });
});
