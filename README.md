# RabbitWork

> 工程体系移植自 [RabbitAITest](https://github.com/)（RabbitAI-Lab）：九条硬性工作门禁 + rules 编码规范 + 测试纪律 + 槽位化并行开发 + CI 门禁。产品定位见 AGENTS.md §0（评审后填定）。

## 快速开始

```bash
pnpm install
pnpm dev          # web http://localhost:3600（embedded PG :6440 自动初始化 + migrate + seed）
```

验证：`curl http://localhost:3600/api/v1/system/ready` → 200。

## 常用命令

| 命令                               | 说明                                                         |
| ---------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                         | 一键开发栈（embedded-postgres + Redis + migrate/seed + web） |
| `pnpm lint` / `pnpm format`        | oxlint / oxfmt                                               |
| `pnpm typecheck`                   | tsc --noEmit（独立于 build）                                 |
| `pnpm test`                        | Vitest 单测 + scripts 单测（端口表守护）                     |
| `pnpm test:e2e`                    | Playwright UI 自动化（自动起栈，三类断言）                   |
| `pnpm test:api`                    | JMeter 接口自动化（需本机 jmeter）                           |
| `pnpm lint:boundaries`             | 模块边界静态检查                                             |
| `pnpm db:migrate` / `pnpm db:seed` | Prisma 迁移 / 种子                                           |

## 文档导航

- **开工必读**：[AGENTS.md](./AGENTS.md)（最高工作规范：九条硬性门禁）→ [docs/README.md](./docs/README.md)
- 规范细则：[rules/](./rules/)（9 份）；架构：[docs/architecture/](./docs/architecture/)
- 多 worktree 并行开发手册：[rules/git-workflow.md](./rules/git-workflow.md) §9.7

## 技术栈

pnpm + Turborepo 纯 TS Monorepo｜Next.js 15（App Router + React 19）全栈单应用｜AntD + Tailwind｜
embedded-postgres（可外接 PG16）+ Prisma｜BullMQ + Redis（预留）｜Vitest + Playwright + JMeter。
详见 [docs/architecture/tech-stack.md](./docs/architecture/tech-stack.md)。
