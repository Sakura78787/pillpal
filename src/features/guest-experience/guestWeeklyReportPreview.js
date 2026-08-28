import { FIXED_WEEKLY_REPORT_DISCLAIMER } from '@/features/ai-report/contracts.js';

export const guestWeeklyReportPreviewFacts = {
  dueDoseCount: 7,
  takenDoseCount: 7,
  skippedDoseCount: 0,
  unrecordedDoseCount: 0,
  recordedTakenRate: 1,
  healthRecordCounts: { blood_pressure: 0, blood_sugar: 0, weight: 0 },
  evidence: {
    dueDoseCount: 7, takenDoseCount: 7, skippedDoseCount: 0, unrecordedDoseCount: 0,
    recordedTakenRate: 1, health_bloodPressure_count: 0, health_bloodSugar_count: 0,
    health_weight_count: 0, med_1_stock_days: 10, low_stock_medication_count: 0,
  },
};

export const guestWeeklyReportPreviewMedicationNames = { med_1: '示例降脂药' };

export const guestWeeklyReportPreview = {
  summary: '本周用药记录完整，示例库存预计可维持约 10 天；健康指标记录尚未补齐。',
  adherence: {
    headline: '示例用药记录完整',
    interpretation: '示例周内共安排 7 次，均记录为已服用。记录完成不等于临床依从性。',
    evidence_ids: ['dueDoseCount', 'takenDoseCount', 'recordedTakenRate'],
  },
  insights: [{
    category: 'data_quality', severity: 'attention', title: '示例健康指标记录缺失',
    detail: '该固定样例没有血压、血糖或体重记录，无法据此判断健康状态。',
    evidence_ids: ['health_bloodPressure_count', 'health_bloodSugar_count', 'health_weight_count'], related_medication_refs: [],
  }, {
    category: 'stock', severity: 'info', title: '示例库存需要关注',
    detail: '示例药物预计还有约 10 天用量，可提前规划补充。',
    evidence_ids: ['med_1_stock_days', 'low_stock_medication_count'], related_medication_refs: ['med_1'],
  }],
  health_trends: [],
  actions: [{
    action_code: 'continue_health_tracking', text: '补充日常健康指标记录',
    reason: '固定示例未包含健康指标记录。',
    evidence_ids: ['health_bloodPressure_count', 'health_bloodSugar_count', 'health_weight_count'], related_medication_refs: [],
  }, {
    action_code: 'check_stock', text: '核对库存和补充安排',
    reason: '固定示例药物预计还有约 10 天用量。',
    evidence_ids: ['med_1_stock_days'], related_medication_refs: ['med_1'],
  }],
  data_gaps: [{ code: 'no_health_records', text: '固定示例未包含健康指标记录，当前无法判断原因。' }],
  disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER,
  meta: { promptVersion: 'v2', model: 'qwen3.7-flash' },
};
