# PillPal 当前状态交接：真实家庭授权与站内通知 MVP

- 日期：2026-08-23
- 分支：`codex/care-auth-notifications`
- 发布状态：仅本地实现；远程 Supabase migration、Netlify Preview 和 Production 均未执行。

## 当前能力

- 被照护人输入并二次核对照护人邮箱；照护人用该邮箱 Magic Link 登录后自动领取授权。一个被照护人可授权多位照护人，且可随时撤销。
- `/care` 仅展示有效授权对象的最近 7 天只读摘要；原始业务表仍保持本人 RLS，跨账号摘要和 AI 上下文由 Netlify 服务端在每次请求时校验授权后读取。
- AI 周报使用 `subject_user_id` 区分请求人与数据归属人；跨账号任务创建与读取都会重新校验授权。
- 站内通知覆盖库存预警、三天内复诊、记录待确认和照护人固定服药提醒；首页铃铛、通知中心、未读状态、Realtime 和四小时提醒限频已实现。

## 明确边界

- 无被授权方确认页、Push、短信、微信、自由文本、回复、代打卡、远程编辑、审计日志或 Cron。
- “待确认”不表述为“漏服”；健康数据仅展示记录，不作病情判断。
- AI 的既有质量 Gate 仍未通过，不能包装为医疗效果或线上发布通过。

## 下一验证门

1. Sakura 确认后应用 `20260823000000_care_authorizations_and_notifications.sql` 到非 Production Supabase 项目。
2. 用两账号完成授权、登录领取、只读概览、AI、提醒、铃铛、撤销的手机与桌面验收。
3. 再创建 Netlify Preview；Production 另行确认。
