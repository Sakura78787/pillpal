# PillPal 开源发布前检查

本文件记录 PillPal 首次公开到 GitHub 前的仓库清点结论，方便后续维护时复用同一套边界。

## 会公开的内容

- 前端源码、Netlify Functions、Supabase migration 与 RLS 验收 SQL。
- AI 周报相关的事实构建、服务端调用、Prompt、评测脚本与合成评测结果。
- README、MIT License、贡献说明、安全说明与 CI 配置。
- 合成样本和自动化测试，不包含真实患者或真实家庭健康数据。

## 不应公开的内容

- `.env`、`.env.local`、Netlify/Supabase/DashScope 的真实密钥或临时 access token。
- `.netlify/` 本地站点状态、`dist/` 构建产物、`node_modules/` 依赖目录、运行日志。
- `memory_bank/` 等本地开发过程记录。
- 真实健康数据、处方信息、医院医生信息、身份证明、手机号、住址等个人敏感信息。

## 当前扫描结论

- 当前公开文件只保留环境变量名和占位符，没有提交真实 Supabase service-role key、DashScope API key 或 Supabase access token。
- 当前 AI 评测数据为合成数据，可用于展示评测方法，不应被解释为真实医疗效果数据。
- 项目声明边界是“用药记录与非医疗建议性质的数据摘要”，不是诊断、处方、续方或在线问诊系统。

## 已知依赖提示

`npm audit --omit=dev` 当前提示 `react-router-dom` 传递依赖中存在两个 moderate 级别问题，且上游暂未提供可用修复版本。当前项目为客户端 SPA，不使用 React Router 的 SSR hydration 能力；但仍应避免把不可信外部 URL 直接传入 `Link` 或 `navigate`。

后续一旦上游发布修复版本，应优先升级 `react-router-dom` 并重新执行：

```bash
npm audit --omit=dev
npm test
npm run build
```

