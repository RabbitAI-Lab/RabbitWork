# 技术栈确认与版本锁定

| 元信息项     | 内容                                            |
| ------------ | ----------------------------------------------- |
| 文档层级     | 架构文档（全局约束）                            |
| 状态         | 已确认（Approved）                              |
| 最后更新日期 | 2026-10-10                                      |
| 下游消费     | 全部 sprint 与功能规格文档、AGENTS.md §2        |
| 决策原则     | **全栈 TypeScript 单语言 Monorepo**；中间件最少化 |

---

## 1. 选型总表

| 层次         | 选型                                                | 版本锁定 | 说明 |
| ------------ | --------------------------------------------------- | -------- | ---- |
| 工程结构     | pnpm workspace + Turborepo（**纯 TypeScript**）    | pnpm 10 / Turbo 2 | 单语言仓，无跨语言工具链 |
| 应用框架     | **Next.js（App Router）+ React 19 + TypeScript**   | Next 15 / React 19 / TS 5.x | **全栈单应用** `apps/web`：UI + API（Route Handlers，REST `/api/v1`）+ Server Actions 同仓承载 |
| UI 体系      | Ant Design（React 19 兼容版本）+ Tailwind CSS 4    | — | AntD 提供企业级表格/表单/树组件；React 19 需 `@ant-design/v5-patch-for-react-19` |
| 状态与数据   | TanStack Query（服务端状态）+ Zustand（客户端状态，引入时登记） | — | 与 RSC/App Router 适配的请求缓存与轻量全局态 |
| 校验与契约   | zod（schema 单一来源）→ OpenAPI/客户端生成          | — | schema 定义于 `packages/shared`；OpenAPI 快照与客户端生成管线随首个 API 落地接入（RabbitAITest scripts/gen-openapi.mjs 先例） |
| ORM          | Prisma                                              | 6.x | `packages/db` 唯一数据访问出口（schema + migration + client） |
| **数据库**   | **embedded-postgres**（@embedded-postgres/node）+ Prisma | PG 16 | **开发与单机部署内嵌运行、免外部数据库**；`DATABASE_URL` 可切换外部 PostgreSQL |
| 异步任务     | BullMQ（worker + repeatable 定时任务）+ Redis      | BullMQ 5 / Redis 7 | **预留**：随任务体系引入 |
| 实时通道     | **SSE**（Next Route Handler 流式响应）             | — | **预留**：日志/状态推送；Redis Stream 存档支持断线按 seq 续传（无需独立 WS 服务） |
| 后台 worker  | Node.js TypeScript worker（`apps/engine`）         | Node 20+ | **预留**：自研 worker（undici + p-limit）；编码规范 rules/engine.md 已先行移植 |
| 对象存储     | MinIO（S3 兼容）                                    | — | **预留**：附件/文件管理/导出（compose full profile） |
| 质量工具     | Vitest + coverage（单测）；Playwright（E2E）；JMeter（接口自动化）；oxlint + oxfmt（Lint/格式） | — | 主链路 E2E 作为 Release Gate |

## 2. 继承自 RabbitAITest 的既定决策（为什么是这套栈）

| 决策 | 理由 |
| ---- | ---- |
| 全栈 Next.js 单应用（TS）而非前后端分仓 | 团队栈统一 TypeScript；前后端同仓共享 zod schema/类型，契约漂移在编译期暴露 |
| embedded-postgres 内嵌 + Redis（中间件≤2 个起步） | 开发与单机部署零外部 DB 依赖，减少运维面；`DATABASE_URL` 可切外部 PG |
| SSE 而非 WebSocket | 单向日志/状态推送足够；免独立 WS 服务，Next 原生支持；Redis Stream 断线续传 |
| 自研 Node worker 而非 JVM 系引擎 | 无 JVM 运行时依赖；事件/变量/断言模型原生可控（若产品需要执行引擎） |
| 纯 TS 单语言 | 无跨语言编排成本；Go CLI 等单点例外须走架构评审登记 |

## 3. 版本锁定纪律

- 依赖版本在 `pnpm-lock.yaml` 锁定，升级走独立 PR + 全量回归
- PostgreSQL / Redis 大版本升级视为 INFRA 级变更，需架构评审（embedded-postgres 与外部 PG 版本对齐验证）
- Node 运行时版本在 `.nvmrc` 固定（20）；包管理器版本经 `packageManager` 字段锁定

## 4. 环境要求

Node.js 20+、Redis 7+（可选外部 PostgreSQL 16）。
开发态 `pnpm dev` 自动初始化 embedded-postgres 数据目录并执行 `prisma migrate deploy` + 种子数据。
