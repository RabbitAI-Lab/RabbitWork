# 术语表

> 术语与模型映射：实现与文档用词必须一致（同名覆盖、状态语义等在实现处按本表解释）。
> 随域扩展持续登记；新术语必须先入本表再入代码。

| 术语 | 英文/模型映射 | 定义 |
| ---- | ------------- | ---- |
| 工作门禁 | Gate | AGENTS.md 定义的硬性工作流约束（违反即停止开发） |
| 高保真原型 | Hi-fi prototype | `docs/design/{MODULE}-NNN-{slug}/` 下可浏览器走查的静态原型（门禁 2 载体） |
| 走查 | Walkthrough | 实现完成后与原型逐项对照的人工检查（批次登记：走查①②③…） |
| 响应信封 | Envelope | `{code, message, data}` 统一响应结构（api-conventions §2） |
| 权限点 | Permission point | `{SCOPE}_{RESOURCE}:{ACTION}` 格式的原子授权单元（rbac §3） |
| 三级作用域 | Scopes | system → organization → project（rbac §1） |
| 槽位 | Slot | worktree 并行隔离单位（0-9），环境资源标识的推导键（rules/git-workflow §9） |
| 三类断言 | Three assertion types | UI 断言 + Console 断言 + 接口断言（rules/testing §3.1） |
| 四类场景×四项断言 | JMeter matrix | 接口自动化覆盖矩阵（rules/testing §2） |
| 一次建齐 | Build-once | 核心表随域首份规格建齐全部列的门禁（AGENTS.md 门禁 3） |
| Provider 接口 | Provider interface | 跨域读实体的唯一合法通道（dependency-graph §4.2） |
| expand-contract | — | 破坏性 schema 变更的安全路径：加列双写→迁移→切读→删列（rules/database §6.3） |
| 域 | Domain | `apps/web/src/server/domains/{domain}` 的业务分包单位，与文档模块缩写一一对应 |
| 冒烟用例 | Smoke test | 起栈即验的最小 E2E（如 INFRA-001 脚手架冒烟） |
| Release Gate | — | 发布门槛：主链路 E2E + 全量 tests 绿 |
| （业务术语） | — | **随首个产品域规格登记** |
