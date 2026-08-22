# PillPal 当前状态交接：异步 AI V2 与照护演示边界

- 日期：2026-08-22
- 事实基线：`9e846487c09eaefce7246c9c47701051ca0845bf`
- 用途：新任务恢复上下文、作品集事实核对和下一迭代验收

## 一句话状态

PillPal 已完成单账户慢病记录、Supabase RLS、异步 AI 家庭照护周报 V2，以及 `/care` 同账号只读“子女照护视角” Demo；当前分支已本地验证但尚未发布，真实家庭邀请、双账号授权与共享 RLS 仍未实现。

## 1. 已实现事实

### 产品与数据

- 邮箱 Magic Link 登录、`ProtectedRoute` 与刷新后会话恢复。
- 用药计划、已服用/已跳过记录、库存扣减和低库存提示。
- 健康页支持最近健康记录 JSON 导出；设置页通用导入/导出未启用。
- 复诊日程和应用内提示。
- 核心表：`profiles`、`medications`、`medication_logs`、`health_records`、`appointments`。
- 业务表通过 RLS 维持 `auth.uid() = user_id` 的单账户隔离。

### 同账号照护视角 Demo

- `/care` 受 `ProtectedRoute` 保护，从个人中心和首页照护入口可发现。
- 使用当前登录账号自己的现有数据模拟异地子女只读照护视角；不提供编辑、代打卡或跨账号读取。
- 最近 7 天四类概览：计划剂次及已服用/明确跳过/未记录、低库存药品、血压/血糖/体重记录总数、复诊倒计时。
- actions 按稳定顺序从确定性事实生成：低库存、3 天内复诊、明确跳过、未记录、无健康记录；无命中时显示信息型兜底。
- AI 开启时从 `/care` 进入 `/weekly-report?from=care`，使用家庭照护语义并返回 `/care`；底层继续复用 V2 异步 job、健康数据授权和安全校验。
- AI 关闭时只禁用生成动作，不影响照护概览。

### 异步 AI 周报 V2

- 前端从最近 7 天记录计算确定性事实，再创建 AI job。
- `weekly-report-jobs` 负责鉴权、任务创建、轮询和过期检查。
- Netlify Background Function 调用 `qwen3.7-flash`，先生成、再校验，内容校验失败最多 Repair 一次。
- 任务状态为 `queued / running / succeeded / failed`；同一用户同时最多一个活动任务，`expires_at` 为创建后 24 小时。过期行不是定时清理，而是在创建新任务的 POST 中先执行懒清理。
- `ai_weekly_report_jobs` 不对浏览器角色开放，只由服务端 secret key 访问；服务端查询仍校验用户身份与 job 所有权。
- 前端保存 job ID，刷新页面后可以继续查询。停滞检查只在轮询 GET 时触发：`queued` 按 `created_at`、`running` 按 `started_at` 计算年龄，超过 3 分钟则标记失败；当前没有 heartbeat。

### 数据库迁移

按顺序使用三份 migration：

1. `20260728000000_initial_schema.sql`：核心业务表、触发器与 RLS。
2. `20260728001000_tighten_public_table_grants.sql`：收紧公开表和 sequence grants。
3. `20260810000000_ai_weekly_report_jobs.sql`：异步 AI job 表、索引、状态约束与服务端权限。

## 2. AI 隐私与安全边界

- 用户首次生成前需要明确同意；拒绝时不调用模型。
- 同意后，最近 7 天健康样本可能发送给 Qwen：记录时间 `recordedAt`；血压的收缩压、舒张压和可选心率；血糖数值及测量时段 `timing`（缺失或非法值归为 `random`）；体重数值和可选 BMI。
- 同时发送代码计算的服药执行汇总、匿名药物引用、库存估算、健康趋势、数据缺口和复诊倒计时。
- 不发送身份信息、邮箱、药品名称、剂量、医院、医生、备注或数据库 ID。
- `med_1` 一类引用只在本次周报上下文中使用，不是数据库主键；药品名称仅在浏览器本地映射回展示文案。
- AI 只整理记录，不诊断、不处方、不建议停药/换药/加减量；“未记录”不得写成“确认漏服”。

