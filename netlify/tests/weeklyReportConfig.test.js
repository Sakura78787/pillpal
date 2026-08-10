import { afterEach, describe, expect, test } from 'vitest';
import { getWeeklyReportConfig } from '../functions/_shared/weeklyReportConfig.ts';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('weekly report function config', () => {
  test('uses bounded defaults for Qwen output and request time', () => {
    delete process.env.QWEN_MAX_OUTPUT_TOKENS;
    delete process.env.QWEN_REQUEST_TIMEOUT_MS;
    delete process.env.QWEN_BACKGROUND_REQUEST_TIMEOUT_MS;

    const config = getWeeklyReportConfig();

    expect(config.maxOutputTokens).toBe(1400);
    expect(config.requestTimeoutMs).toBe(45000);
    expect(config.backgroundRequestTimeoutMs).toBe(90000);
  });

  test('reads valid Qwen output and request limits from environment variables', () => {
    process.env.QWEN_MAX_OUTPUT_TOKENS = '1200';
    process.env.QWEN_REQUEST_TIMEOUT_MS = '40000';
    process.env.QWEN_BACKGROUND_REQUEST_TIMEOUT_MS = '80000';

    const config = getWeeklyReportConfig();

    expect(config.maxOutputTokens).toBe(1200);
    expect(config.requestTimeoutMs).toBe(40000);
    expect(config.backgroundRequestTimeoutMs).toBe(80000);
  });
});
