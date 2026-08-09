export type WeeklyReportFunctionConfig = {
  enabled: boolean;
  evalMode: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  promptVersion: 'v1' | 'v2';
};

const readEnv = (key: string): string => {
  const netlifyEnv = globalThis.Netlify?.env?.get?.(key);
  if (netlifyEnv !== undefined) return netlifyEnv;
  return process.env[key] || '';
};

const isTrue = (value: string) => value === 'true';

export function getWeeklyReportConfig(): WeeklyReportFunctionConfig {
  return {
    enabled: isTrue(readEnv('AI_WEEKLY_REPORT_ENABLED')),
    evalMode: isTrue(readEnv('AI_WEEKLY_REPORT_EVAL_MODE')),
    apiKey: readEnv('DASHSCOPE_API_KEY'),
    baseUrl: readEnv('QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: readEnv('QWEN_MODEL') || 'qwen3.7-flash',
    promptVersion: readEnv('AI_WEEKLY_REPORT_PROMPT_VERSION') === 'v2' ? 'v2' : 'v1',
  };
}
