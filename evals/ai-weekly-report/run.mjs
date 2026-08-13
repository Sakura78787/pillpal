import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeReport, summarizeGrades } from './graders.mjs';
import { V2_CASES } from './cases-v2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_PATH = path.join(__dirname, 'cases.json');
const RESULTS_DIR = path.join(__dirname, 'results');
const REQUEST_DELAY_MS = 7000;
const MAX_TRANSIENT_RETRIES = 3;
const NON_RETRYABLE_DIAGNOSTICS = new Set([
  'response_json_parse_failed',
  'schema_invalid',
  'invalid_evidence_id',
  'invalid_medication_ref',
  'invalid_action_code',
  'invalid_data_gap_code',
  'internal_code_leakage',
  'qwen_free_tier_quota',
]);
const TRANSIENT_ASYNC_DIAGNOSTICS = new Set([
  'qwen_request_timeout',
  'qwen_request_failed',
  'qwen_http_error',
  'qwen_rate_limited',
  'qwen_burst_rate_limited',
  'qwen_repair_request_timeout',
  'qwen_repair_request_failed',
  'repair_qwen_http_error',
  'repair_qwen_rate_limited',
  'repair_qwen_burst_rate_limited',
]);

const parsePromptVersion = () => {
  const promptArg = process.argv.find((arg) => arg.startsWith('--prompt='));
  const promptVersion = promptArg?.split('=')[1] || 'v1';
  if (!['v0', 'v1', 'v2'].includes(promptVersion)) {
    throw new Error('Prompt must be v0, v1 or v2');
  }
  return promptVersion;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_ASYNC_MAX_WAIT_MS = 3 * 60 * 1000;

const normalizeUsage = (usage = {}) => {
  const inputTokens = Number(usage.inputTokens || usage.prompt_tokens || 0);
  const outputTokens = Number(usage.outputTokens || usage.completion_tokens || 0);
  const totalTokens = Number(usage.totalTokens || usage.total_tokens || inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
};

export async function runCase({ endpoint, accessToken, promptVersion, caseItem }) {
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        facts: caseItem.facts,
        promptVersion,
      }),
    });
  } catch {
    const latencyMs = Date.now() - startedAt;
    return {
      caseId: caseItem.id,
      category: caseItem.category,
      ok: false,
      status: null,
      diagnostic: 'network_error',
      latencyMs,
      usage: normalizeUsage(),
      grade: gradeReport(caseItem, { summary: 'request failed' }, { success: false, latencyMs }),
    };
  }

  const latencyMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));
  const usage = normalizeUsage(payload.usage);

  if (!response.ok) {
    return {
      caseId: caseItem.id,
      category: caseItem.category,
      ok: false,
      status: response.status,
      code: payload.code || null,
      diagnostic: payload.diagnostic || null,
      latencyMs,
      usage,
      grade: gradeReport(caseItem, { summary: 'request failed' }, {
        success: false,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }),
    };
  }

  const grade = gradeReport(caseItem, payload.report, {
    success: true,
    latencyMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    modelCallCount: payload.evalMeta?.modelCallCount,
    repairTriggered: payload.evalMeta?.repairTriggered,
  });

  return {
    caseId: caseItem.id,
    category: caseItem.category,
    ok: true,
    status: response.status,
    latencyMs,
    usage,
    evalMeta: payload.evalMeta || null,
    report: payload.report,
    grade,
  };
}

export async function runAsyncCase({
  endpoint,
  accessToken,
  caseItem,
  fetchImpl = fetch,
  sleepImpl = sleep,
  now = Date.now,
  maxWaitMs = DEFAULT_ASYNC_MAX_WAIT_MS,
}) {
  const startedAt = now();
  const headers = {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
  const failed = ({ status = null, code = null, diagnostic = null, evalMeta = null }) => {
    const latencyMs = Math.max(0, now() - startedAt);
    const usage = normalizeUsage(evalMeta || {});
    return {
      caseId: caseItem.id,
      category: caseItem.category,
      ok: false,
      status,
      code,
      diagnostic,
      latencyMs,
      usage,
      ...(evalMeta ? { evalMeta } : {}),
      grade: gradeReport(caseItem, { summary: 'request failed' }, {
        success: false,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        modelCallCount: evalMeta?.modelCallCount,
        repairTriggered: evalMeta?.repairTriggered,
      }),
    };
  };

  let createResponse;
  try {
    createResponse = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ facts: caseItem.facts }),
    });
  } catch {
    return failed({ diagnostic: 'network_error' });
  }
  const createPayload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    return failed({
      status: createResponse.status,
      code: createPayload.code || null,
      diagnostic: createPayload.diagnostic || null,
    });
  }
  const jobId = createPayload?.job?.id;
  if (!jobId) return failed({ status: createResponse.status, diagnostic: 'job_id_missing' });

  const pollAfterMs = Math.max(1, Number(createPayload.pollAfterMs) || 2000);
  let transientPollFailureCount = 0;
  while (now() - startedAt < maxWaitMs) {
    await sleepImpl(pollAfterMs);
    let pollResponse;
    try {
      pollResponse = await fetchImpl(`${endpoint}/${encodeURIComponent(jobId)}`, { method: 'GET', headers });
    } catch {
      transientPollFailureCount += 1;
      continue;
    }
    const payload = await pollResponse.json().catch(() => ({}));
    if (!pollResponse.ok) {
      if (pollResponse.status === 429 || pollResponse.status >= 500) {
        transientPollFailureCount += 1;
        continue;
      }
      return failed({
        status: pollResponse.status,
        code: payload.code || null,
        diagnostic: payload.diagnostic || null,
      });
    }
    const job = payload.job || {};
    if (job.status === 'queued' || job.status === 'running') continue;
    const latencyMs = Math.max(0, now() - startedAt);
    const evalMeta = job.evalMeta
      ? { ...job.evalMeta, transientPollFailureCount }
      : { modelCallCount: 1, repairTriggered: false, transientPollFailureCount };
    const usage = normalizeUsage(evalMeta);
    if (job.status === 'failed') {
      return failed({
        status: pollResponse.status,
        code: job.errorCode || null,
        diagnostic: job.diagnostic || null,
        evalMeta,
      });
    }
    if (job.status !== 'succeeded' || !job.report) {
      return failed({ status: pollResponse.status, diagnostic: 'job_status_invalid', evalMeta });
    }
    const grade = gradeReport(caseItem, job.report, {
      success: true,
      latencyMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      modelCallCount: evalMeta.modelCallCount,
      repairTriggered: evalMeta.repairTriggered,
    });
    return {
      caseId: caseItem.id,
      category: caseItem.category,
      ok: true,
      status: pollResponse.status,
      latencyMs,
      usage,
      evalMeta,
      report: job.report,
      grade,
    };
  }
  return failed({ status: 408, diagnostic: 'background_stalled' });
}

