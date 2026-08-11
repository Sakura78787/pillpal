import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileText, HeartPulse, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const EVIDENCE_LABELS = {
  dueDoseCount: { label: '已到期计划', unit: '次' },
  takenDoseCount: { label: '已记录服用', unit: '次' },
  skippedDoseCount: { label: '明确跳过', unit: '次' },
  unrecordedDoseCount: { label: '未记录', unit: '次' },
  recordedTakenRate: { label: '记录口径完成比例', format: 'ratio' },
  recordedTakenRatePercent: { label: '记录口径完成比例', format: 'percent' },
  statusCoverageRate: { label: '状态覆盖比例', format: 'ratio' },
  statusCoverageRatePercent: { label: '状态覆盖比例', format: 'percent' },
  affectedDateCount: { label: '涉及日期', unit: '天' },
  maxConsecutiveUnrecordedDays: { label: '最长连续未记录', unit: '天' },
  time_morning_unrecorded: { label: '早晨未记录', unit: '次' },
  time_midday_unrecorded: { label: '中午未记录', unit: '次' },
  time_evening_unrecorded: { label: '晚间未记录', unit: '次' },
  time_other_unrecorded: { label: '其他时段未记录', unit: '次' },
  low_stock_medication_count: { label: '低库存药物', unit: '种' },
  next_appointment_in_days: { label: '距离复诊', unit: '天' },
  health_bloodPressure_count: { label: '血压记录', unit: '条' },
  health_bloodSugar_count: { label: '血糖记录', unit: '条' },
  health_weight_count: { label: '体重记录', unit: '条' },
};

const HEALTH_PHASE_LABELS = {
  earliest: '最早值', latest: '', min: '最低值', max: '最高值', delta: '变化值',
};

const evidenceDisplay = (id) => {
  if (EVIDENCE_LABELS[id]) return EVIDENCE_LABELS[id];

  const medication = id.match(/^med_\d+_(due|taken|skipped|unrecorded|stock_days)$/);
  if (medication) {
    const displays = {
      due: { label: '该药已到期计划', unit: '次' },
      taken: { label: '该药已记录服用', unit: '次' },
      skipped: { label: '该药明确跳过', unit: '次' },
      unrecorded: { label: '该药未记录', unit: '次' },
      stock_days: { label: '预计库存可用', unit: '天' },
    };
    return displays[medication[1]];
  }

  const bloodPressure = id.match(/^health_bp_(systolic|diastolic|heart_rate)_(earliest|latest|min|max|delta)$/);
  if (bloodPressure) {
    const metric = {
      systolic: ['收缩压', ' mmHg'],
      diastolic: ['舒张压', ' mmHg'],
      heart_rate: ['心率', '次/分钟'],
    }[bloodPressure[1]];
    const phase = HEALTH_PHASE_LABELS[bloodPressure[2]];
    return { label: `${metric[0]}${phase ? `（${phase}）` : ''}`, unit: metric[1] };
  }

  const bloodSugar = id.match(/^health_sugar_(fasting|post_meal|random)_(earliest|latest|min|max|delta)$/);
  if (bloodSugar) {
    const metric = { fasting: '空腹血糖', post_meal: '餐后血糖', random: '随机血糖' }[bloodSugar[1]];
    const phase = HEALTH_PHASE_LABELS[bloodSugar[2]];
    return { label: `${metric}${phase ? `（${phase}）` : ''}`, unit: ' mmol/L' };
  }

  const weight = id.match(/^health_weight_(earliest|latest|min|max|delta)$/);
  if (weight) {
    const phase = HEALTH_PHASE_LABELS[weight[1]];
    return { label: `体重${phase ? `（${phase}）` : ''}`, unit: ' kg' };
  }

  return { label: '相关数据' };
};

const valueText = (display, value) => {
  if (value === null || value === undefined) return '暂无';
  if (display.format === 'ratio') return `${Math.round(Number(value) * 100)}%`;
  if (display.format === 'percent') return `${Math.round(Number(value))}%`;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return `${value}${display.unit || ''}`;
};

const Evidence = ({ ids = [], facts }) => (
  <div className="mt-2 flex flex-wrap gap-2">
    {ids.map((id) => {
      const display = evidenceDisplay(id);
      return (
        <span key={id} className="rounded-full bg-white px-2 py-1 text-xs text-gray-500 ring-1 ring-gray-200">
          {display.label}：{valueText(display, facts?.evidence?.[id])}
        </span>
      );
    })}
  </div>
);

