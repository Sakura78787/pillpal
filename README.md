# PillPal 慢病用药小管家

PillPal 是一个面向慢病家庭照护场景的 Web MVP，用于记录用药计划、服药打卡、药品库存、健康指标和复诊安排。项目同时提供一个基于已记录数据的 AI 周报能力，并配套最小化的 AI 输出评测流程。

本项目仅用于个人健康记录与产品原型演示，不提供诊断、处方、续方、在线问诊或用药调整建议。

## Demo

Production: [https://pillpal-app.netlify.app](https://pillpal-app.netlify.app)

> 请勿在演示环境录入真实健康数据、处方信息或身份证明信息。

## 功能概览

- 邮箱 Magic Link 登录
- 用药计划管理
- 今日服药打卡
- 药品库存记录与低库存提醒
- 健康指标记录
- 复诊预约管理
- AI 用药管理周报
- AI 周报评测展示页

## AI 周报设计

AI 周报采用“确定性事实计算 + 模型语言组织”的方式：

- 由代码先计算最近 7 天的服药记录、跳过记录、低库存药品数量、健康记录数量等事实。
- 模型只负责组织语言、提取重点和表达数据缺口。
- 发送给模型的是匿名聚合事实，不包含药品名、剂量、医院、医生、原始健康数值、用户身份或数据库行 ID。
- 输出内容必须包含安全声明，并为重点关注项保留 `evidence_ids`。

## AI 评测

项目内置一组针对 AI 周报的合成评测样本，用于对比不同 Prompt 版本在以下维度上的表现：

- 输出结构是否符合约定
- 关键事实是否被正确召回
- 证据 ID 是否有效
- 是否出现无依据的数字结论
- 是否遵守非医疗建议边界
- 请求成功率、延迟与 token 用量

相关代码位于：

```text
evals/ai-weekly-report/
src/features/ai-report/
src/pages/EvalLab.jsx
netlify/functions/generate-weekly-report.ts
```

## 技术栈

- React 18
- Vite
- Zustand
- Tailwind CSS
- Supabase Auth / Postgres / RLS
- Netlify Functions
- Qwen / DashScope OpenAI-compatible API
- Vitest
- Zod

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 环境变量

前端环境变量：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_AI_WEEKLY_REPORT_ENABLED=false
```

Netlify Functions 环境变量：

```dotenv
AI_WEEKLY_REPORT_ENABLED=false
AI_WEEKLY_REPORT_EVAL_MODE=false
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3.7-flash
DASHSCOPE_API_KEY=
```

不要把 Supabase service-role key、DashScope API Key 或任何临时 access token 提交到仓库。

## Supabase 初始化

在新的 Supabase 项目中依次执行：

```text
supabase/migrations/20260728000000_initial_schema.sql
supabase/migrations/20260728001000_tighten_public_table_grants.sql
```

迁移会创建以下核心表：

- `profiles`
- `medications`
- `medication_logs`
- `health_records`
- `appointments`

公开业务表均启用 RLS，默认仅允许登录用户访问自己的数据。

## Netlify 部署

项目已包含 `netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

部署时需要在 Netlify 配置 Supabase 与 Qwen / DashScope 相关环境变量。

## 常用命令

```bash
npm test
npm run build
npm run eval:ai:v0
npm run eval:ai:v1
```

## 目录结构

```text
src/                         前端页面、组件、状态管理与业务逻辑
src/features/ai-report/      AI 周报事实构建、接口封装与展示组件
netlify/functions/           服务端鉴权与模型调用
evals/ai-weekly-report/      合成评测样本、评分器与评测结果
supabase/migrations/         数据库 schema 与 RLS migration
```

## 安全边界

- 不在前端暴露模型 API Key 或 Supabase service-role key。
- 不向模型发送可识别用户身份的原始健康数据。
- AI 输出仅做记录摘要与待关注事项整理，不提供医疗诊断或用药建议。
- 演示和评测数据应使用合成数据。

## License

MIT License. See [LICENSE](./LICENSE).
