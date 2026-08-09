import { FIXED_WEEKLY_REPORT_DISCLAIMER } from '../../../src/features/ai-report/contracts.js';

export { FIXED_WEEKLY_REPORT_DISCLAIMER };

export const WEEKLY_REPORT_ACTIONS = [
  { action_code: 'confirm_unrecorded_schedule', description: '与老人确认未记录时段是否实际服药' },
  { action_code: 'review_skipped_reason', description: '了解明确跳过的原因' },
  { action_code: 'check_stock', description: '检查库存和补充安排' },
  { action_code: 'prepare_follow_up', description: '整理近期记录并准备复诊' },
  { action_code: 'continue_health_tracking', description: '继续补充健康指标记录' },
  { action_code: 'review_health_trend', description: '关注指标变化，有疑虑时咨询专业人员' },
] as const;

const v1SchemaInstruction = `
Return one JSON object only:
{
  "summary": "string",
  "highlights": [{"type": "string", "text": "string", "evidence_ids": ["string"]}],
  "data_gaps": ["string"],
  "disclaimer": "${FIXED_WEEKLY_REPORT_DISCLAIMER}",
  "meta": {"promptVersion": "v0 or v1", "model": "model id"}
}`;

const v2SchemaInstruction = `
只能返回一个 JSON 对象，字段必须完全遵循：
{
  "summary": "string",
  "adherence": {"headline":"string","interpretation":"string","evidence_ids":["string"]},
  "insights": [{"category":"adherence|time_pattern|stock|health|appointment|data_quality","severity":"info|attention|action","title":"string","detail":"string","evidence_ids":["string"],"related_medication_refs":["med_1"]}],
  "health_trends": [{"metric":"blood_pressure|blood_sugar|weight","summary":"string","evidence_ids":["string"]}],
  "actions": [{"action_code":"候选行动代码","text":"string","reason":"string","evidence_ids":["string"],"related_medication_refs":["med_1"]}],
  "data_gaps": [{"code":"输入中的缺口代码","text":"面向用户的简体中文说明"}],
  "disclaimer": "${FIXED_WEEKLY_REPORT_DISCLAIMER}",
  "meta": {"promptVersion":"v2","model":"model id"}
}`;

export function buildWeeklyReportMessages({ facts, promptVersion, model }: { facts: unknown; promptVersion: 'v0' | 'v1' | 'v2'; model: string }) {
  const baseSystem = [
    'You generate a weekly medication-management summary for a consumer health app.',
    'Use only the provided anonymous aggregate facts.',
    'Do not diagnose, prescribe, change dosage, promise outcomes, or infer disease status.',
    'Do not mention adherence rate because planned-dose events are incomplete.',
    'Numbers must come from the provided facts only.',
    v1SchemaInstruction,
  ].join('\n');
  const v1Additions = [
    'For every highlight, include at least one evidence_ids item that exists in facts.evidence.',
    'Prefer concrete recorded check-in counts, low-stock count, health-record count, upcoming appointment status, and data gaps.',
    'Do not turn appointment status into an appointment count; if only hasUpcomingAppointment is provided, say there is an upcoming appointment instead of saying there is 1 appointment.',
    'If a numeric value is not present in facts.evidence, do not write it as a number.',
    'Return the exact fixed disclaimer string shown in the schema.',
    'When data is sparse, say the record is insufficient instead of describing health control as good or bad.',
    'Keep the tone neutral, short, and non-medical.',
  ].join('\n');

  if (promptVersion !== 'v2') {
    return [
      { role: 'system', content: promptVersion === 'v1' ? `${baseSystem}\n${v1Additions}` : baseSystem },
      { role: 'user', content: JSON.stringify({ facts, promptVersion, model }) },
    ];
  }

  const v2System = [
    '你为慢病患者的外出子女生成一份家庭照护周报。',
    '你的任务不是罗列所有数字，而是根据匿名事实识别最值得关注的模式，并给出安全、具体、可执行的照护行动。',
    '必须区分“已服”“明确跳过”和“未记录”；未记录不等于确认漏服，可能是已经服药但没有打卡。',
    '“记录口径下的计划完成情况”不等同于临床意义上的真实用药依从性。',
    '所有结论和数字必须引用 facts.evidence 中存在的 evidence ID。',
    '最多输出3条关键发现和3条行动建议，并按重要性排序。',
    '行动只能从 user 消息中的 allowed_actions 选择，不得自行发明医疗行动。',
    '对健康指标只能描述数值变化、记录频率和波动；不得判断病情、疗效、正常或异常，不得归因于药物。',
    '不得诊断、开处方、修改剂量、建议停药换药或承诺结果。',
    '必须使用简体中文；title、detail、text、reason、summary 等用户文案禁止出现内部英文代码。',
    '数据不足时必须明确说明局限，不得强行得出结论。',
    v2SchemaInstruction,
  ].join('\n');

  return [
    { role: 'system', content: v2System },
    { role: 'user', content: JSON.stringify({ facts, allowed_actions: WEEKLY_REPORT_ACTIONS, promptVersion: 'v2', model }) },
  ];
}
