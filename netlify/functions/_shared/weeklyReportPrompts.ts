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
  "data_gaps": [{"code":"输入中的缺口代码","text":"面向用户的简体中文说明"}]
}`;

const allowedValues = (facts: any) => ({
  valid_evidence_ids: Object.keys(facts?.evidence || {}),
  valid_medication_refs: Array.isArray(facts?.medicationSummaries) ? facts.medicationSummaries.map((item: any) => item.ref) : [],
  valid_data_gap_codes: Array.isArray(facts?.dataGapCodes) ? facts.dataGapCodes : [],
  allowed_action_codes: WEEKLY_REPORT_ACTIONS.map((item) => item.action_code),
});

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
    '目标：从匿名事实中提炼最重要的模式和安全、可执行的家庭照护行动，不要重复罗列数字。',
    '口径：严格区分已服、明确跳过、未记录；未记录不等于确认漏服；记录完成情况不等于临床依从性。',
    '证据：所有结论和数字必须引用 facts.evidence 中存在的 evidence ID。',
    '输出：最多3条关键发现和3条行动并按重要性排序；summary 不超过120个汉字，其他文案简短且避免重复。',
    '行动：只能选择 user.allowed_actions，不得自行发明医疗行动。',
    '健康：只描述数值变化、记录频率和波动；不得判断病情、疗效、正常或异常，不得归因于药物。',
    '边界：不得诊断、开处方、修改剂量、建议停药换药或承诺结果。',
    '文案：仅用简体中文，用户文案不得出现内部英文代码；数据不足时说明局限，不得强行推断。',
    '字段：insights、health_trends、actions、data_gaps 必须始终存在，没有内容时也必须返回 []。',
    '内部代码：evidence ID、medication ref、data gap code、action code 只能出现在各自结构字段中，不能写入用户文案。',
    '服务端会补充固定免责声明和 meta，你不得返回 disclaimer 或 meta。',
    v2SchemaInstruction,
  ].join('\n');

  return [
    { role: 'system', content: v2System },
    { role: 'user', content: JSON.stringify({
      facts,
      allowed_actions: WEEKLY_REPORT_ACTIONS,
      ...allowedValues(facts),
      promptVersion: 'v2',
      model,
    }) },
  ];
}

export function buildWeeklyReportRepairMessages({
  facts,
  originalJson,
  diagnostic,
  path,
}: {
  facts: unknown;
  originalJson: string;
  diagnostic: string;
  path?: string;
}) {
  return [
    {
      role: 'system',
      content: [
        '你只负责修正上一份家庭照护周报 JSON 的结构与非法引用，不得增加新的事实、数字、判断或行动。',
        '必须保留原有安全边界：未记录不等于漏服；不得诊断、调整药物或判断指标正常异常。',
        '所有数组字段必须存在，没有内容时返回 []；只能使用用户消息提供的允许值。',
        '内部代码只能出现在对应结构字段，不得写入用户文案；只返回一个 JSON 对象。',
        '服务端会补充 disclaimer 和 meta，你不得返回这两个字段。',
        v2SchemaInstruction,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        facts,
        original_json: originalJson,
        validation_error: { diagnostic, ...(path ? { path } : {}) },
        ...allowedValues(facts),
      }),
    },
  ];
}
