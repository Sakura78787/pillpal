import { buildWeeklyReportContext } from '@/features/ai-report/buildWeeklyFacts.js';

const action = (code, level, title, description) => ({ code, level, title, description });

export function buildCareOverview(sourceData = {}, now = new Date()) {
  const { facts } = buildWeeklyReportContext(sourceData, now);
  const healthRecords = ['bloodPressure', 'bloodSugar', 'weight']
    .reduce((total, key) => total + facts.healthRecordCounts[key], 0);
  const metrics = {
    due: facts.dueDoseCount,
    taken: facts.takenDoseCount,
    skipped: facts.skippedDoseCount,
    unrecorded: facts.unrecordedDoseCount,
    lowStock: facts.lowStockMedicationCount,
    healthRecords,
    nextAppointmentInDays: facts.nextAppointmentInDays,
  };
  const actions = [];

  if (metrics.lowStock > 0) {
    actions.push(action(
      'low_stock',
      'action',
      `${metrics.lowStock} 种药品库存偏低`,
      '建议与家人核对现有库存，并及时补充。'
    ));
  }
  if (metrics.nextAppointmentInDays != null && metrics.nextAppointmentInDays <= 3) {
    actions.push(action(
      'appointment_soon',
      'attention',
      `复诊还有 ${metrics.nextAppointmentInDays} 天`,
      '建议提前确认复诊时间，并准备所需材料。'
    ));
  }
  if (metrics.skipped > 0) {
    actions.push(action(
      'skipped_doses',
      'attention',
      `${metrics.skipped} 次明确标记跳过`,
      '建议了解明确标记跳过的原因，不对健康状况作推断。'
    ));
  }
  if (metrics.unrecorded > 0) {
    actions.push(action(
      'unrecorded_doses',
      'attention',
      `${metrics.unrecorded} 次记录待确认`,
      '这些记录仍待确认，建议先向家人了解实际情况。'
    ));
  }
  if (metrics.healthRecords === 0) {
    actions.push(action(
      'no_health_records',
      'info',
      '近 7 天暂无健康记录',
      '当前信息不足，仅提示记录缺口，不判断健康状况。'
    ));
  }
  if (actions.length === 0) {
    actions.push(action(
      'no_priority_actions',
      'info',
      '本周暂无需要优先确认的事项',
      '可以按现有节奏继续关注记录情况。'
    ));
  }

  return {
    periodStart: facts.periodStart,
    periodEnd: facts.periodEnd,
    metrics,
    actions,
  };
}
