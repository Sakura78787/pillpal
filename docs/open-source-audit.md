# PillPal 开源与依赖审计

- 更新日期：2026-08-23
- 代码基线：`codex/care-auth-notifications`（远程 migration 未应用）

## 公开范围

- React 前端、Netlify Functions / Background Function、Supabase migration 与 RLS 验收资产。
- AI 周报事实计算、Prompt、Schema、异步 job、评分器和合成评测结果。
- README、PRD、路线图、交接、安全、贡献和 CI 文档。

评测数据均为合成数据。公开仓库不应包含真实患者、真实家庭健康数据或可复用登录凭据。

## 排除范围与密钥边界

`.gitignore` 排除 `.env*`（保留 `.env.example`）、`.netlify/`、`.worktrees/`、`dist/`、`node_modules/`、日志和本地缓存。

不得提交或写入浏览器包：

- `DASHSCOPE_API_KEY`
- `SUPABASE_SECRET_KEY` 或 legacy service-role key
- `PILLPAL_EVAL_ACCESS_TOKEN`
- Netlify/Supabase 临时 token、cookie 或部署凭据

`VITE_SUPABASE_PUBLISHABLE_KEY` 是浏览器公开 key，不是服务端 secret；数据安全依赖 RLS，不能把公开 key 当成保密措施。所有真实服务端 secret 只能配置在托管平台环境中，禁止加 `VITE_` 前缀。

## 当前 AI 隐私边界

用户首次生成周报前需要明确同意。获得同意后，最近 7 天健康样本可能发送给 Qwen，具体字段为：记录时间 `recordedAt`；血压的收缩压、舒张压和可选心率；血糖数值及测量时段 `timing`（缺失或非法值归为 `random`）；体重数值和可选 BMI。此外会发送代码计算的用药执行汇总、匿名药物引用、库存估算、健康趋势、数据缺口和复诊倒计时。

不会发送身份信息、邮箱、药品名称、剂量、医院、医生、备注或数据库 ID。药品在 payload 中只使用 `med_1` 一类上下文内匿名引用；真实名称只在浏览器本地用于结果展示。

如果用户拒绝健康数据授权，本次不调用模型。演示与评测继续使用合成数据；真实用户开放前需要补齐隐私告知、授权撤销、数据删除、备份、监控和事件响应。

## 家庭授权与通知权限边界

- 业务原始表仍维持单账号 RLS；照护人不获得对 `medications`、`medication_logs`、`health_records` 或 `appointments` 的直接查询或写入权限。
- `care_authorizations` 和 `notifications` 使用 RLS 与最小 Grants；跨账号摘要、AI 上下文、授权创建/领取/撤销、通知写入、限频和已读均在服务端验证身份与有效授权后处理。
- `/weekly-report?from=care&subject=...` 仅在有效授权时可创建或读取；撤销后重新校验失败。照护人不能向模型任意提交被照护人的数据。
- 通知仅站内持久化与 Realtime 刷新；无 Push、短信、微信、自由文本或定时任务。远程 migration 尚未应用，当前分支尚未发布。

## 异步 job 安全边界

- `ai_weekly_report_jobs` 启用 RLS，并撤销 `public`、`anon`、`authenticated` 的全部表权限，只授予服务端角色。
- 浏览器通过已登录 Supabase session 调用 Netlify Function，服务端先验证 token。
- 服务端对 job 的创建、查询、认领、完成和失败更新均绑定 user ID；job ID 本身不构成授权。
- 同一用户只允许一个 `queued/running` 任务。job 的 `expires_at` 为创建后 24 小时；过期行不是定时清理，而是在创建新任务的 POST 中先执行懒清理。
- 停滞检查只在轮询 GET 时触发：`queued` 按 `created_at`、`running` 按 `started_at` 计算年龄，超过 3 分钟则标记失败；当前没有 heartbeat。
- 生产环境保持 `AI_WEEKLY_REPORT_EVAL_MODE=false`，避免返回评测用的内部调用元数据。
- 服务端日志只记录阶段、受控诊断码、时延和 token 汇总，不应记录完整 payload、模型原文、access token 或密钥。

## 2026-08-22 依赖审计

执行环境与时间：

- 时间：`2026-08-22 14:15:28 +08:00`
- Node.js：`v24.11.1`
- npm：`11.6.2`
- 命令：

```bash
npm audit --omit=dev --json
```

结果：2 个 moderate、0 high、0 critical，`fixAvailable=false`。

| 依赖边界 | 当前问题 | 当前暴露面与措施 |
|---|---|---|
| `react-router-dom@6.30.4`（直接依赖） | open redirect leading to XSS | 不把不可信外部 URL 直接传给 `Link` / `navigate`；等待上游可用修复 |
| `react-router`（传递依赖） | backslash open redirect；SSR hydration 反序列化问题 | 当前是客户端 Vite SPA，不使用 SSR hydration；仍需跟进升级 |

“当前不使用 SSR”只降低其中一项暴露面，不等于漏洞不存在。每次发版前应重新运行 audit；上游提供兼容修复后，升级并执行：

```bash
npm test
npm run test:ai
npm run build
npm audit --omit=dev
```

## 发布前检查

1. `git status --short` 不出现 `.env`、token、构建产物或真实数据。
2. 搜索密钥名称和常见 token 前缀，确认只有变量名与占位符。
3. 检查 migration 顺序为四份，AI job、授权和通知表未向浏览器开放写入权限。
4. 检查隐私文案与实际 payload 一致，不能继续声称“只发送聚合事实”。
5. 检查 V2 报告仍保留质量 Gate 未通过与两个 Bad Case。
6. 运行测试、AI 测试、构建与生产依赖 audit。
7. 任何公开发布、真实数据或权限模型变化都先由 Sakura 确认。
