import { describe, expect, test } from 'vitest';
import {
  FIXED_WEEKLY_REPORT_DISCLAIMER,
  buildWeeklyReportMessages,
  buildWeeklyReportRepairMessages,
} from '../functions/_shared/weeklyReportPrompts.ts';

const FACTS = {
  periodStart: '2026-07-27',
  periodEnd: '2026-08-02',
  recordedTakenCount: 2,
  recordedSkippedCount: 0,
  activeMedicationCount: 1,
  lowStockMedicationCount: 0,
  healthRecordCounts: {
    bloodPressure: 0,
    bloodSugar: 0,
    weight: 0,
    other: 0,
  },
  hasUpcomingAppointment: true,
  nextAppointmentInDays: 5,
  dataGapCodes: ['no_health_records'],
  evidence: {
    recorded_taken_count: 2,
    recorded_skipped_count: 0,
    active_medication_count: 1,
    low_stock_medication_count: 0,
    has_upcoming_appointment: true,
    next_appointment_in_days: 5,
  },
};

describe('weekly report prompt builder', () => {
  test('passes facts as structured JSON instead of a nested JSON string', () => {
    const messages = buildWeeklyReportMessages({
      facts: FACTS,
      promptVersion: 'v1',
      model: 'qwen3.7-flash',
    });

    const userPayload = JSON.parse(messages[1].content);

    expect(typeof userPayload.facts).toBe('object');
    expect(userPayload.facts.recordedTakenCount).toBe(2);
  });

  test('V1 tells the model not to invent appointment counts from appointment status', () => {
    const messages = buildWeeklyReportMessages({
      facts: FACTS,
      promptVersion: 'v1',
      model: 'qwen3.7-flash',
    });

    expect(messages[0].content).toContain('Do not turn appointment status into an appointment count');
  });

  test('includes the fixed disclaimer in the schema instruction', () => {
    const messages = buildWeeklyReportMessages({
      facts: FACTS,
      promptVersion: 'v1',
      model: 'qwen3.7-flash',
    });

    expect(messages[0].content).toContain(FIXED_WEEKLY_REPORT_DISCLAIMER);
  });

  test('V2 addresses adult children and constrains safe actions and medical claims', () => {
    const messages = buildWeeklyReportMessages({
      facts: FACTS,
      promptVersion: 'v2',
      model: 'qwen3.7-flash',
    });

    expect(messages[0].content).toContain('外出子女');
    expect(messages[0].content).toContain('未记录不等于确认漏服');
    expect(messages[0].content).toContain('不得判断病情');
    expect(messages[0].content).toContain('summary 不超过120个汉字');
    expect(messages[0].content.length).toBeLessThan(2200);
    const payload = JSON.parse(messages[1].content);
    expect(payload.allowed_actions.map((item) => item.action_code)).toContain('confirm_unrecorded_schedule');
    expect(payload.valid_evidence_ids).toEqual(Object.keys(FACTS.evidence));
    expect(payload.valid_medication_refs).toEqual([]);
    expect(payload.valid_data_gap_codes).toEqual(FACTS.dataGapCodes);
    expect(payload.allowed_action_codes).toContain('confirm_unrecorded_schedule');
    expect(messages[0].content).toContain('没有内容时也必须返回 []');
    expect(messages[0].content).not.toContain('"disclaimer"');
    expect(messages[0].content).not.toContain('"meta"');
  });

  test('V2 forbids unsupported causal explanations and requires a neutral unknown-cause statement', () => {
    const messages = buildWeeklyReportMessages({
      facts: FACTS,
      promptVersion: 'v2',
      model: 'qwen3.7-flash',
    });
    const repairMessages = buildWeeklyReportRepairMessages({
      facts: FACTS,
      originalJson: '{}',
      diagnostic: 'schema_invalid',
    });

    for (const content of [messages[0].content, repairMessages[0].content]) {
      expect(content).toContain('证据必须直接支持整句话');
      expect(content).toContain('即使使用“可能”也不允许');
      expect(content).toContain('当前记录无法判断原因，建议与老人核实实际情况');
      expect(content).toContain('外出');
      expect(content).toContain('忘记服药');
      expect(content).toContain('已经服药但未打卡');
    }
  });
});
