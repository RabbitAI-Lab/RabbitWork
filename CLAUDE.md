# CLAUDE.md

> 本仓库的完整工作规范见 [AGENTS.md](./AGENTS.md)（规范冲突时以 AGENTS.md 为准）。

核心约束速览（详见 AGENTS.md）：

1. **高保真门禁（含任务排序铁律）**：每个功能点必须先产出高保真原型（`docs/design/{MODULE}-NNN-*/`），人工确认后才能开始功能迭代开发；规格元信息「高保真确认」字段未确认不得编码。**排序是硬约束**：任务清单中「产出原型」必须排在对应功能编码之前，禁止原型未产出即编码、禁止「开发完再补原型」；可后置的仅**人工确认与走查**，原型文件未创建前规格不得写「原型已产出」。
2. **文档先行**：无 Approved 规格文档（`docs/sprint-*/MODULE-NNN-*.md`，按 `docs/plan/功能规格模板.md` 七章结构）不得开发对应功能。
3. **技术栈**：Monorepo（pnpm + Turborepo，纯 TS）｜全栈 Next.js（App Router，API 走 Route Handlers /api/v1）｜React 19 + AntD + Tailwind｜**embedded-postgres**（可外接 PostgreSQL 16）+ Prisma｜BullMQ + Redis（预留）。
4. **自动化测试 = 完成的定义**：功能点完成必须交付 ① Vitest 单测；② **JMeter 接口用例**（`tests/api/`，四类场景 + 状态码/业务码/JSONPath/响应时间四项断言）；③ **Playwright UI 用例**（`tests/e2e/`，每条必须同时含 **UI 断言 + Console 断言（无 error/pageerror）+ 接口断言（网络请求状态码/响应体/请求负载）** 三类断言）。缺一项 PR 不合并；主链路 E2E 全绿是 Release Gate。
5. **数据模型一次建齐**：核心域表随域首份规格在 `packages/db/prisma/schema.prisma` 建齐全部列，禁止反复 DDL；命名/索引/查询/迁移细则见 rules/database.md（禁拼 SQL、禁 N+1、migration 只增不改、破坏性变更走 expand-contract）。
6. **API 纪律**：遵循 `docs/architecture/api-conventions.md`；schema 用 zod 定义于 `packages/shared`；前端只用 `packages/api-client`。
7. **模块边界**：跨域引用走 Provider（`pnpm lint:boundaries` 拦截）；worker 不得依赖 web 与 db。
8. **阅读顺序**：AGENTS.md → docs/README.md → docs/architecture/tech-stack.md → 当前 sprint-overview → 功能规格 → 按工作内容读 rules/（完整规范地图见 AGENTS.md §2）。
9. **Playwright UI 用例必须录屏**（video: on-with-retry）+ trace（retain-on-failure）+ 失败截图 + **每用例自动整页截屏**（fixtures 已内置）。
10. **远程 CI 与 Sprint 交付**：以 GitHub Actions 远端结果为准（本地过 ≠ 完成）；main 必须保持绿（变红 stop the line）；**每个 Sprint 收尾必须 commit + push 到远程且远端 CI 全绿**（流程：rules/git-workflow.md §8），禁止代码只留本地。

11. **环境复用优先（修复循环效率铁律）**：「逐条修复×每轮重建环境」预计/实际超 **30 分钟**必须评估复用：e2e 用 `E2E_DATABASE_URL`/`E2E_REDIS_URL` 跳过重建；最终验收跑一次全新口径保证与 CI 一致；能增量就增量、能复用就复用（细则 AGENTS.md §4.1 / rules/testing §3.4.2）。

12. **并行 worktree 槽位隔离**：多 worktree 并行时端口/Redis 键空间/共享 /tmp 路径按槽位隔离（`RABBIT_SLOT` > 目录名 `RabbitWork-s{N}` > 主仓/CI=0），**禁止硬编码端口**，一律出自 `scripts/rabbit-env.mjs`（e2e 用例侧 `tests/e2e/env.ts`）；端口表与**启动操作手册**见 AGENTS.md §4.2 / rules/git-workflow.md §9·§9.7。端口基址相对 RabbitAITest 整体偏移（dev 3600+/e2e 3700+/PG 6440+/Redis 6390·6391），同机两项目并行零冲突。

@rules/typescript.md

@rules/react-nextjs.md

@rules/testing.md

@rules/database.md

@rules/engine.md

@rules/security.md

@rules/git-workflow.md

@rules/observability.md

@rules/ai-collaboration.md
