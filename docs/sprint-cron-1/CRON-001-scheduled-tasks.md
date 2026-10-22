# 定时任务

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | CRON-001 |
| 所属迭代   | sprint-cron-1（蓝图 S7 自动化） |
| 优先级     | P1 |
| 所属模块   | cron |
| 文档状态   | Implemented（2026-10-23；单测 98 / e2e 36 / jmx 9 计划全绿；走查待人工） |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | ScheduledTask/Run 表（一次建齐,零 DDL） · 员工发布链路（asAgentId） · conversations/messages 发送链路 |
| 下游消费   | BullMQ 队列化（引擎引入时迁移） |
| 上游依据   | 蓝图 §4 F5 / §6 S7;上游 automations 端点未实测（基线 404 预期——本地调度） |
| **高保真确认** | **批量待走查**：原型 `docs/design/CRON-001-scheduled-tasks/` |
| 工作量估算 | 后端 1.5 人日 / 前端 1 人日 / 联调 0.5 人日 |

## 1. 概述

定时任务首期：**本地轻量调度器**（随 web 进程 setInterval 扫描,单实例口径——多实例/持久化队列随 BullMQ 引擎迁移,登记 R-SCHEDULER）;cron 表达式触发「向指定员工发送 inputTemplate 消息」（复用 sendTurn 链路,run 留痕 ScheduledTaskRun + 关联 Conversation）。管理页 `/scheduled-tasks`。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 任务 CRUD（name/cron/employeeId/inputTemplate/enabled） | ✅ | — |
| cron 解析（5 段标准,shared 纯函数+单测） | ✅ | — |
| 调度器（60s 扫描,到期触发,防重入） | ✅ | R-SCHEDULER:单实例;BullMQ 迁移 |
| 触发执行：创建/复用会话 + 发消息（sendTurn 同构）+ run 留痕 | ✅ | — |
| 手动「立即执行一次」 | ✅ | — |
| AgentScope automations 映射 | ❌ | 上游端点未冻结（探测 404 预期） |
| 失败告警/重试策略 | ❌ | 队列化时 |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| CRON-001-C1 | /scheduled-tasks 列表（cron/enabled pill/lastRunAt/运行历史入口）+ 新建/编辑/删除 |
| CRON-001-C2 | cron 校验（非法表达式 422;下次触发时间预览） |
| CRON-001-C3 | 调度触发：到期→执行→run 留痕（SUCCEEDED/FAILED+error） |
| CRON-001-C4 | 立即执行一次（手动按钮） |
| CRON-001-C5 | 启用/停用切换;空态/未登录 |

## 2. 业务逻辑

1. **cron 解析**：5 段（分 时 日 月 周）,支持 `*` `,` `-` `/`;`parseCron(expr)` → 各字段位集（纯函数,单测矩阵）;`nextRunAt(cron, from)` 计算下次触发（分钟粒度,逐分钟扫描上限 366 天）。
2. **调度器**（`apps/web/src/server/scheduler.ts`,globalThis 单例挂载——Next dev 分包同 prisma 先例）：每 60s 扫 enabled 任务,`nextRunAt(lastRunAt ?? createdAt) <= now` 且无进行中 run → 触发;执行完更新 lastRunAt=now。**防重入**：任务级 inflight Set。时区：服务器本地（单机口径,登记）。
3. **执行体**：员工已发布校验 → 找/建 origin=TEAM? 新建 `origin="CRON"` 会话（originRef=taskId）→ 复用 OBS-003 开放面发消息同构逻辑（sendTurn）→ run 记录 status/error/output(回复摘要)。
4. 失败（员工未发布/上游错）→ run FAILED + error 原文;任务保持 enabled（连续失败告警随队列化）。

## 3. UI/UX 设计

原型 `docs/design/CRON-001-scheduled-tasks/`。列表卡（name/cron mono/enabled Switch/员工/lastRunAt）+ 行展开运行历史（最近 5 次 run 状态+时间+error 透出）+ 新建/编辑弹窗（cron 输入带下次触发预览）+「立即执行」按钮。

## 4. 技术架构

- shared `cron.ts`：`cronInput`（zod）/`parseCron`/`nextRunAt`/`describeCron`（中文摘要,如「每天 09:00」——常见模式匹配）纯函数 + 单测;
- API：`GET/POST /api/v1/scheduled-tasks`、`PATCH/DELETE /{id}`、`POST /{id}/run`（立即执行）、`GET /{id}/runs`;权限 ORG_RESOURCE:*（任务属组织资源）;
- scheduler.ts：启动钩子（instrumentation.ts register()——Next 官方启动入口）+ globalThis 单例;
- 前端：`/scheduled-tasks` 页 + 菜单「定时任务」（ClockCircleOutlined）;api-client cronApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| CRON-001-01 | 建任务（cron 每分钟,已发布员工）→ 等 70s → run 留痕 SUCCEEDED | e2e（test.setTimeout 180s） |
| CRON-001-02 | 立即执行 → run SUCCEEDED + 会话出现 | e2e |
| CRON-001-03 | 非法 cron 422;未登录 401;不存在 404 | jmx |
| 单测 | parseCron/nextRunAt/describeCron 矩阵（*/区间/列表/非法） | — |

## 6. 基线深度对标

蓝图 F5：automations 映射 + 执行历史 + 失败告警——本地调度对齐执行历史,映射与告警随上游冻结/队列化。

## 7. 里程碑与验收

交付清单：cron 纯函数+单测 → API+jmx → scheduler+instrumentation → 页面+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
