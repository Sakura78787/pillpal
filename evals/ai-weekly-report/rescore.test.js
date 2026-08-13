import { describe, expect, test } from 'vitest';
import { rescoreV2Run } from './rescore.mjs';

const CASE = {
  id: 'v2-case',
  category: 'coordinated-care',
  facts: { evidence: { dueDoseCount: 1 } },
  requiredEvidenceIds: ['dueDoseCount'],
  requiresAction: true,
};

describe('V2 offline rescore', () => {
  test('recomputes grades and infers a repair for a final validation failure', () => {
    const rescored = rescoreV2Run({
      results: [{
        caseId: CASE.id,
        category: CASE.category,
        ok: false,
        status: 200,
        diagnostic: 'schema_invalid',
        latencyMs: 70000,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }],
    }, [CASE]);

    expect(rescored.scoringRevision).toBe('ai-weekly-report-graders-v2.2');
    expect(rescored.results[0]).toMatchObject({
      evalMeta: { modelCallCount: 2, repairTriggered: true },
      grade: { requestSuccess: false, modelCallCount: 2, repairTriggered: true },
    });
    expect(rescored.summary.jsonRepairRate).toBe(1);
  });
});
