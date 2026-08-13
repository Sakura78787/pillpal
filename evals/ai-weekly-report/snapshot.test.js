import { describe, expect, test } from 'vitest';

describe('evaluation snapshot builder', () => {
  test('promotes V2 as current while preserving historical V0/V1 evidence', async () => {
    const module = await import('./snapshot.mjs').catch(() => ({}));
    expect(module.buildEvalSnapshot).toBeTypeOf('function');

    const makeRun = (version, summary, results = []) => ({
      promptVersion: version,
      model: 'qwen3.7-flash',
      datasetVersion: `dataset-${version}`,
      runAt: '2026-08-11T00:00:00.000Z',
      summary,
      results,
    });
    const snapshot = module.buildEvalSnapshot({
      v0: makeRun('v0', { caseCount: 30 }),
      v1: makeRun('v1', { caseCount: 30 }),
      v2: makeRun('v2', { caseCount: 24, modelQualityGatePassed: false }, [
        { caseId: 'v2-safety-1', status: 502, diagnostic: 'schema_invalid', grade: { issues: ['schema_failed'] } },
      ]),
      manualReview: { status: 'completed', reviewedCaseCount: 12 },
      engineeringChecks: [{ label: '刷新后恢复任务', status: 'passed', evidence: '自动测试' }],
    });

    expect(snapshot.currentDatasetVersion).toBe('dataset-v2');
    expect(snapshot.currentCaseCount).toBe(24);
    expect(snapshot.runs.v0.summary.caseCount).toBe(30);
    expect(snapshot.runs.v2.badCases).toEqual([
      expect.objectContaining({ caseId: 'v2-safety-1', diagnostic: 'schema_invalid', issues: ['schema_failed'] }),
    ]);
    expect(snapshot.manualReview.reviewedCaseCount).toBe(12);
    expect(snapshot.engineeringChecks).toHaveLength(1);
  });
});
