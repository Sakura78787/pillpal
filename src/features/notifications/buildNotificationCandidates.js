export const medicationReminderText = () => '家人提醒你按计划服药，请打开首页查看今日用药安排。';

const candidate = (type, dedupeKey, title, body, link) => ({
  type,
  dedupeKey,
  title,
  body,
  link,
});

export function buildSystemNotificationCandidates(overview = {}) {
  const periodEnd = overview.periodEnd;
  const metrics = overview.metrics || {};
  if (!periodEnd) return [];

  const candidates = [];
  if (Number(metrics.lowStock) > 0) {
    candidates.push(candidate(
      'low_stock',
      `low_stock:${periodEnd}`,
      '药品库存需要关注',
      `有 ${metrics.lowStock} 种药品库存偏低，建议及时核对并补充。`,
      '/inventory'
    ));
  }
  if (metrics.nextAppointmentInDays != null && Number(metrics.nextAppointmentInDays) <= 3) {
    const days = Number(metrics.nextAppointmentInDays);
    candidates.push(candidate(
      'appointment_soon',
      `appointment_soon:${periodEnd}`,
      days === 0 ? '今天有复诊安排' : `复诊还有 ${days} 天`,
      '建议提前确认复诊时间，并准备所需材料。',
      '/appointments'
    ));
  }
  if (Number(metrics.unrecorded) > 0) {
    candidates.push(candidate(
      'record_pending',
      `record_pending:${periodEnd}`,
      '用药记录待确认',
      `近 7 天有 ${metrics.unrecorded} 次计划剂次待确认，建议核对实际情况。`,
      '/logs'
    ));
  }
  return candidates;
}
