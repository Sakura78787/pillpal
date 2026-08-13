import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const badCasesFrom = (run) => (run?.results || [])
  .filter((item) => item?.ok === false || (item?.grade?.issues || []).length > 0)
  .map((item) => ({
    caseId: item.caseId,
    status: item.status ?? null,
    code: item.code || null,
    diagnostic: item.diagnostic || null,
    issues: item.grade?.issues || [],
    summary: item.report?.summary || null,
  }));

export function buildEvalSnapshot({ v0, v1, v2, manualReview, engineeringChecks }) {
  return {
    datasetVersion: v0.datasetVersion,
    currentDatasetVersion: v2.datasetVersion,
    generatedAt: v2.runAt,
    model: v2.model,
    provider: 'Qwen DashScope OpenAI-compatible API',
    promptVersions: ['v0', 'v1', 'v2'],
    caseCount: v0.summary.caseCount,
    currentCaseCount: v2.summary.caseCount,
    runs: {
      v0: { summary: v0.summary, badCases: badCasesFrom(v0) },
      v1: { summary: v1.summary, badCases: badCasesFrom(v1) },
      v2: { summary: v2.summary, badCases: badCasesFrom(v2) },
    },
    manualReview,
    engineeringChecks,
    notes: [
      'V0/V1 是历史 Prompt 基线，V2 是当前生产版本；不同数据集的绝对分数不直接横向比较。',
      '事实数据由代码确定性计算，模型只负责组织语言、筛选重点和表达。',
      '评测只使用合成数据，不包含访问令牌、用户身份、药品名称或真实健康数据。',
      '自动指标覆盖客观约束；事实与证据的语义一致性、建议可执行性和优先级由人工分层抽检补充。',
      '结果只证明当前合成场景下的产品质量，不代表真实医疗效果或真实用户效果。',
    ],
  };
}

const defaultEngineeringChecks = [
  { label: '异步任务创建与状态轮询', status: 'passed', evidence: '自动测试', detail: '接口契约与状态转换回归' },
  { label: '刷新后恢复任务', status: 'passed', evidence: '自动测试+历史人工验收', detail: '本地任务恢复与继续轮询' },
  { label: '瞬时查询失败恢复', status: 'passed', evidence: '自动测试', detail: '429/5xx 后继续轮询' },
  { label: '重复处理防护', status: 'passed', evidence: '自动测试', detail: '任务 claim 只允许一次' },
];

export async function writeCurrentSnapshot() {
  const readJson = async (file) => JSON.parse(await fs.readFile(path.join(__dirname, file), 'utf8'));
  const [v0, v1, v2, manualReview] = await Promise.all([
    readJson('results/v0.json'),
    readJson('results/v1.json'),
    readJson('results/v2.json'),
    readJson('results/manual-review-v2.json'),
  ]);
  const snapshot = buildEvalSnapshot({ v0, v1, v2, manualReview, engineeringChecks: defaultEngineeringChecks });
  const target = path.resolve(__dirname, '../../src/features/ai-report/evalSnapshot.json');
  await fs.writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeCurrentSnapshot()
    .then((target) => console.log(`Wrote ${target}`))
    .catch((error) => {
      console.error(error?.message || 'Snapshot build failed.');
      process.exitCode = 1;
    });
}
