import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { V2_CASES } from './cases-v2.mjs';
import { gradeReport, summarizeGrades } from './graders.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALIDATION_FAILURES_AFTER_REPAIR = new Set([
  'response_json_parse_failed',
  'schema_invalid',
  'invalid_evidence_id',
  'invalid_medication_ref',
  'invalid_action_code',
  'invalid_data_gap_code',
  'internal_code_leakage',
]);

const evaluationMetaFrom = (result) => {
  const repaired = VALIDATION_FAILURES_AFTER_REPAIR.has(result.diagnostic)
    || result.diagnostic?.startsWith('repair_')
    || result.diagnostic?.startsWith('qwen_repair_');
  if (result.evalMeta && !repaired) return result.evalMeta;
  return {
    ...(result.evalMeta || {}),
    modelCallCount: repaired ? 2 : 1,
    repairTriggered: repaired,
    inputTokens: result.usage?.inputTokens || 0,
    outputTokens: result.usage?.outputTokens || 0,
  };
};

export function rescoreV2Run(run, cases = V2_CASES) {
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const results = run.results.map((result) => {
    const caseItem = casesById.get(result.caseId);
    if (!caseItem) throw new Error(`Unknown V2 case: ${result.caseId}`);
    const evalMeta = evaluationMetaFrom(result);
    const usage = result.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const grade = gradeReport(caseItem, result.report || { summary: 'request failed' }, {
      success: result.ok,
      latencyMs: result.latencyMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      modelCallCount: evalMeta.modelCallCount,
      repairTriggered: evalMeta.repairTriggered,
    });
    return { ...result, evalMeta, grade };
  });
  return {
    ...run,
    scoringRevision: 'ai-weekly-report-graders-v2.2',
    summary: summarizeGrades(results.map((item) => item.grade)),
    results,
  };
}

export async function writeRescoredV2() {
  const target = path.join(__dirname, 'results/v2.json');
  const run = JSON.parse(await fs.readFile(target, 'utf8'));
  const rescored = rescoreV2Run(run);
  await fs.writeFile(target, `${JSON.stringify(rescored, null, 2)}\n`, 'utf8');
  return rescored;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeRescoredV2()
    .then((run) => console.log(JSON.stringify(run.summary, null, 2)))
    .catch((error) => {
      console.error(error?.message || 'V2 rescore failed.');
      process.exitCode = 1;
    });
}
