# RabbitWork 设计文档体系

> 工程体系移植自 RabbitAITest（RabbitAI-Lab 家族实践）· 全量设计文档导航索引

---

## 一、项目简介

**【待定】RabbitWork 的产品一句话与对标基线必须在首个产品规格评审前填定**（AGENTS.md §0）。
在此之前，本仓交付的是**工程脚手架**：Monorepo 工程结构、九条硬性工作门禁、rules 编码规范、
测试纪律（三类断言）、CI 门禁与槽位化开发环境——产品域文档（需求总纲、域数据模型、模块清单）
随首个迭代按同一套文档体系产出。

## 二、技术栈概要

| 层次      | 选型                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| 工程      | pnpm workspace + Turborepo **纯 TypeScript Monorepo**                                                            |
| 全栈框架  | **Next.js（App Router + React 19）**：UI 与 API（Route Handlers，REST /api/v1）同应用承载                        |
| 前端      | React 19 + Ant Design + Tailwind CSS + TanStack Query（Zustand 引入时登记）                                       |
| 数据库    | **embedded-postgres**（默认内嵌免外部 DB，`DATABASE_URL` 可外接 PostgreSQL 16）+ Prisma（`packages/db` 唯一出口） |
| 异步/实时 | BullMQ + Redis（随任务体系引入）；SSE 事件流（随实时功能引入）                                                     |
| 后台 worker | Node.js worker（`apps/engine`，**预留**；编码规范 rules/engine.md 已先行移植）                                  |
| 部署      | web（含内嵌 PG）+ redis（+minio）；Docker Compose 一键                                                            |

详见 [architecture/tech-stack.md](architecture/tech-stack.md)。

## 三、文档体系（三层结构）

```
第一层：架构文档（architecture/）—— 全局约束，一次确定长期遵循
第二层：迭代概览（sprint-*/sprint-overview.md）—— 每个迭代交付什么、验收什么
第三层：功能规格（sprint-*/MODULE-NNN-*.md）—— 单功能完整规格（模板见 plan/功能规格模板.md）
```

阅读路径：`glossary.md` → `architecture/tech-stack.md` → `architecture/monorepo-structure.md` → 当前迭代概览 → 功能规格。
开发某功能前，必须先读其元信息表「上游依赖」列出的文档。

> **工作流硬性门禁**（文档先行、**高保真原型 + 人工确认后才能开发**、一次建齐数据模型、API 契约纪律等）统一定义在仓库根 [AGENTS.md](../AGENTS.md)（CLAUDE.md 与其同步），此处不重复。

## 四、迭代里程碑总览

| 里程碑 | 周 | Sprint | 主题 | 文档数 | 状态 |
| ------ | -- | ------ | ---- | ------ | ----- |
| M0 | W0 | [sprint-0-scaffold](./sprint-0-scaffold/sprint-overview.md) | 工程脚手架（本仓起点） | 2 | Implemented（2026-10-10，待人工走查） |
| M1+ | — | — | 产品迭代（**待产品定位评审后规划**） | — | — |

## 五、架构文档索引

| # | 文档 | 标题 | 备注 |
| - | ---- | ---- | ---- |
| 1 | [tech-stack.md](architecture/tech-stack.md) | 技术栈确认与版本锁定 | 继承 RabbitAITest 既定选型 |
| 2 | [monorepo-structure.md](architecture/monorepo-structure.md) | Monorepo 仓库结构规范 | apps/web + packages 四包 |
| 3 | [api-conventions.md](architecture/api-conventions.md) | REST API 统一规范 | 路径/信封/错误码分段 |
| 4 | [rbac-permission-model.md](architecture/rbac-permission-model.md) | 三级权限模型 | 系统-组织-项目 |
| 5 | [dependency-graph.md](architecture/dependency-graph.md) | 模块依赖关系图 | 骨架（域 DAG 随首个域规格产出） |

## 六、功能规格索引

> 随迭代产出时在本节补全；规格必须用 [plan/功能规格模板.md](./plan/功能规格模板.md) 的固定七章结构。

## 七、支撑文档

| 文档 | 说明 |
| ---- | ---- |
| [glossary.md](./glossary.md) | 术语表（含模型映射，随域扩展） |
| [plan/功能规格模板.md](./plan/功能规格模板.md) | 规格文档统一模板（元信息表/能力表§1.2/用例表§5/交付清单§7） |
| [design/README.md](./design/README.md) | 高保真原型目录说明（AGENTS.md 门禁 2） |
| [security/mimosa-fp-ledger.md](./security/mimosa-fp-ledger.md) | Mimosa 误报台账（rules/security §8） |
| [../rules/](../rules/) | 研发规范细则（9 份，AGENTS.md 引用） |
