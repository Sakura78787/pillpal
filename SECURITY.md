# Security Policy

## 支持范围

当前项目为个人作品集和演示型 MVP，不承诺生产级医疗系统安全保障。

仍然欢迎报告以下问题：

- API Key、token 或敏感配置泄露风险
- RLS 权限隔离问题
- 未登录访问受保护数据
- AI 周报输出越过医疗安全边界
- 前端暴露 service-role key 或服务端密钥
- 能导致真实用户数据泄露的漏洞

## 不应提交的信息

请不要在 issue、PR、截图或日志中提交：

- 真实健康数据
- 处方、药品剂量、医院医生信息
- 身份证、手机号、家庭住址
- Supabase service-role key
- DashScope API Key
- Supabase access token

## 报告方式

如果是普通 bug，可以直接创建 GitHub issue。

如果涉及敏感信息，请先只描述问题类型和影响范围，不要公开贴出密钥、token 或真实用户数据。

## 医疗安全声明

PillPal 不提供诊断、处方、续方、在线问诊或用药调整建议。AI 周报仅整理用户已记录的信息，不能替代医生判断。
