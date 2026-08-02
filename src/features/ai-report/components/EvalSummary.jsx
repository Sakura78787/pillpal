import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const percent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const metricRows = [
  ['结构合规率', 'schemaPassRate'],
  ['关键事实召回率', 'keyFactRecall'],
  ['证据 ID 有效率', 'evidenceValidityRate'],
  ['无证据数字声明率', 'unsupportedNumericClaimRate'],
  ['安全边界通过率', 'safetyPassRate'],
  ['请求成功率', 'requestSuccessRate'],
];

const hasPassedReleaseGate = (snapshot) => {
  const summary = snapshot?.runs?.v1?.summary || {};
  const gate = snapshot?.releaseGate || {};
  return (
    summary.schemaPassRate >= gate.schemaPassRate &&
    summary.safetyPassRate >= gate.safetyPassRate &&
    summary.requestSuccessRate >= gate.requestSuccessRate &&
    summary.keyFactRecall >= gate.minKeyFactRecall &&
    summary.unsupportedNumericClaimRate <= gate.maxUnsupportedNumericClaimRate &&
    (summary.failedCaseIds || []).length === 0
  );
};

const RunCard = ({ title, summary }) => (
  <Card className="border-slate-200 bg-white">
    <CardHeader className="pb-3">
      <CardTitle className="text-base text-slate-900">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {metricRows.map(([label, key]) => (
        <div key={key} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500">{label}</span>
          <span className="font-medium text-slate-900">{percent(summary?.[key])}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
        平均延迟 {Math.round(summary?.averageLatencyMs || 0)}ms · P95 {Math.round(summary?.p95LatencyMs || 0)}ms
      </div>
    </CardContent>
  </Card>
);

const BadCaseList = ({ cases = [] }) => {
  if (!cases.length) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
        V1 在当前评测快照中没有自动评测失败样本。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cases.map((item) => (
        <div key={item.caseId} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {item.caseId}
          </div>
          <div className="mt-2 text-xs text-amber-800">
            状态码 {item.status || 'n/a'} · 问题 {(item.issues || []).join(', ') || '无'}
          </div>
          {item.summary && <p className="mt-2 text-sm text-amber-900">{item.summary}</p>}
        </div>
      ))}
    </div>
  );
};

const EvalSummary = ({ snapshot }) => {
  const passed = hasPassedReleaseGate(snapshot);

  return (
    <div className="space-y-6">
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            AI 周报评测结果
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-slate-700 md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">数据集</div>
            <div className="font-medium">{snapshot.datasetVersion}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">模型</div>
            <div className="font-medium">{snapshot.model}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">样本数</div>
            <div className="font-medium">{snapshot.caseCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">发布门槛</div>
            <div className="flex items-center gap-1 font-medium">
              {passed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {passed ? '已通过' : '未通过'}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <RunCard title="Prompt V0" summary={snapshot.runs.v0.summary} />
        <RunCard title="Prompt V1" summary={snapshot.runs.v1.summary} />
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base text-slate-900">失败样本与 Bad Case 证据</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-slate-900">V0 失败样本</div>
            <BadCaseList cases={snapshot.runs.v0.badCases} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-900">V1 失败样本</div>
            <BadCaseList cases={snapshot.runs.v1.badCases} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base text-slate-900">能力边界说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            {(snapshot.notes || []).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvalSummary;
