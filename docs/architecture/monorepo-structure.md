# Monorepo 仓库结构规范

| 元信息项 | 内容                                           |
| -------- | ---------------------------------------------- |
| 文档层级 | 架构文档（全局约束）                           |
| 状态     | 已确认（Approved）                             |
| 上游依据 | tech-stack.md（全栈 Next.js + 纯 TS Monorepo） |
| 下游消费 | 全部功能规格 §4                                |

---

## 1. 顶层目录树（当前实况）

```
rabbitwork/
├── apps/
│   └── web/                      # ★ 全栈 Next.js（App Router）
│       ├── src/app/              #   页面路由
│       ├── src/app/api/v1/       #   REST Route Handlers（system/health、system/ready）
│       ├── src/server/           #   服务端实现（只在 Node runtime 执行）
│       │   ├── db.ts             #     PrismaClient 门面（唯一数据访问出口）
│       │   └── redis.ts          #     Redis 单例
│       ├── src/components/       #   业务组件（随域建立 {domain}/ 目录）
│       └── src/middleware.ts     #   reqId 链路入口
│   ├── engine/                   # （预留）后台 worker：runner / kernel / samplers
│   └── mock/                     # （预留）Mock 服务
├── packages/
│   ├── db/                       # ★ Prisma schema + migrations + client（全仓唯一数据访问出口）
│   ├── shared/                   # zod schema / 枚举 / 错误码 / 权限点 / logger（多端契约源）
│   ├── ui/                       # AntD 二次封装的通用组件（不依赖业务态）
│   └── api-client/               # 前端唯一 HTTP 层（信封解包 + ApiError）
├── docs/                         # 文档体系（含 design/ 高保真原型，见 AGENTS.md 门禁 2）
├── rules/                        # 研发规范细则（9 份，AGENTS.md §2 引用）
├── deploy/                       # docker-compose（Dockerfile 在仓库根，multi-stage）
├── scripts/                      # dev / rabbit-env（槽位单一事实源）/ check-boundaries 等
└── tests/                        # Playwright E2E + JMeter 接口自动化
```

## 2. 分包规则

1. **域包只准经 Provider 接口跨域引用**：下游域读上游域实体必须走 `xxxRefProvider.listRefSummary()` 形态，禁止直接 import 他域服务/查表（dependency-graph §4.2；红线登记 `scripts/check-boundaries.domains.json`）。
2. **worker 独立性**：`apps/engine`（引入时）不得依赖 `apps/web` 与 `packages/db`（无数据库访问）；仅通过 BullMQ 队列 + HTTP 回调与 web 交互，保证可独立部署。
3. **packages/db 是唯一 Prisma 出口**：只有 `apps/web/src/server` 使用；engine/mock 一律不得直连数据库。
4. **packages/shared 是多端契约源**：错误码、权限点、跨进程 schema 在此定义，web/worker 共享（编译期防契约漂移）。
5. `packages/ui` 不依赖业务状态与 api-client；业务组件放 `apps/web/src/components`。

## 3. Turbo 任务管道

```
build:    packages/shared → packages/db(client) → packages/api-client → packages/ui → apps/web
lint:     并行全部（oxlint）
test:     packages(vitest) ∥ apps(vitest) + 根 node --test scripts/
dev:      scripts/dev.mjs（embedded PG + Redis + migrate/seed + web）
```

单语言仓，无跨语言编排；`scripts/dev.mjs` 负责自动拉起 embedded-postgres 并执行 migrate。

## 4. 代码所有权与命名

- 分支：main 保护 + 短生命周期分支，命名 `{MODULE}-NNN-{slug}`（与文档编号一致，见 AGENTS.md §5）
- `apps/web/src/server/domains/`（随域建立）域目录与文档模块缩写一一对应（`case/` ↔ `CASE-NNN` 规格），评审按文档编号定位代码
- commitlint（Conventional Commits，scope=模块缩写）