## 3. 评测现状

### V0/V1 历史对比

V0 与 V1 使用同一模型、同一 30 例合成数据集、同一评分器和参数，只改变 Prompt。V1 的 Schema 与 Evidence 为 100%，Key Fact Recall 为 95.6%；这是 Prompt 受控实验，不是模型选型，也不是医疗效果验证。

### V2 正式批跑

- 24 例：典型 6、依从性 6、健康 4、家庭协同 4、医疗安全 4。
- 23/24 Request Success；Schema 95.8%、Key Fact Recall 91.7%、Evidence 95.8%。
- Unsupported Numeric Claims、Safety、已跳过/未记录区分、行动白名单均为 100%。
- 固定人工抽检 12 例中 9 例四项全过，额外复核 1 个自动失败案例。
- 模型质量 Gate **未通过**。真实 Bad Case 为 `v2-typical-4` 核心 Evidence 漏召回，以及 `v2-care-3` Repair 后仍 Schema 失败。

不要用“V2 已发布通过”表述。完整证据见 [V2 评测报告](../ai-evaluation/2026-08-11-v2-evaluation-report.md) 和 `evals/ai-weekly-report/results/v2.json`。

## 4. 阶段二已完成：同账号照护视角 Demo

当前阶段已经完成：

- 受保护的 `/care` 路由、两个产品入口、加载/失败/空状态。
- 四类只读概览、稳定排序的待确认 actions，以及未记录/明确跳过的口径区分。
- `/weekly-report?from=care` 的标题、说明、Demo 边界和返回路径；普通周报入口不展示家庭绑定话术。
- 页面明确显示“当前使用本人账号数据模拟异地子女只读照护视角，尚未建立真实家庭账号绑定”。

这项能力只在当前分支完成实现与本地验证，本轮没有发布或部署。

## 5. 未来与不做

### 未来候选

真实家庭邀请、双账号绑定、字段级授权、共享 RLS、撤销和审计。进入前必须单独评审数据归属、被照护者知情、家庭控制风险与真实健康数据合规。

### 当前不做

- 诊断、处方、用药调整或医疗效果承诺。
- 外部通知、代打卡和跨账户数据修改。
- 商业化、支付或真实用户开放。
- 把合成评测结果描述为真实医疗或用户效果。

## 6. 验证基线

阶段二功能分支于 2026-08-22 完成当前环境验证：

- `npm test`：34 个测试文件、156 个测试通过。
- `npm run test:ai`：18 个测试文件、67 个测试通过。
- `npm run build`：成功。
- 非阻塞 warning：测试中的 React Router `useLayoutEffect` SSR 提示；构建中的动态/静态重复导入与 chunk-size 提示。
- 发布状态：未部署、未发布。

历史稳定 tag `snapshot-ai-weekly-v2-2026-08-16` 仍指向 `be4e6ff`，不包含本阶段 `/care` 变更。

## 7. 当前风险

- V2 工程链路已实现，但模型质量 Gate 未通过，两个 Bad Case 尚待修复。
- `/care` 已实现，但当前代码仍是单账号模型，不能支持真实家庭邀请、授权、共享 RLS 或撤销。
- 健康数据敏感；作品集演示应使用合成数据，真实用户开放前还缺完整隐私、删除、备份、监控和事件响应方案。
- `npm audit --omit=dev` 于 2026-08-22 报告 2 个 moderate、0 high、0 critical，均在 React Router 依赖边界且当时无可用修复；详见 `docs/open-source-audit.md`。

## 8. 下一任务启动顺序

1. 读 `README.md`、`PRD.md`、`DEVELOPMENT_PLAN.md` 和本文。
2. 读 V2 评测报告与两个 Bad Case，不放松安全 Gate。
3. 后续如进入真实家庭绑定，先新建独立 PRD、数据模型、威胁模型和 RLS 验收方案。
4. 继续只做增量改动，补测试并运行全量测试、AI 测试和构建。
5. 任何真实家庭绑定、公开发布、真实数据或持续费用动作都先由 Sakura 确认。
