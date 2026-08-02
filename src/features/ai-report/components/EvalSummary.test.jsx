import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import EvalSummary from './EvalSummary.jsx';

const snapshot = {
  datasetVersion: 'ai-weekly-report.synthetic.2026-08-02',
  model: 'qwen3.7-flash',
  caseCount: 30,
  releaseGate: {
    schemaPassRate: 1,
    safetyPassRate: 1,
    requestSuccessRate: 1,
    minKeyFactRecall: 0.9,
    maxUnsupportedNumericClaimRate: 1 / 30,
  },
  runs: {
    v0: {
      summary: {
        schemaPassRate: 0.9,
        keyFactRecall: 0.83,
        evidenceValidityRate: 0.9,
        unsupportedNumericClaimRate: 0.03,
        safetyPassRate: 1,
        requestSuccessRate: 0.9,
        averageLatencyMs: 20155,
        p95LatencyMs: 24206,
        failedCaseIds: ['typical-07'],
      },
      badCases: [
        {
          caseId: 'typical-07',
          status: 502,
          issues: ['schema_failed'],
          summary: null,
        },
      ],
    },
    v1: {
      summary: {
        schemaPassRate: 1,
        keyFactRecall: 0.96,
        evidenceValidityRate: 1,
        unsupportedNumericClaimRate: 0,
        safetyPassRate: 1,
        requestSuccessRate: 1,
        averageLatencyMs: 24044,
        p95LatencyMs: 28215,
        failedCaseIds: [],
      },
      badCases: [],
    },
  },
};

describe('EvalSummary', () => {
  test('renders V0 and V1 automatic metrics from a static snapshot', () => {
    const html = renderToStaticMarkup(<EvalSummary snapshot={snapshot} />);

    expect(html).toContain('qwen3.7-flash');
    expect(html).toContain('30');
    expect(html).toContain('V0');
    expect(html).toContain('V1');
    expect(html).toContain('AI 周报评测结果');
    expect(html).toContain('数据集');
    expect(html).toContain('模型');
    expect(html).toContain('样本数');
    expect(html).toContain('发布门槛');
    expect(html).toContain('结构合规率');
    expect(html).toContain('关键事实召回率');
    expect(html).toContain('90.0%');
    expect(html).toContain('100.0%');
    expect(html).not.toContain('AI Weekly Report Evaluation');
    expect(html).not.toContain('Schema Pass');
    expect(html).not.toContain('Key Fact Recall');
  });

  test('renders failed cases and release gate status without triggering live evaluation', () => {
    const html = renderToStaticMarkup(<EvalSummary snapshot={snapshot} />);

    expect(html).toContain('typical-07');
    expect(html).toContain('schema_failed');
    expect(html).toContain('发布门槛');
    expect(html).toContain('已通过');
    expect(html).toContain('失败样本与 Bad Case 证据');
  });
});
