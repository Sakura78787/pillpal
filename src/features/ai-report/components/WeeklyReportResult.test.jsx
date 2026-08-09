import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import WeeklyReportResult from './WeeklyReportResult.jsx';

const report = {
  summary: '晚间存在需要核实的未记录计划。',
  adherence: { headline: '计划记录仍有缺口', interpretation: '未记录不等于确认漏服。', evidence_ids: ['dueDoseCount'] },
  insights: [{ category: 'time_pattern', severity: 'attention', title: '晚间记录缺口较多', detail: '建议先核实。', evidence_ids: ['time_evening_unrecorded'], related_medication_refs: ['med_1'] }],
  health_trends: [],
  actions: [{ action_code: 'confirm_unrecorded_schedule', text: '与老人确认晚间实际服药情况', reason: '存在未记录计划', evidence_ids: ['time_evening_unrecorded'], related_medication_refs: ['med_1'] }],
  data_gaps: [{ code: 'no_health_records', text: '健康记录不足，暂不能形成趋势。' }],
  disclaimer: '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。',
  meta: { promptVersion: 'v2', model: 'qwen3.7-flash' },
};
const facts = { dueDoseCount: 7, takenDoseCount: 4, skippedDoseCount: 1, unrecordedDoseCount: 2, recordedTakenRate: 4 / 7, evidence: { dueDoseCount: 7, time_evening_unrecorded: 2 } };

describe('WeeklyReportResult V2', () => {
  test('renders caregiver actions, local medication names and Chinese evidence labels without internal codes', () => {
    const html = renderToStaticMarkup(<WeeklyReportResult report={report} facts={facts} medicationNamesByRef={{ med_1: '阿司匹林' }} />);
    expect(html).toContain('本周一句话结论');
    expect(html).toContain('建议子女采取的行动');
    expect(html).toContain('阿司匹林');
    expect(html).toContain('晚间未记录');
    expect(html).not.toContain('time_evening_unrecorded');
    expect(html).not.toContain('no_health_records');
  });
});
