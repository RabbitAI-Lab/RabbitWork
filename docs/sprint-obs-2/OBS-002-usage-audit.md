# 用量统计与审计日志

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | OBS-002 |
| 所属迭代   | sprint-obs-2（蓝图 S5 模型与运营收尾） |
| 优先级     | P1 |
| 所属模块   | obs |
| 文档状态   | Prototyped |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | OBS-001 /runs 页与看板 · UsageDaily/AuditLog 表（一次建齐,零 DDL） · RunRecord 终态写入链路（events 路由） |
| 下游消费   | OBS-003 API Key 审计联动 |
| 上游依据   | 蓝图 §4 F6（S2 起/S5）· §3.4 治理域 |
| **高保真确认** | **批量待走查**：原型 `docs/design/OBS-002-usage-audit/` |
| 工作量估算 | 后端 1 人日 / 前端 1 人日 / 联调 0.5 人日 |

## 1. 概述

治理域首份规格：① **用量日聚合**——run 终态时增量 upsert `usage_dailies`（员工×天,token/runs 计数）+ /runs 页「用量」Tab（按天条形 + Top 员工）;② **审计日志**——`audit()` 只插入 helper + 核心变更动作埋点 + 「审计」Tab（仅 ADMIN）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| UsageDaily 终态增量写入（upsert 幂等重放安全） | ✅ | — |
| 用量 Tab：14 天趋势条形 + Top5 员工表 | ✅ | — |
| audit() helper + 8 处核心动作埋点 | ✅ | — |
| 审计 Tab：分页列表（actor/action/target/时间）仅 ADMIN | ✅ | — |
| 定时归档任务/冷热分层 | ❌ | 队列体系 |
| 全路由自动审计中间件 | ❌ | 显式埋点为准（蓝图 §3.4 调用审计随 API Key 落地） |
| 计费口径/导出 | ❌ | OBS-003+ |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| OBS-002-C1 | 对话一轮终态 → usage_dailies 当日行 runs+1、tokenIn/out 累加 |
| OBS-002-C2 | 用量 Tab：14 天趋势（纯 CSS 条形,accent 语义色）+ Top5 员工（token 合计/次数） |
| OBS-002-C3 | 审计埋点：登录成/败、团队建/删、员工发布、工具/模型/MCP 建/删、KB 上传 |
| OBS-002-C4 | 审计 Tab：分页表（时间/actor/action/target）,非 ADMIN 403 |
| OBS-002-C5 | 空态/未登录 |

## 2. 业务逻辑

1. **用量写入**（events 路由 run 终态 persist 内,同事务外紧随）：`upsert usage_dailies`（employeeId+day 唯一键;runs+1,tokenIn+=summary.tokenIn??0,tokenOut+=同）——**upsert 增量**（事件重放会重复累加? persist 以 run 为单位且 run 终态只处理一次（run.status 已终态跳过）→ 天然幂等边界;登记 R-REPLAY：SSE 断线重连若重复处理终态将重复计数,以「run 终态只 persist 一次」的现状保证,队列化时改为按 runId 幂等）。
2. **审计**：`audit({actorId,action,targetType?,targetId?,detail?})` fire-and-forget（await 落库但不阻塞主流程失败——失败仅 warn 日志）;action 命名 `domain.verb`（如 `team.create`、`auth.login_failed`）。**只插入**（rules/database §8.2）。
3. **权限**：用量 Tab=ORG_RUN:READ（同 OBS-001）;审计 Tab=**仅 ADMIN**（域内显式 role 判断——requirePermission 的 MEMBER :READ 白名单会放行 MEMBER,不适用审计敏感面;规格登记该决策）。

## 3. UI/UX 设计

原型 `docs/design/OBS-002-usage-audit/`。/runs 页 Tabs 三元组（运行｜用量｜审计）。用量 Tab：14 天条形（div 高度=token 比例,accent 填充+hover 数值 title）+ Top5 表;审计 Tab：时间倒序表（action pill 语义色/actor 名/目标/时间）,非 ADMIN 显示无权限空态。

## 4. 技术架构

- `apps/web/src/server/audit.ts`：`audit()` helper（prisma.auditLog.create,catch→logger.warn）;
- events 路由：终态 persist 后追加 `upsertUsageDaily(...)`（同文件私有函数）;
- shared `obs.ts` 扩展：`usageDailyDto`/`usageSummaryDto`/`auditLogDto` zod;
- API：`GET /api/v1/usage/daily?days=14`（按天 sum + top 员工,Prisma groupBy）;`GET /api/v1/audit-logs?page=`（ADMIN 判定在 handler 内）;
- 埋点 8 处：auth/login（成/败）、teams POST/DELETE、staffs publish、tools POST/DELETE、models POST/DELETE、mcp POST/DELETE、kb documents POST——一行 `void audit(...)`;
- 前端：/runs 页 Tab 化 + 两新 Tab 组件;api-client obsApi.usage/auditLogs。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| OBS-002-01 | 对话一轮 → 用量 Tab 当日 token>0 且 Top 员工含该员工 | e2e |
| OBS-002-02 | 建团队 → 审计 Tab 出现 team.create | e2e |
| OBS-002-03 | 审计接口未登录 401;（MEMBER 403 豁免——无种子账号,规格登记） | jmx |
| OBS-002-04 | usage daily 422（days 越界） | jmx |
| 单测 | usage upsert 增量纯逻辑（day 归一 UTC）+ zod round-trip | — |

## 6. 基线深度对标

蓝图 §3.4：UsageDaily 按员工/天聚合、AuditLog 只插不更——对齐;差异：调用级审计（statusCode/latency）随 API Key 网关落地,本切片为动作级。

## 7. 里程碑与验收

交付清单：audit helper+埋点 → usage 写入 → 两个查询 API+jmx → /runs 三 Tab+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
