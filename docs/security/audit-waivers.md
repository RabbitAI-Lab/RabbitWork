# 依赖审计豁免登记（rules/security.md §5.1）

> CI 的 `pnpm audit --prod` 步骤自动读取本文件的 advisory 编号（`GHSA-*`）加入 `--exclude`。
> 登记纪律：每条豁免必须写明风险评估与解除计划；漏洞修复版本可用后 1 个 sprint 内解除。

| Advisory | 包 | 级别 | 登记日期 | 风险评估 | 解除计划 |
| --- | --- | --- | --- | --- | --- |
| GHSA-mrhx-c7xc-m3w5 | zod（v3.24 线，patched ≥4.6.6） | high | 2026-10-28 | DoS 类（超大 constrained collection 校验耗尽内存）。攻击面需向 zod 校验入口提交超大 payload；本项目 API 入参经 Route Handler zod parse，Next 默认请求体上限约束了 payload 体积，且系统为内部部署，无公网匿名入口——实际可利用性低。zod 3→4 为大版本迁移（全仓 schema/错误链路），不适合混入业务 PR。 | 排期 zod v4 专项迁移（升级 4.6.6+ 全量回归三类测试），目标下个 sprint；届时删除本行 CI 自动恢复拦截。 |