const isTransientFailure = (result) => {
  if (result?.ok) return false;
  if (TRANSIENT_ASYNC_DIAGNOSTICS.has(result?.diagnostic)) return true;
  if (result?.diagnostic === 'network_error' || result?.status === 429) return true;
  if (typeof result?.status !== 'number' || result.status < 500) return false;
  if (result?.code === 'AI_WEEKLY_REPORT_NOT_CONFIGURED') return false;
  return !NON_RETRYABLE_DIAGNOSTICS.has(result?.diagnostic);
};

export const normalizeV2Endpoint = (endpoint) => {
  const normalized = endpoint.replace(/\/+$/, '');
  return normalized.endsWith('/jobs') ? normalized : `${normalized}/jobs`;
};

export async function runCaseWithRetry({
  execute,
  retryBudget,
  sleepImpl = sleep,
  retryDelayMs = REQUEST_DELAY_MS,
}) {
  const first = await execute();
  if (!isTransientFailure(first) || retryBudget.remaining <= 0) {
    return { ...first, attemptCount: 1, retried: false };
  }
  retryBudget.remaining -= 1;
  await sleepImpl(retryDelayMs);
  const second = await execute();
  return {
    ...second,
    attemptCount: 2,
    retried: true,
    initialFailure: {
      status: first.status ?? null,
      code: first.code || null,
      diagnostic: first.diagnostic || null,
    },
  };
}

export async function main() {
  const promptVersion = parsePromptVersion();
  const endpoint = process.env.PILLPAL_EVAL_ENDPOINT;
  const accessToken = process.env.PILLPAL_EVAL_ACCESS_TOKEN;

  if (!endpoint || !accessToken) {
    console.error('Missing PILLPAL_EVAL_ENDPOINT or PILLPAL_EVAL_ACCESS_TOKEN.');
    console.error('No requests were sent.');
    process.exitCode = 2;
    return;
  }

  const cases = promptVersion === 'v2' ? V2_CASES : JSON.parse(await fs.readFile(CASES_PATH, 'utf8'));
  const caseEndpoint = promptVersion === 'v2' ? normalizeV2Endpoint(endpoint) : endpoint;
  const results = [];
  const retryBudget = { remaining: MAX_TRANSIENT_RETRIES };

  for (const [index, caseItem] of cases.entries()) {
    console.log(`[${index + 1}/${cases.length}] ${caseItem.id}`);
    results.push(await runCaseWithRetry({
      execute: () => promptVersion === 'v2'
        ? runAsyncCase({ endpoint: caseEndpoint, accessToken, caseItem })
        : runCase({ endpoint: caseEndpoint, accessToken, promptVersion, caseItem }),
      retryBudget,
    }));
    if (index < cases.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  const grades = results.map((result) => result.grade);
  const output = {
    promptVersion,
    model: 'qwen3.7-flash',
    datasetVersion: promptVersion === 'v2' ? 'ai-weekly-report-v2' : 'ai-weekly-report-v1',
    evaluationProtocolVersion: 'ai-weekly-report-eval-v2.1',
    retryPolicy: {
      maxTransientRetriesAcrossRun: MAX_TRANSIENT_RETRIES,
      retriesUsed: MAX_TRANSIENT_RETRIES - retryBudget.remaining,
      contentFailuresRetried: false,
    },
    runAt: new Date().toISOString(),
    summary: summarizeGrades(grades),
    results,
  };

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(RESULTS_DIR, `${promptVersion}.json`),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8'
  );

  console.log(JSON.stringify(output.summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.message || 'Evaluation runner failed.');
    process.exitCode = 1;
  });
}
