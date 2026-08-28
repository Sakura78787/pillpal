# Contributing

感谢关注 PillPal。这个项目目前是一个慢病家庭照护方向的 Web MVP，欢迎通过 issue 或 pull request 交流。

## 开发流程

1. Fork 仓库并创建功能分支。
2. 安装依赖：

   ```bash
   npm install
   ```

3. 本地开发：

   ```bash
   npm run dev
   ```

4. 提交前至少运行：

   ```bash
   npm run lint
   npm test
   npm run test:ai
   npm run build
   ```

   `npm run lint` 采用 105 条既有告警的基线门槛：新增告警会使 CI 失败。请不要通过新增禁用注释来绕过检查；需要清理历史告警时，可用 `npm run lint:strict` 查看零告警目标。

## 代码约束

- 不要提交真实健康数据、处方信息、用户身份信息或 API Key。
- 不要把模型密钥放进前端环境变量。
- AI 输出相关改动应尽量补充评测样本或回归测试。
- 医疗相关文案必须保持非诊断、非处方、非用药调整建议的边界。

## Issue 建议格式

- 背景：你遇到了什么问题？
- 复现路径：如何触发？
- 预期行为：你希望它如何工作？
- 实际行为：现在发生了什么？
- 截图或日志：如有请附上，注意打码。

## Pull Request 建议格式

- 这次改了什么？
- 为什么要改？
- 如何验证？
- 是否涉及隐私、安全、费用或医疗边界？
