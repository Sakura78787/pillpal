import { weeklyFactsSchema, weeklyReportSchema } from './contracts.js';

const DEFAULT_TIMEOUT_MS = 30000;

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
  const accessToken = data?.session?.access_token;
  if (error || !accessToken) {
    return { success: false, report: null, error: '请先登录后再生成周报' };
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
      return { success: false, report: null, error: 'AI 周报暂时不可用，请稍后重试' };
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
