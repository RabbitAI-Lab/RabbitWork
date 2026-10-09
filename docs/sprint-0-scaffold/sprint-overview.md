# Sprint 0 — 工程脚手架

| 元信息项     | 内容 |
| ------------ | ---- |
| 主题         | RabbitWork 工程脚手架（自 RabbitAITest 移植全部工程经验） |
| 状态         | Implemented（2026-10-10；待人工走查与远端 CI 确认） |
| 文档         | [INFRA-001-monorepo-scaffold.md](./INFRA-001-monorepo-scaffold.md) |

## 交付清单

| # | 交付物 | 位置 | 状态 |
| - | ------ | ---- | ---- |
| 1 | Monorepo 工程结构（pnpm + Turbo + TS strict 基线） | package.json / turbo.json / tsconfig.base.json | ✅ |
| 2 | 九条硬性工作门禁 + 阅读顺序 | AGENTS.md / CLAUDE.md | ✅ |
| 3 | rules/ 研发规范 9 份（typescript/react-nextjs/database/testing/git-workflow/security/observability/ai-collaboration/engine-预留） | rules/ | ✅ |
| 4 | 架构文档 5 份 + 规格模板 + 术语表 + 误报台账模板 | docs/ | ✅ |
| 5 | 槽位化环境单一事实源（端口基址相对 RabbitAITest 整体偏移，跨项目并行零冲突） | scripts/rabbit-env.mjs + rabbit-env.test.mjs | ✅ |
| 6 | 一键开发栈（embedded PG + Redis 复用/拉起 + migrate/seed + web） | scripts/dev.mjs | ✅ |
| 7 | packages 四包（shared 契约/db Prisma 基线/api-client/ui） | packages/ | ✅ |
| 8 | apps/web 最小骨架（Tailwind+AntD+TanStack Query 装配、reqId 中间件、health/ready 端点、安全响应头） | apps/web/ | ✅ |
| 9 | Playwright 三类断言纪律 + 脚手架冒烟用例 + 录屏/trace/自动截屏 | tests/ | ✅ |
| 10 | CI 门禁（changes 探测 docs-only 直通 / quality / build / migrate-replay / e2e / audit / ci-gate 锚点，actions 钉 SHA） | .github/workflows/ci.yml | ✅ |
| 11 | Docker multi-stage + docker-compose | Dockerfile / deploy/ | ✅ |
| 12 | commitlint + husky pre-push + oxfmt 自愈安装 | 根配置 | ✅ |

## 验收标准

1. `pnpm install && pnpm lint && pnpm typecheck && pnpm test` 全绿（本地）
2. `pnpm dev` 一键起栈：web :3600 + embedded PG :6440 + Redis；`/api/v1/system/health` 200、`/ready` 200
3. `pnpm test:e2e` 全新口径绿（global-setup 自动起 PG + migrate + seed + web 生产构建）
4. `node scripts/rabbit-env.mjs` 输出槽位端口表；`node --test scripts/rabbit-env.test.mjs` 锁定端口唯一性与跨项目零交叠
5. 远端 GitHub Actions 全绿（AGENTS.md 门禁 9；**push 后必须跟踪至绿**）

## 遗留项与风险

| 项 | 去向 |
| -- | ---- |
| 产品定位（§0 一句话）与首个迭代规划 | 人工决策：评审后填定 AGENTS.md §0 与 docs/README §一 |
| OpenAPI 快照/生成管线（门禁 4 的 CI 校验） | 首个 API 落地时自 RabbitAITest scripts/gen-openapi.mjs 移植 |
| e2e 常驻库 pg-e2e / web 副本 e2e-web-copy 工具 | 首个迭代出现修复循环痛点时移植（rules/testing §3.4.2 已留接口） |
| 视觉还原度比对（visual-diff + GLM 多模态） | 首个 UI 迭代移植（rules/testing §3.6 已留口径） |
| CODEOWNERS / 分支保护规则配置 | 建仓后在 GitHub 设置（required checks 认 ci-gate 锚点） |
| 走查①（脚手架自查） | 人工：按 INFRA-001 §7 演示脚本过一遍 |
