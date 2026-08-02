# PillPal 慢病用药小管家

PillPal 是一个面向慢性病家庭照护场景的 Web MVP。项目从 NoCode 原型迁移到自有工程链路后，使用 Supabase 承载认证与数据，使用 Netlify 部署前端与服务端函数，并新增了一个最小可验证的 AI 周报与评测闭环。

当前版本的核心目标不是“做一个复杂医疗系统”，而是跑通一条可演示、可验证、可继续迭代的闭环：

> 老人或照护者记录用药、库存、健康数据与复诊安排；系统基于已记录数据生成非医疗建议性质的周报；项目用合成样本评测 AI 输出的结构、事实 grounding、证据引用、数字支撑和安全边界。

## 产品定位

- 直接使用者：慢性病中老年患者，以及协助记录的家庭成员。
- 核心目标人群：外出务工、异地生活、需要远程了解父母服药情况的子女。
- 当前阶段：个人作品集 / 秋招面试项目 / 可在线演示的 MVP。
- 明确边界：不提供诊断、处方、续方、在线问诊或用药调整建议。

## 已实现能力

### 基础用药管理

- 邮箱 Magic Link 登录
- 用药计划管理
- 今日服药打卡
- 库存记录与低库存提醒
- 健康记录
- 复诊预约
- Supabase RLS 账户隔离
- Netlify SPA 部署与刷新回退

### AI 周报

- 基于最近 7 天已记录数据生成周报
- 只向模型发送匿名聚合事实，不发送药品名、剂量、医院医生、原始健康数值、用户身份或数据库行 ID
- 代码先计算确定性事实，模型只负责组织语言、筛选重点和表达
- 输出包含：
  - 本周概览
  - 重点关注
  - 数据缺口
  - 固定安全声明
  - 每条重点对应的 `evidence_ids`

### AI 评测闭环

- 30 条合成评测样本，覆盖常规、稀疏、多信号、边界与医疗安全场景
- Prompt V0 / V1 对比
- 自动指标：
  - 结构合规率
  - 关键事实召回率
  - 证据 ID 有效率
  - 无证据数字声明率
  - 安全边界通过率
  - 请求成功率
  - 平均延迟 / P95 延迟
  - token 用量
- `/eval-lab` 只读展示页，用于面试演示评测证据

## 技术栈

- React 18
- Vite
- Zustand
- Tailwind CSS
- Supabase Auth / Postgres / RLS
- Netlify Functions
- Qwen DashScope OpenAI-compatible API
- Vitest
- Zod

## 在线演示

- Production: https://pillpal-app.netlify.app

> 线上环境只建议使用合成测试数据。请不要录入真实健康数据、处方信息或身份证明信息。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认开发地址由 Vite 输出决定，当前项目通常为：

```text
http://localhost:8080
```

## 环境变量

复制 `.env.example` 后填写：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

VITE_AI_WEEKLY_REPORT_ENABLED=false
AI_WEEKLY_REPORT_ENABLED=false
AI_WEEKLY_REPORT_EVAL_MODE=false
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3.7-flash
DASHSCOPE_API_KEY=
```

注意：

- `DASHSCOPE_API_KEY` 只能配置在 Netlify 服务端环境变量中。
- 不要给模型配置 `VITE_` 前缀的密钥。
- 不要提交 `.env.local`、Supabase service-role key 或真实用户数据。

## Supabase 初始化

在新的 Supabase 项目中依次执行：

```text
supabase/migrations/20260728000000_initial_schema.sql
supabase/migrations/20260728001000_tighten_public_table_grants.sql
```

迁移会创建：

- `profiles`
- `medications`
- `medication_logs`
- `health_records`
- `appointments`

并配置：

- `auth.users` 外键关联
- `updated_at` 维护
- 新用户 profile 自动创建
- authenticated 角色权限
- 业务表 RLS

## Netlify 部署

`netlify.toml` 已配置：

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

建议部署流程：

1. 先发 Deploy Preview。
2. 验证登录、核心 CRUD、AI 周报、`/eval-lab`。
3. Production 中关闭 `AI_WEEKLY_REPORT_EVAL_MODE`。
4. Production 使用独立 DashScope API Key。

## 常用命令

```bash
npm test
npm run build
npm run eval:ai:v0
npm run eval:ai:v1
```

运行 AI 评测前需要设置：

```bash
PILLPAL_EVAL_ENDPOINT=<your-preview-url>/api/ai/weekly-report
PILLPAL_EVAL_ACCESS_TOKEN=<temporary-supabase-access-token>
```

不要把 access token 写入文件或提交到仓库。

## 项目结构

```text
src/features/ai-report/       AI 周报、事实构建、评测展示组件
src/pages/WeeklyReport.jsx    AI 周报页面
src/pages/EvalLab.jsx         只读评测展示页
netlify/functions/            服务端模型调用与鉴权
evals/ai-weekly-report/       合成评测集、评分器与真实运行结果
supabase/migrations/          数据库 schema 与 RLS migration
docs/superpowers/plans/       关键实施计划
```

## 隐私与安全边界

- 本项目不采集或处理真实医疗诊断数据。
- AI 周报输入只包含匿名聚合事实。
- 评测数据全部为合成数据。
- 前端不包含 service-role key 或模型 API Key。
- 输出固定包含非医疗建议声明。

## 后续路线

后续优先从“子女远程照护”方向迭代：

- 子女端查看父母近期服药与复诊状态
- 异常提醒与待确认事项
- 家庭成员协作与权限控制
- 周报订阅与趋势解释
- 更细粒度的 AI 评测与 Bad Case 回归

迭代原则：先跑到 60 分，形成真实可体验闭环，再小步快跑。

## License

MIT License. See [LICENSE](./LICENSE).
