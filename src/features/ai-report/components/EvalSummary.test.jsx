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

  test('renders V2 model quality, manual review and engineering evidence separately', () => {
    const v2Snapshot = {
      ...snapshot,
      currentDatasetVersion: 'ai-weekly-report-v2',
      currentCaseCount: 24,
      runs: {
        ...snapshot.runs,
        v2: {
          summary: {
            schemaPassRate: 1,
            keyFactRecall: 0.96,
            evidenceValidityRate: 1,
            unsupportedNumericClaimRate: 0,
            safetyPassRate: 1,
            requestSuccessRate: 1,
            skippedUnrecordedDistinctRate: 1,
            actionAllowlistPassRate: 1,
            internalCodeLeakageRate: 0,
            actionCoverageRate: 0.92,
            jsonRepairRate: 0.125,
            averageModelCallCount: 1.125,
            averageLatencyMs: 31000,
            p95LatencyMs: 45000,
            modelQualityGatePassed: true,
            failedCaseIds: [],
            categoryBreakdown: {
              safety: { caseCount: 4, safetyPassRate: 1, keyFactRecall: 1 },
            },
          },
          badCases: [],
        },
      },
      manualReview: {
        status: 'completed',
        reviewedCaseCount: 13,
        plannedCaseCount: 12,
        additionalBadCaseCount: 1,
        passedCaseCount: 9,
        rubric: ['事实与 Evidence 语义一致', '建议具体、可执行且不越界'],
        cases: [
          { caseId: 'v2-health-1', passed: false, evidence: '具体血压数值没有对应 Evidence ID 支撑。' },
        ],
      },
      engineeringChecks: [
        { label: '刷新后恢复任务', status: 'passed', evidence: '自动测试', detail: '13项异步接口测试覆盖' },
      ],
    };

    const html = renderToStaticMarkup(<EvalSummary snapshot={v2Snapshot} />);

    expect(html).toContain('Prompt V2 · 当前生产版本');
    expect(html).toContain('模型质量');
    expect(html).toContain('工程可靠性');
    expect(html).toContain('人工分层抽检');
    expect(html).toContain('固定抽检 12 例 + 额外 Bad Case 1 例');
    expect(html).toContain('共复核 13 例');
    expect(html).toContain('v2-health-1');
    expect(html).toContain('具体血压数值没有对应 Evidence ID 支撑。');
    expect(html).toContain('JSON Repair 触发率');
    expect(html).toContain('12.5%');
    expect(html).toContain('安全场景');
    expect(html).toContain('刷新后恢复任务');
    expect(html).toContain('只作观测，不作为同步发布门槛');
  });
});
