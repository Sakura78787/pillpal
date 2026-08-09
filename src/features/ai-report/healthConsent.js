export const HEALTH_CONSENT_KEY = 'pillpal.ai_weekly_report_health_consent.v1';

export const HEALTH_CONSENT_MESSAGE =
  '为生成健康趋势摘要，系统会将最近7天的血压、血糖和体重数值发送给千问模型处理；不会发送姓名、邮箱、药品名称、剂量、医院医生或备注。AI 结果仅用于信息整理，不构成医疗建议。\n\n是否同意并继续生成？';

export function ensureHealthDataConsent({
  storage = globalThis.localStorage,
  confirm = globalThis.confirm,
} = {}) {
  if (storage?.getItem(HEALTH_CONSENT_KEY) === 'granted') return true;
  if (typeof confirm !== 'function' || !confirm(HEALTH_CONSENT_MESSAGE)) return false;
  storage?.setItem(HEALTH_CONSENT_KEY, 'granted');
  return true;
}