const MedicationTags = ({ refs = [], names = {} }) => refs.length ? (
  <div className="mt-2 flex flex-wrap gap-2">
    {refs.map((ref) => <span key={ref} className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{names[ref] || '相关药物'}</span>)}
  </div>
) : null;

const LegacyResult = ({ report }) => (
  <div className="space-y-4">
    <Card className="border-emerald-100"><CardHeader><CardTitle className="text-lg">本周概览</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-gray-700">{report.summary}</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-lg">重点关注</CardTitle></CardHeader><CardContent className="space-y-3">{report.highlights.map((item, index) => <div key={index} className="rounded-lg bg-gray-50 p-3 text-sm">{item.text}</div>)}</CardContent></Card>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{report.disclaimer}</div>
  </div>
);

const WeeklyReportResult = ({ report, facts, medicationNamesByRef = {} }) => {
  if (!report) return null;
  if (report.meta?.promptVersion !== 'v2') return <LegacyResult report={report} />;
  const adherence = [
    ['应服', facts?.dueDoseCount], ['已服', facts?.takenDoseCount], ['明确跳过', facts?.skippedDoseCount], ['未记录', facts?.unrecordedDoseCount],
  ];
  return (
    <div className="space-y-4">
      <Card className="border-emerald-100"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-emerald-600" />本周一句话结论</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-gray-700">{report.summary}</p></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="w-5 h-5 text-emerald-600" />用药计划记录情况</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{adherence.map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-semibold">{value ?? 0}</p></div>)}</div>
        <div><p className="font-medium text-gray-900">{report.adherence.headline}</p><p className="mt-1 text-sm leading-6 text-gray-600">{report.adherence.interpretation}</p><Evidence ids={report.adherence.evidence_ids} facts={facts} /></div>
        <p className="text-xs text-gray-500">记录口径完成比例：{facts?.recordedTakenRate == null ? '无法计算' : `${Math.round(facts.recordedTakenRate * 100)}%`}。未记录不等于确认漏服，可能是已服药但未打卡。</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-lg">本周最值得关注的事项</CardTitle></CardHeader><CardContent className="space-y-3">{report.insights.length ? report.insights.map((item, index) => <div key={index} className="rounded-lg bg-gray-50 p-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 w-4 h-4 text-emerald-600" /><div><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-gray-600">{item.detail}</p></div></div><MedicationTags refs={item.related_medication_refs} names={medicationNamesByRef} /><Evidence ids={item.evidence_ids} facts={facts} /></div>) : <p className="text-sm text-gray-500">本周暂未发现需要优先介入的事项。</p>}</CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><HeartPulse className="w-5 h-5 text-emerald-600" />健康指标趋势</CardTitle></CardHeader><CardContent className="space-y-3">{report.health_trends.length ? report.health_trends.map((item, index) => <div key={index} className="rounded-lg bg-gray-50 p-3"><p className="text-sm leading-6 text-gray-700">{item.summary}</p><Evidence ids={item.evidence_ids} facts={facts} /></div>) : <p className="text-sm text-gray-500">记录不足，暂不能形成趋势。</p>}</CardContent></Card>

      <Card className="border-emerald-100"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ListChecks className="w-5 h-5 text-emerald-600" />建议子女采取的行动</CardTitle></CardHeader><CardContent className="space-y-3">{report.actions.map((item, index) => <div key={index} className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4"><p className="font-medium text-gray-900">{index + 1}. {item.text}</p><p className="mt-1 text-sm leading-6 text-gray-600">{item.reason}</p><MedicationTags refs={item.related_medication_refs} names={medicationNamesByRef} /><Evidence ids={item.evidence_ids} facts={facts} /></div>)}</CardContent></Card>

      {report.data_gaps.length > 0 && <Card><CardHeader><CardTitle className="text-lg">数据局限</CardTitle></CardHeader><CardContent className="space-y-2">{report.data_gaps.map((gap, index) => <div key={index} className="flex gap-2 text-sm text-amber-700"><AlertTriangle className="mt-0.5 w-4 h-4" /><span>{gap.text}</span></div>)}</CardContent></Card>}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{report.disclaimer} AI 生成内容可能出错，请以原始记录为准。</div>
    </div>
  );
};

export default WeeklyReportResult;
