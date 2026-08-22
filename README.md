# PillPal 慢病用药小管家

PillPal 是一个面向慢病家庭照护场景的 Web MVP。已实现的产品链路覆盖邮箱 Magic Link 登录、用药计划、服药打卡、库存、血压/血糖/体重记录、复诊日程、同账号只读照护视角，以及基于最近 7 天记录生成的异步 AI 家庭照护周报。

本项目是个人健康记录与 AI 产品评测作品集，不提供诊断、处方、续方、在线问诊或用药调整建议。

## 当前状态

| 层级 | 状态 | 边界 |
|---|---|---|
| 已实现 | 单账户数据管理、RLS 隔离、AI 周报 V2 异步任务、V0/V1/V2 评测资产 | 代码和测试可验证 |
| 已实现 | `/care` 同账号只读“子女照护视角” Demo、待确认 actions、AI `from=care` 衔接 | 模拟视角，不是家庭成员绑定或跨账户共享；本轮尚未发布 |
| 未来候选 | 真实家庭邀请、双账户绑定与授权撤销 | 需要单独的数据模型、RLS、隐私与滥用风险评审 |

现有 Production 基线：[https://pillpal-app.netlify.app](https://pillpal-app.netlify.app)

> `/care` 阶段二能力已在当前分支实现并完成本地验证，本轮没有执行发布或部署，不能据此推断现网已包含该能力。

> 演示环境建议仅使用合成数据，不要录入真实身份、处方或健康信息。

## 已实现能力

- 邮箱 Magic Link 登录与受保护路由。
- 用药计划、已服用/已跳过记录、库存扣减与低库存提示。
- 健康页支持最近健康记录 JSON 导出；设置页通用导入/导出未启用。
- 复诊日程和应用内提示。
- 受登录保护的 `/care`：使用当前账号自己的数据模拟异地子女只读视角，不提供编辑、代打卡或跨账户读取。
- 最近 7 天四类照护概览：计划剂次及已服用/明确跳过/未记录、低库存药品、健康记录数量、复诊倒计时。
- 基于确定性事实生成有序待确认 actions：低库存、3 天内复诊、明确跳过、未记录、无健康记录；没有优先事项时给出信息型兜底。
- AI 开启时从 `/care` 进入 `/weekly-report?from=care`，沿用原 V2 异步任务、健康数据同意与安全校验，并保留“返回照护概览”的来源语义。
- Supabase Auth / Postgres / RLS：业务表仅允许登录用户访问自己的数据。
- AI 家庭照护周报 V2：创建任务、后台生成、轮询状态、刷新后恢复、失败诊断和 24 小时任务过期。
- AI 评测：自动评分、固定人工抽检、Bad Case 留档和 `/eval-lab` 只读展示。

## AI 周报 V2

周报采用“确定性事实计算 + 模型组织语言”：代码先从最近 7 天记录计算计划剂次、已服用/已跳过/未记录、库存、健康趋势和复诊倒计时；模型只在约定 Schema 内生成摘要、关注点和行动项。未记录不等于确认漏服。

生成链路是异步任务：前端创建 `ai_weekly_report_jobs` 任务，Netlify Background Function 调用 Qwen，前端轮询任务结果；同一用户同时只允许一个活动任务，任务失败会保留受控诊断码。

### 隐私边界

用户首次生成前必须明确同意。获得同意后，最近 7 天健康样本可能发送给 Qwen，具体字段为：记录时间 `recordedAt`；血压的收缩压、舒张压和可选心率；血糖数值及测量时段 `timing`（缺失或非法值归为 `random`）；体重数值和可选 BMI。同时会发送代码计算的用药执行汇总、匿名药物引用、库存估算、数据缺口和复诊倒计时。

不会发送姓名等身份信息、邮箱、药品名称、剂量、医院、医生、备注或数据库 ID。药物只使用本次周报内生成的 `med_1` 一类匿名引用，不是数据库主键。AI 结果只用于记录整理，不能替代原始记录或医疗判断。

## AI 评测证据

- V0/V1：同一模型、同一 30 例合成数据集、同一评分器和参数，只改变 Prompt 版本，用于受控 Prompt 对比。
- V2：24 例正式异步批跑，覆盖典型 6、依从性 6、健康 4、家庭协同 4、医疗安全 4。
- V2 结果：23/24 请求成功；安全、无依据数字控制、已跳过/未记录区分和行动白名单均为 100%。
- V2 模型质量 Gate：**未通过**。Schema Pass 95.8%、Key Fact Recall 91.7%、Evidence Validity 95.8%，保留 2 个真实 Bad Case，不包装成发布通过。

完整结果见 [V2 评测报告](./docs/ai-evaluation/2026-08-11-v2-evaluation-report.md)。

## 技术栈

- React 18、Vite、Zustand、Tailwind CSS
- Supabase Auth / Postgres / RLS
- Netlify Functions / Background Functions
- Qwen / DashScope OpenAI-compatible API
- Vitest、Zod

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 环境变量

### 前端构建

| 变量 | 必需 | 用途 |
|---|---:|---|
| `VITE_SUPABASE_URL` | 是 | Supabase 项目 URL；服务端也可作为 `SUPABASE_URL` 的回退 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 是 | 浏览器公开 key；服务端验签也可将其作为回退 |
| `VITE_AI_WEEKLY_REPORT_ENABLED` | 否 | 设为严格小写 `true` 时显示 AI 周报入口 |

### Netlify Functions

| 变量 | 必需 | 用途 |
|---|---:|---|
| `AI_WEEKLY_REPORT_ENABLED` | AI 开启时 | 服务端总开关，严格小写 `true` |
| `AI_WEEKLY_REPORT_EVAL_MODE` | 否 | 评测环境返回额外用量/时延元数据；生产保持 `false` |
| `AI_WEEKLY_REPORT_PROMPT_VERSION` | 否 | 仅供旧同步兼容接口选择 `v1`/`v2`；异步 job 固定使用 V2 |
| `QWEN_BASE_URL` | 否 | 默认 DashScope OpenAI-compatible 地址 |
| `QWEN_MODEL` | 否 | 默认 `qwen3.7-flash` |
| `QWEN_MAX_OUTPUT_TOKENS` | 否 | 默认 `1400` |
| `QWEN_REQUEST_TIMEOUT_MS` | 否 | 同步兼容接口超时，默认 `45000` |
| `QWEN_BACKGROUND_REQUEST_TIMEOUT_MS` | 否 | 异步后台调用超时，默认 `90000` |
| `DASHSCOPE_API_KEY` | AI 开启时 | 服务端模型密钥 |
| `SUPABASE_URL` | 否 | 服务端 Supabase URL；未设置时回退 `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | 否 | 服务端验签公开 key；未设置时回退前端同名配置 |
| `SUPABASE_SECRET_KEY` | 异步 AI 开启时 | 仅服务端用于 AI job 表；不得使用 `VITE_` 前缀 |

### 正式评测 Runner

| 变量 | 必需 | 用途 |
|---|---:|---|
| `PILLPAL_EVAL_ENDPOINT` | 批跑时 | 隔离 Preview 的 AI 接口地址 |
| `PILLPAL_EVAL_ACCESS_TOKEN` | 批跑时 | 临时 Supabase 登录 access token |

不要提交任何真实密钥或 access token。`.env.example` 只保留占位符；生产密钥应仅配置在托管平台的服务端环境。

## Supabase 初始化

在新 Supabase 项目中按顺序执行三份 migration：

```text
supabase/migrations/20260728000000_initial_schema.sql
supabase/migrations/20260728001000_tighten_public_table_grants.sql
supabase/migrations/20260810000000_ai_weekly_report_jobs.sql
```

前两份创建并收紧 `profiles`、`medications`、`medication_logs`、`health_records`、`appointments` 的 RLS；第三份创建仅由服务端 `service_role` 访问的 `ai_weekly_report_jobs`。

## 常用命令

```bash
npm test
npm run test:ai
npm run build
npm run eval:ai:v0
npm run eval:ai:v1
npm run eval:ai:v2
npm run eval:ai:rescore:v2
```

## 目录结构

```text
src/                         前端页面、状态与业务逻辑
src/features/ai-report/      AI 事实计算、异步 API、契约与展示
netlify/functions/           鉴权、异步任务与模型调用
evals/ai-weekly-report/      合成样本、评分器与结果
supabase/migrations/         Schema、RLS 与 AI job migration
docs/                        评测、项目管理与安全交接文档
```

## 验证基线

阶段二代码基线 `9e846487c09eaefce7246c9c47701051ca0845bf` 已于 2026-08-22 本地验证：`npm test` 33 个测试文件 / 155 个测试通过，`npm run test:ai` 18 个测试文件 / 67 个测试通过，`npm run build` 成功。测试保留 React Router SSR 渲染 warning，构建保留动态/静态重复导入和 chunk-size warning；本轮未发布。

## License

MIT License. See [LICENSE](./LICENSE).
