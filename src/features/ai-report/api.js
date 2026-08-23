import { weeklyFactsSchema, weeklyReportSchema } from './contracts.js';
import { z } from 'zod';

// Keep the browser deadline below Netlify's 60-second synchronous function limit,
// while allowing the larger V2 structured response enough time to complete.
const DEFAULT_TIMEOUT_MS = 55000;

const SERVER_ERROR_MESSAGES = {
  AI_WEEKLY_REPORT_NOT_CONFIGURED: 'AI 周报服务未完成生产配置，请稍后重试',
  AI_WEEKLY_REPORT_AUTH_REQUIRED: '登录状态已失效，请重新登录后生成周报',
  AI_WEEKLY_REPORT_AUTH_SERVICE_UNAVAILABLE: '登录校验服务配置异常，请稍后重试',
  AI_WEEKLY_REPORT_INVALID_INPUT: '周报数据校验失败，请刷新页面后重试',
  AI_WEEKLY_REPORT_MODEL_UNAVAILABLE: 'AI 周报暂时不可用，请稍后重试',
  AI_WEEKLY_REPORT_GENERATION_FAILED: 'AI 周报生成失败，请稍后重试',
};

const DIAGNOSTIC_MESSAGES = {
  qwen_request_timeout: '模型响应超时，请稍后重试',
};

async function readServerError(response) {
  const fallback = 'AI 周报暂时不可用，请稍后重试';
  try {
    const payload = await response.json();
    if (DIAGNOSTIC_MESSAGES[payload?.diagnostic]) return DIAGNOSTIC_MESSAGES[payload.diagnostic];
    const message = SERVER_ERROR_MESSAGES[payload?.code] || fallback;
    return payload?.diagnostic ? `${message}（诊断码：${payload.diagnostic}）` : message;
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

const ASYNC_DIAGNOSTIC_MESSAGES = {
  qwen_request_timeout: '模型响应超时，请稍后重试',
  background_invocation_failed: '后台生成服务暂时不可用，请稍后重试',
  background_stalled: '后台生成任务中断，请重新生成',
  response_json_parse_failed: 'AI 返回内容不是有效 JSON，请重新生成',
  schema_invalid: 'AI 返回结构不完整，请重新生成',
  invalid_evidence_id: 'AI 引用了无效证据，请重新生成',
  invalid_medication_ref: 'AI 引用了无效药物标识，请重新生成',
  invalid_action_code: 'AI 返回了未授权行动，请重新生成',
  invalid_data_gap_code: 'AI 返回了无效数据缺口，请重新生成',
  internal_code_leakage: 'AI 文案包含内部代码，已停止展示',
  job_persistence_failed: '周报结果保存失败，请重新生成',
};

const diagnosticError = (diagnostic) => {
  const message = ASYNC_DIAGNOSTIC_MESSAGES[diagnostic] || 'AI 周报生成失败，请稍后重试';
  return diagnostic ? `${message}（错误编号：${diagnostic}）` : message;
};

const weeklyReportJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  report: weeklyReportSchema.optional(),
  errorCode: z.string().nullable().optional(),
  diagnostic: z.string().nullable().optional(),
  createdAt: z.string(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  expiresAt: z.string(),
});

const getToken = async (supabase, refresh = false) => {
  const { data, error } = refresh && typeof supabase.auth.refreshSession === 'function'
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();
  return error ? '' : data?.session?.access_token || '';
};

const authenticatedFetch = async ({ supabase, url, init, fetchImpl, refreshFirst = false }) => {
  let token = await getToken(supabase, refreshFirst);
  if (!token && refreshFirst) token = await getToken(supabase, false);
  if (!token) return null;
  const send = (accessToken) => fetchImpl(url, {
    ...init,
    headers: { ...(init?.headers || {}), authorization: `Bearer ${accessToken}` },
  });
  let response = await send(token);
  if (response.status === 401 && !refreshFirst) {
    const refreshed = await getToken(supabase, true);
    if (refreshed) response = await send(refreshed);
  }
  return response;
};

const readAsyncServerError = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (ASYNC_DIAGNOSTIC_MESSAGES[payload?.diagnostic]) return ASYNC_DIAGNOSTIC_MESSAGES[payload.diagnostic];
  if (payload?.code === 'AI_WEEKLY_REPORT_JOB_EXPIRED') return '周报任务已过期，请重新生成';
  if (payload?.code === 'AI_WEEKLY_REPORT_AUTH_REQUIRED') return '登录状态已失效，请重新登录';
  if (payload?.code === 'AI_WEEKLY_REPORT_INVALID_INPUT') return '周报数据校验失败，请刷新后重试';
  if (payload?.code === 'AI_WEEKLY_REPORT_NOT_CONFIGURED') return 'AI 周报服务尚未完成配置';
  return 'AI 周报暂时不可用，请稍后重试';
};

