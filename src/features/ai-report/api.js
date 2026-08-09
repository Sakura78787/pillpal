import { weeklyFactsSchema, weeklyReportSchema } from './contracts.js';

const DEFAULT_TIMEOUT_MS = 30000;

const SERVER_ERROR_MESSAGES = {
  AI_WEEKLY_REPORT_NOT_CONFIGURED: 'AI 周报服务未完成生产配置，请稍后重试',
  AI_WEEKLY_REPORT_AUTH_REQUIRED: '登录状态已失效，请重新登录后生成周报',
  AI_WEEKLY_REPORT_INVALID_INPUT: '周报数据校验失败，请刷新页面后重试',
  AI_WEEKLY_REPORT_MODEL_UNAVAILABLE: 'AI 周报暂时不可用，请稍后重试',
  AI_WEEKLY_REPORT_GENERATION_FAILED: 'AI 周报生成失败，请稍后重试',
};

async function readServerError(response) {
  const fallback = 'AI 周报暂时不可用，请稍后重试';
  try {
    const payload = await response.json();
    return SERVER_ERROR_MESSAGES[payload?.code] || fallback;
  } catch {
    return fallback;
  }
}

export async function generateWeeklyReport({
  supabase,
  facts,
  promptVersion,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const factsResult = weeklyFactsSchema.safeParse(facts);
  if (!factsResult.success) {
    return { success: false, report: null, error: '周报数据不完整，请刷新后重试' };
  }

  const { data, error } = await supabase.auth.getSession();
  let accessToken = data?.session?.access_token;
  if (error || !accessToken) {
    return { success: false, report: null, error: '请先登录后再生成周报' };
  }

  if (typeof supabase.auth.refreshSession === 'function') {
    try {
      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed?.data?.session?.access_token;
      if (!refreshed?.error && refreshedToken) accessToken = refreshedToken;
    } catch {
      // Keep the current token; the server remains the authority on whether it is valid.
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = { facts: factsResult.data };
    if (promptVersion) body.promptVersion = promptVersion;

    const response = await fetchImpl('/api/ai/weekly-report', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { success: false, report: null, error: await readServerError(response) };
    }

    const payload = await response.json();
    const reportResult = weeklyReportSchema.safeParse(payload.report);
    if (!reportResult.success) {
      return { success: false, report: null, error: 'AI 周报返回格式异常，请稍后重试' };
    }

    return { success: true, report: reportResult.data };
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'AI 周报生成超时，请稍后重试'
      : 'AI 周报生成失败，请稍后重试';
    return { success: false, report: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
