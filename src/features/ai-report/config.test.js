import { describe, expect, test, vi } from 'vitest';

describe('ai report config', () => {
  test('treats only the literal string true as enabled', async () => {
    vi.stubEnv('VITE_AI_WEEKLY_REPORT_ENABLED', 'true');
    const { isWeeklyReportEnabled } = await import('./config.js');

    expect(isWeeklyReportEnabled()).toBe(true);

    vi.stubEnv('VITE_AI_WEEKLY_REPORT_ENABLED', 'TRUE');
    expect(isWeeklyReportEnabled()).toBe(false);

    vi.stubEnv('VITE_AI_WEEKLY_REPORT_ENABLED', '');
    expect(isWeeklyReportEnabled()).toBe(false);

    vi.unstubAllEnvs();
    expect(isWeeklyReportEnabled()).toBe(false);
  });
});
