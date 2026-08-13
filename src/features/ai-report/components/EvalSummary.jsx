import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const percent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const baseMetricRows = [
  ['结构合规率', 'schemaPassRate'],
  ['关键事实召回率', 'keyFactRecall'],
  ['证据 ID 有效率', 'evidenceValidityRate'],
  ['无证据数字声明率', 'unsupportedNumericClaimRate'],
  ['安全边界通过率', 'safetyPassRate'],
  ['请求成功率', 'requestSuccessRate'],
];

const v2MetricRows = [
  ['已跳过/未记录区分率', 'skippedUnrecordedDistinctRate'],
  ['行动白名单通过率', 'actionAllowlistPassRate'],
  ['内部代码泄漏率', 'internalCodeLeakageRate'],
  ['行动覆盖率', 'actionCoverageRate'],
  ['JSON Repair 触发率', 'jsonRepairRate'],
];

const categoryLabels = {
  typical: '典型场景',
  adherence: '依从性场景',
  health: '健康场景',
  'coordinated-care': '家庭协同场景',
  safety: '安全场景',
};

const legacyGatePassed = (snapshot) => {
  const summary = snapshot?.runs?.v1?.summary || {};
  const gate = snapshot?.releaseGate || {};
  return summary.schemaPassRate >= gate.schemaPassRate
    && summary.safetyPassRate >= gate.safetyPassRate
    && summary.requestSuccessRate >= gate.requestSuccessRate
    && summary.keyFactRecall >= gate.minKeyFactRecall
    && summary.unsupportedNumericClaimRate <= gate.maxUnsupportedNumericClaimRate
    && (summary.failedCaseIds || []).length === 0;
};

const RunCard = ({ title, summary, current = false }) => {
  const rows = current ? [...baseMetricRows, ...v2MetricRows] : baseMetricRows;
  return (
    <Card className={current ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(([label, key]) => (
          <div key={key} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium text-slate-900">{percent(summary?.[key])}</span>
          </div>
        ))}
        {current && (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-500">平均模型调用次数</span>
            <span className="font-medium text-slate-900">{Number(summary?.averageModelCallCount || 0).toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
          平均延迟 {Math.round(summary?.averageLatencyMs || 0)}ms · P95 {Math.round(summary?.p95LatencyMs || 0)}ms
          {current ? '（只作观测，不作为同步发布门槛）' : ''}
        </div>
      </CardContent>
    </Card>
  );
};

const BadCaseList = ({ cases = [], emptyLabel = '当前快照中没有自动评测失败样本。' }) => {
  if (!cases.length) {
    return <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-3">
      {cases.map((item) => (
        <div key={item.caseId} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" />{item.caseId}
          </div>
          <div className="mt-2 text-xs text-amber-800">
            状态码 {item.status ?? 'n/a'} · 问题 {(item.issues || []).join(', ') || item.diagnostic || '无'}
          </div>
          {item.summary && <p className="mt-2 text-sm text-amber-900">{item.summary}</p>}
        </div>
      ))}
    </div>
  );
};

const EvalSummary = ({ snapshot }) => {
  const v2 = snapshot?.runs?.v2;
  const currentSummary = v2?.summary;
  const passed = v2 ? currentSummary?.modelQualityGatePassed === true : legacyGatePassed(snapshot);
  const categoryEntries = Object.entries(currentSummary?.categoryBreakdown || {});
  const manual = snapshot?.manualReview;
  const engineeringChecks = snapshot?.engineeringChecks || [];

  return (
    <div className="space-y-6">
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />AI 周报评测结果
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-slate-700 md:grid-cols-4">
          <div><div className="text-xs text-slate-500">当前数据集</div><div className="font-medium">{snapshot.currentDatasetVersion || snapshot.datasetVersion}</div></div>
          <div><div className="text-xs text-slate-500">模型</div><div className="font-medium">{snapshot.model}</div></div>
          <div><div className="text-xs text-slate-500">当前样本数</div><div className="font-medium">{snapshot.currentCaseCount || snapshot.caseCount}</div></div>
          <div>
            <div className="text-xs text-slate-500">模型质量发布门槛</div>
            <div className="flex items-center gap-1 font-medium">
              {passed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{passed ? '已通过' : '未通过'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader><CardTitle className="text-base text-slate-900">模型质量</CardTitle></CardHeader>
        <CardContent className={`grid gap-4 ${v2 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
          <RunCard title="Prompt V0 · 历史基线" summary={snapshot.runs.v0.summary} />
          <RunCard title="Prompt V1 · 历史基线" summary={snapshot.runs.v1.summary} />
          {v2 && <RunCard title="Prompt V2 · 当前生产版本" summary={currentSummary} current />}
        </CardContent>
      </Card>

      {categoryEntries.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle className="text-base text-slate-900">V2 分场景结果</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {categoryEntries.map(([category, summary]) => (
              <div key={category} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="font-medium text-slate-900">{categoryLabels[category] || category}</div>
                <div className="mt-1 text-xs text-slate-500">{summary.caseCount} 例 · 事实召回 {percent(summary.keyFactRecall)} · 安全 {percent(summary.safetyPassRate)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {manual && (
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle className="text-base text-slate-900">人工分层抽检</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              状态：{manual.status === 'completed' ? '已完成' : '待完成'} · 固定抽检 {manual.plannedCaseCount || 12} 例
              {manual.additionalBadCaseCount ? ` + 额外 Bad Case ${manual.additionalBadCaseCount} 例` : ''}
              {' '}· 共复核 {manual.reviewedCaseCount || 0} 例 · 四项全过 {manual.passedCaseCount || 0} 例
            </p>
            <ul className="list-disc space-y-1 pl-5">{(manual.rubric || []).map((item) => <li key={item}>{item}</li>)}</ul>
            {(manual.cases || []).some((item) => !item.passed) && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="font-medium text-slate-900">人工复核未通过案例</div>
                {(manual.cases || []).filter((item) => !item.passed).map((item) => (
                  <div key={item.caseId} className="rounded-lg bg-amber-50 p-3 text-amber-900">
                    <div className="font-medium">{item.caseId}</div>
                    <div className="mt-1 text-xs leading-5">{item.evidence}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {engineeringChecks.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle className="text-base text-slate-900">工程可靠性</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {engineeringChecks.map((item) => (
              <div key={item.label} className="flex flex-col justify-between gap-1 rounded-xl border border-slate-100 p-3 text-sm md:flex-row">
                <span className="font-medium text-slate-900">{item.label}</span>
                <span className="text-slate-500">{item.status === 'passed' ? '通过' : '待验证'} · {item.evidence}{item.detail ? ` · ${item.detail}` : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-white">
        <CardHeader><CardTitle className="text-base text-slate-900">失败样本与 Bad Case 证据</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {['v0', 'v1', ...(v2 ? ['v2'] : [])].map((version) => (
            <div key={version}>
              <div className="mb-2 text-sm font-medium uppercase text-slate-900">{version} 失败样本</div>
              <BadCaseList cases={snapshot.runs[version]?.badCases} emptyLabel={`${version.toUpperCase()} 在当前评测快照中没有自动评测失败样本。`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader><CardTitle className="text-base text-slate-900">能力边界说明</CardTitle></CardHeader>
        <CardContent><ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">{(snapshot.notes || []).map((note) => <li key={note}>{note}</li>)}</ul></CardContent>
      </Card>
    </div>
  );
};

export default EvalSummary;
