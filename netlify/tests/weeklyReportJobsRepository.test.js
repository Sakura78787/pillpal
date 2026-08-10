import { describe, expect, test, vi } from 'vitest';
import { createWeeklyReportJobRepository } from '../functions/_shared/weeklyReportJobs.ts';

const zeroRowClient = () => {
  const query = {};
  for (const method of ['update', 'eq', 'in', 'select']) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  return { from: vi.fn(() => query), query };
};

describe('weekly report job repository', () => {
  test('complete rejects when the guarded update matches no running job', async () => {
    const client = zeroRowClient();
    const repository = createWeeklyReportJobRepository(client);

    await expect(repository.complete('job-1', 'user-1', {
      report: { summary: 'safe' }, inputTokens: 1, outputTokens: 2, modelDurationMs: 3, now: new Date(),
    })).rejects.toThrow('Weekly report job update matched no rows');
  });

  test('markFailed rejects when the guarded update matches no active job', async () => {
    const client = zeroRowClient();
    const repository = createWeeklyReportJobRepository(client);

    await expect(repository.markFailed('job-1', 'user-1', {
      errorCode: 'AI_WEEKLY_REPORT_GENERATION_FAILED', diagnostic: 'schema_invalid', now: new Date(),
    })).rejects.toThrow('Weekly report job update matched no rows');
  });
});
