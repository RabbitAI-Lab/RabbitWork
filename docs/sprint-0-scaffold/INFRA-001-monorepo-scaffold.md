# Monorepo 工程脚手架（自 RabbitAITest 移植全部工程经验）

| 元信息项     | 内容 |
| ------------ | ---- |
| 文档编号     | INFRA-001 |
| 所属迭代     | sprint-0-scaffold |
| 优先级       | P0 |
| 所属模块     | infra |
| 文档状态     | Implemented（2026-10-10，待走查） |
| 最后更新日期 | 2026-10-10 |
| 上游依赖     | RabbitAITest 仓库工程体系（外部参考：/Users/xujialiang/Documents/GitHub/RabbitAITest） |
| 下游消费     | 全部后续规格（工程基线） |
| 高保真确认   | 不适用（纯工程类；以本文验收口径替代——契约评审=本文 §4/§5 的实现对照） |
| 工作量估算   | —（一次性交付） |

## 1. 概述

### 1.1 功能定位

RabbitWork 的工程起点：把 RabbitAITest（RabbitAI-Lab 前代项目）在一个完整产品周期里沉淀的**全部工程经验**——九条硬性门禁、九份编码规范、测试纪律、CI 工程纪律、槽位化并行开发、AI 协作红线——原样移植为本仓的工作基线，使后续产品开发从第一天就在成熟流程上跑。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 工程结构/规范/CI/槽位环境/测试纪律 | ✅ | — |
| OpenAPI 快照与客户端生成管线 | ❌ | 首个 API 落地时移植（gen-openapi.mjs） |
| e2e 常驻库/web 副本/视觉比对工具 | ❌ | 对应痛点出现时移植（rules/testing §3.4.2/§3.6 已留口径） |
| 产品域功能 | ❌ | 产品定位评审后的首个迭代 |
| 后台 worker（apps/engine） | ❌ 预留 | 需要时按 rules/engine.md 建（规范已先行移植） |

## 2. 移植决策记录

1. **门禁体系全量保留**（含排序铁律、一次建齐、三类断言、远程 CI 纪律）——它们是前代项目最贵的教训沉淀。
2. **端口基址整体偏移**（dev 3600+/e2e 3700+/jm 3800+/PG 6440+/Redis 6390/6391）：RabbitWork 与 RabbitAITest 的 worktree 槽位推导相互独立，同机会撞同基址端口；Redis 用独立实例端口而非共享实例换逻辑库（逻辑库 0-15 容不下两项目×10 槽）。该不变量由 `scripts/rabbit-env.test.mjs` 锁定。
3. **域相关内容转为占位**：MeterSphere 对标、测试域数据模型、执行引擎/插件架构文档不移植；权限三级模型（系统-组织-项目）作为家族基线保留并已建最小 schema 载体。
4. **工具链按需移植**：规范先行、工具后置（pg-e2e/visual-diff/e2e-web-copy/gen-openapi），避免维护无人使用的代码；规范中均已标注移植时机。
5. **schema 只建基线**：User/Organization/OrgMember/Project/ProjectMember（三级模型载体）；业务域表严格等首个域规格一次建齐（门禁 3 从本仓第一天生效）。

## 3. 交付清单

见 [sprint-overview.md](./sprint-overview.md) 交付表（12 项）。

## 4. 技术架构

- 工程：pnpm workspace（apps/* + packages/*）+ Turborepo；TS strict + noUncheckedIndexedAccess 全仓基线。
- packages：`shared`（信封/错误码/权限点/logger）→ `db`（Prisma 唯一出口 + 基线 schema + 幂等 seed）→ `api-client`（信封解包/ApiError/FormData 保护）→ `ui`（通用组件位）。
- apps/web：Next 15 App Router；Tailwind 4 + AntD（React 19 patch）+ TanStack Query；`middleware.ts` 生成 reqId；`/api/v1/system/health`（liveness）与 `/ready`（readiness：DB 恒检、Redis 配置才检）；安全响应头。
- 测试：Vitest（shared 单测）+ Playwright（三类断言夹具 + 冒烟 + 录屏/trace/自动截屏）+ JMeter 执行器（`scripts/run-api-tests.sh`，CSV 真校验）。
- CI：changes 探测（docs-only 直通）→ quality（lint/typecheck/test/audit）→ build → migrate-replay（空库重放 + diff + seed 幂等）∥ e2e（PG/Redis service）→ ci-gate 锚点；actions 固定 SHA；`permissions: contents: read`。
- 部署：Dockerfile multi-stage（base/webbuild/web/toolbox）+ deploy/docker-compose.yml（db/redis/minio-full/migrator/web）。

## 5. 测试用例

| 编号 | 类型 | 文件 | 断言 |
| ---- | ---- | ---- | ---- |
| envelope ×3 | Vitest | packages/shared/src/__tests__/envelope.test.ts | 信封形态/DomainError/权限点格式 |
| rabbit-env ×5 | node --test | scripts/rabbit-env.test.mjs | 槽位推导/端口唯一/跨项目零交叠 |
| INFRA-001-01 | Playwright | tests/e2e/INFRA-001-scaffold-smoke.spec.ts | UI（标题/副标题/Tailwind computed-style）+ Console（零错误）+ 接口（health 200/code=0/X-Request-Id、ready 200/DB ok） |

## 6. 演示脚本（走查①用）

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test      # 全绿
node scripts/rabbit-env.mjs                   # 槽位端口表
pnpm dev                                      # web :3600；另开窗口 curl :3600/api/v1/system/ready → 200
pnpm test:e2e                                 # 全新口径自动起栈跑冒烟
```

## 7. DoD

sprint-overview 验收标准 1-5 全过；远端 CI 绿后状态流转 Verified。
