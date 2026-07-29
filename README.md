# PillPal｜慢病用药小管家

从美团 NoCode 导出的慢病用药管理原型迁移到自有 Supabase + Netlify 链路。本阶段目标是先打通“可登录、可在线保存、可部署、可验收”的线上底座，不新增 AI、离线同步、系统推送、家庭协作、续方服务或医疗建议。

## 当前链路

- 前端：React + Vite + Zustand + Tailwind CSS
- 认证：Supabase Auth 邮箱 Magic Link
- 数据库：Supabase Postgres，业务表启用 RLS
- 部署：Netlify 静态站点，当前站点名 `pillpal-app`，`netlify.toml` 已配置 SPA fallback
- Production：`https://pillpal-app.netlify.app`
- 最新验收 Preview：`https://6a68e1b9ff387911f6e01c0b--pillpal-app.netlify.app`

## 本地启动

1. 复制 `.env.example` 为 `.env.local`。
2. 填入 Supabase 项目的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。
3. 安装依赖并启动：

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:8080`。

## Supabase 初始化

在新的 Supabase 项目中执行：

```text
supabase/migrations/20260728000000_initial_schema.sql
supabase/migrations/20260728001000_tighten_public_table_grants.sql
```

该 migration 会创建 `profiles`、`medications`、`medication_logs`、`health_records`、`appointments` 五张核心表，并配置：

- `auth.users` 外键关联
- `updated_at` 触发器
- 新用户自动创建 profile 的触发器
- authenticated 角色所需的表和 sequence 权限
- 所有业务表的 RLS 策略

Auth URL 建议配置：

- Site URL：正式 Netlify 域名
- Redirect URLs：
  - `http://localhost:8080/auth/callback`
  - `https://pillpal-app.netlify.app/auth/callback`
  - `https://6a68e1b9ff387911f6e01c0b--pillpal-app.netlify.app/auth/callback`
  - `https://**--pillpal-app.netlify.app/**`

注意：只在前端和 Netlify 中使用 publishable key，不要暴露 service-role key。

## Netlify 配置

`netlify.toml` 已配置：

- build command：`npm run build`
- publish directory：`dist`
- SPA fallback：`/* -> /index.html`

Netlify 环境变量需要配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

部署流程默认先发 Preview，完成登录、CRUD、RLS、刷新路由验收后，再发布 Production。

## 安全与依赖状态

本项目已移除未使用的 `axios` 和 `recharts`，避免把不需要的网络请求库、图表库和相关传递依赖带入线上运行时。

当前验收口径：

- `npm test` 通过
- `npm run build` 通过
- `npm audit --omit=dev` 无 critical/high
- 剩余 dev/build 工具链风险不进入 Netlify 静态运行时，后续可作为工程治理专项处理

不使用 `npm audit fix --force`，避免为了清零 audit 引入更高风险的大版本升级。

## 验收清单

- 陌生浏览器打开线上 Preview，落地页可访问。
- 未登录访问业务页会跳转 `/login`。
- 邮箱 Magic Link 登录后跳转 `/auth/callback` 并进入 `/dashboard`。
- 新增、编辑、删除并刷新后，用药计划、服药打卡、库存、健康记录、复诊预约仍正确存在。
- 两个测试账户互相看不到、改不了、删不了对方数据。
- 直接刷新 `/dashboard`、`/medications`、`/health` 等业务路由不出现 404。
- 页面不依赖 NoCode 域名、NoCode 插件、Dexie 离线同步队列或游客模式。

## 当前边界

首次验收只使用合成测试数据，不录入真实健康数据。本应用仅用于个人健康记录和秋招项目演示，不提供诊断、处方、续方或在线诊疗服务。
