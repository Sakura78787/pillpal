export type WeeklyReportFunctionConfig = {
  enabled: boolean;
  evalMode: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  promptVersion: 'v1' | 'v2';
  maxOutputTokens: number;
  requestTimeoutMs: number;
  backgroundRequestTimeoutMs: number;
  supabaseUrl: string;
  supabaseSecretKey: string;
};

const readEnv = (key: string): string => {
  const netlifyEnv = globalThis.Netlify?.env?.get?.(key);
  if (netlifyEnv !== undefined) return netlifyEnv;
  return process.env[key] || '';
};

const isTrue = (value: string) => value === 'true';

const readPositiveInt = (key: string, fallback: number): number => {
  const value = Number.parseInt(readEnv(key), 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

export function getWeeklyReportConfig(): WeeklyReportFunctionConfig {
  return {
    enabled: isTrue(readEnv('AI_WEEKLY_REPORT_ENABLED')),
    evalMode: isTrue(readEnv('AI_WEEKLY_REPORT_EVAL_MODE')),
    apiKey: readEnv('DASHSCOPE_API_KEY'),
    baseUrl: readEnv('QWEN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: readEnv('QWEN_MODEL') || 'qwen3.7-flash',
    promptVersion: readEnv('AI_WEEKLY_REPORT_PROMPT_VERSION') === 'v2' ? 'v2' : 'v1',
    maxOutputTokens: readPositiveInt('QWEN_MAX_OUTPUT_TOKENS', 1400),
    requestTimeoutMs: readPositiveInt('QWEN_REQUEST_TIMEOUT_MS', 45000),
    backgroundRequestTimeoutMs: readPositiveInt('QWEN_BACKGROUND_REQUEST_TIMEOUT_MS', 90000),
    supabaseUrl: readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL'),
    supabaseSecretKey: readEnv('SUPABASE_SECRET_KEY'),
  };
}
