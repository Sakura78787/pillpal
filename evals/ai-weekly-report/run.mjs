import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeReport, summarizeGrades } from './graders.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_PATH = path.join(__dirname, 'cases.json');
const RESULTS_DIR = path.join(__dirname, 'results');
const REQUEST_DELAY_MS = 7000;

const parsePromptVersion = () => {
  const promptArg = process.argv.find((arg) => arg.startsWith('--prompt='));
  const promptVersion = promptArg?.split('=')[1] || 'v1';
  if (!['v0', 'v1'].includes(promptVersion)) {
    throw new Error('Prompt must be v0 or v1');
  }
  return promptVersion;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeUsage = (usage = {}) => {
  const inputTokens = Number(usage.inputTokens || usage.prompt_tokens || 0);
  const outputTokens = Number(usage.outputTokens || usage.completion_tokens || 0);
  const totalTokens = Number(usage.totalTokens || usage.total_tokens || inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
};

async function runCase({ endpoint, accessToken, promptVersion, caseItem }) {
  const startedAt = Date.now();
  const response = await fetch(endpoint, {
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

  const latencyMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));
  const usage = normalizeUsage(payload.usage);

  if (!response.ok) {
    return {
      caseId: caseItem.id,
      category: caseItem.category,
      ok: false,
      status: response.status,
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
  });

  return {
    caseId: caseItem.id,
    category: caseItem.category,
    ok: true,
    status: response.status,
    latencyMs,
    usage,
    report: payload.report,
    grade,
  };
}

async function main() {
  const promptVersion = parsePromptVersion();
  const endpoint = process.env.PILLPAL_EVAL_ENDPOINT;
  const accessToken = process.env.PILLPAL_EVAL_ACCESS_TOKEN;

  if (!endpoint || !accessToken) {
    console.error('Missing PILLPAL_EVAL_ENDPOINT or PILLPAL_EVAL_ACCESS_TOKEN.');
    console.error('No requests were sent.');
    process.exitCode = 2;
    return;
  }

  const cases = JSON.parse(await fs.readFile(CASES_PATH, 'utf8'));
  const results = [];

  for (const [index, caseItem] of cases.entries()) {
    console.log(`[${index + 1}/${cases.length}] ${caseItem.id}`);
    results.push(await runCase({ endpoint, accessToken, promptVersion, caseItem }));
    if (index < cases.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  const grades = results.map((result) => result.grade);
  const output = {
    promptVersion,
    model: 'qwen3.7-flash',
    datasetVersion: 'ai-weekly-report-v1',
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

main().catch((error) => {
  console.error(error?.message || 'Evaluation runner failed.');
  process.exitCode = 1;
});