export async function startWeeklyReportJob({ supabase, facts, subjectUserId, fetchImpl = fetch }) {
  const factsResult = weeklyFactsSchema.safeParse(facts);
  if (!factsResult.success || !('dueDoseCount' in factsResult.data)) {
    return { success: false, job: null, error: '周报数据不完整，请刷新后重试' };
  }
  try {
    const response = await authenticatedFetch({
      supabase,
      url: '/api/ai/weekly-report/jobs',
      init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ facts: factsResult.data, ...(subjectUserId ? { subjectUserId } : {}) }) },
      fetchImpl,
      refreshFirst: true,
    });
    if (!response) return { success: false, job: null, error: '请先登录后再生成周报' };
    if (!response.ok) return { success: false, job: null, error: await readAsyncServerError(response) };
    const payload = await response.json();
    const parsedJob = weeklyReportJobSchema.safeParse(payload.job);
    if (!parsedJob.success) return { success: false, job: null, error: '周报任务创建失败，请稍后重试' };
    return { success: true, job: parsedJob.data, pollAfterMs: Number(payload.pollAfterMs) || 2000 };
  } catch {
    return { success: false, job: null, error: '周报任务创建失败，请稍后重试' };
  }
}

export async function getWeeklyReportJob({ supabase, jobId, fetchImpl = fetch }) {
  try {
    const response = await authenticatedFetch({
      supabase,
      url: `/api/ai/weekly-report/jobs/${encodeURIComponent(jobId)}`,
      init: { method: 'GET' },
      fetchImpl,
    });
    if (!response) return { success: false, job: null, error: '请先登录后再查看周报' };
    if (!response.ok) return {
      success: false,
      job: null,
      expired: response.status === 410,
      transient: response.status === 429 || response.status >= 500,
      error: await readAsyncServerError(response),
    };
    const payload = await response.json();
    const parsedJob = weeklyReportJobSchema.safeParse(payload.job);
    if (!parsedJob.success) return { success: false, job: null, error: '周报任务状态异常，请重新生成' };
    return { success: true, job: parsedJob.data };
  } catch {
    return { success: false, transient: true, job: null, error: '查询周报任务失败，请稍后重试' };
  }
}

const defaultSleep = (ms, signal) => new Promise((resolve) => {
  const timeout = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timeout); resolve(); }, { once: true });
});

export async function waitForWeeklyReportJob({
  jobId,
  getJob,
  pollIntervalMs = 2000,
  maxWaitMs = 180000,
  sleep = defaultSleep,
  now = Date.now,
  signal,
  onStatus,
}) {
  const startedAt = now();
  let lastJob = null;
  while (now() - startedAt < maxWaitMs && !signal?.aborted) {
    const result = await getJob(jobId);
    if (!result.success) {
      if (result.transient) {
        await sleep(pollIntervalMs, signal);
        continue;
      }
      return result;
    }
    lastJob = result.job;
    onStatus?.(lastJob.status);
    if (lastJob.status === 'succeeded') return { success: true, job: lastJob };
    if (lastJob.status === 'failed') {
      return { success: false, job: lastJob, error: diagnosticError(lastJob.diagnostic) };
    }
    await sleep(pollIntervalMs, signal);
  }
  if (signal?.aborted) return { success: false, cancelled: true, job: lastJob, error: '' };
  return { success: false, pending: true, job: lastJob, error: '任务仍在处理中，可稍后继续查看' };
}
