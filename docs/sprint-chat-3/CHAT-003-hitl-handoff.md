# HITL 审批与人工接管

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | CHAT-003 |
| 所属迭代   | sprint-chat-3（蓝图 S8 HITL 与接管） |
| 优先级     | P1 |
| 所属模块   | chat |
| 文档状态   | Implemented（2026-10-23；单测 100 / e2e 39 / jmx 10 计划全绿；走查待人工） |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | HumanHandoffRecord 表（一次建齐「列建齐不开功能」——本规格启用） · conversations/messages 链路 |
| 下游消费   | AgentScope approvals/inbox 推送（上游 200 但需 namespace-member 体系,登记 R-UPSTREAM-APPROVAL 为后续增强） |
| 上游依据   | 蓝图 §4 F6/F2（awaiting/HITL 交互）· §6 S8 |
| **高保真确认** | **批量待走查**：原型 `docs/design/CHAT-003-hitl-handoff/` |
| 工作量估算 | 后端 1 人日 / 前端 1 人日 / 联调 0.5 人日 |

## 1. 概述

本地 HITL 首期：① 对话页「转人工」——创建接管记录（PENDING）+ 会话进入 HANDOFF 态（员工暂停自动回复）;② 人工接管工作台 `/handoffs`——待处理列表、认领（HANDLING）、解决（RESOLVED,可附结论）;③ 解决后会话恢复自动回复。上游 approvals 推送为增强（R-UPSTREAM-APPROVAL）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 转人工（reason 必填）+ 会话 HANDOFF 态（暂停回复） | ✅ | — |
| 接管工作台：列表/认领/解决（结论可选） | ✅ | — |
| HANDOFF 态下发消息 → 422 明确提示（而非静默吞） | ✅ | — |
| AgentScope approvals 推送/同步 | ❌ | R-UPSTREAM-APPROVAL：需 namespace-member 体系（2026-10-23 实测 400 approver must be a namespace member） |
| 审批流（多级/条件） | ❌ | 后续 |
| inbox 通知渠道 | ❌ | CHNL-001 |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| CHAT-003-C1 | 对话页「转人工」按钮（reason 弹窗必填）→ 记录 PENDING + 会话 HANDOFF |
| CHAT-003-C2 | HANDOFF 态发消息 → 422「人工处理中」；页顶部黄条提示接管状态 |
| CHAT-003-C3 | /handoffs 列表（状态 pill/会话/发起人/原因）+ 认领 + 解决（结论） |
| CHAT-003-C4 | 解决 → 会话恢复（ACTIVE），对话可继续 |
| CHAT-003-C5 | 未登录 401/跳转;空态 |

## 2. 业务逻辑

```
会话 ACTIVE --转人工(reason)--> 记录 PENDING + 会话 status=HANDOFF
PENDING --认领--> HANDLING（handledBy=当前用户）
HANDLING|PENDING --解决(conclusion?)--> RESOLVED + 会话恢复 ACTIVE + 系统消息留痕「人工接管已解决」
```

- HANDOFF 态拦截：messages POST 前置校验 conversation.status==="HANDOFF" → 422（真实原因透出,§5.7）。
- 同一会话同时仅一条未 RESOLVED 记录（业务校验 422）。
- 系统留痕：转人工/解决各插一条 role=SYSTEM 消息镜像（对话内可见状态变化）。

## 3. UI/UX 设计

原型 `docs/design/CHAT-003-hitl-handoff/`。对话页：顶黄条（HANDOFF 态+「去处理」链接）+ 消息区「转人工」按钮（头部工具位）;/handoffs：状态过滤 Tab + 表格（行展开结论）+ 认领/解决操作。

## 4. 技术架构

- shared `chat.ts` 扩展：`handoffCreateInput`（reason ≤512 必填）/`handoffResolveInput`（conclusion? ≤1024）/`handoffDto`;Conversation.status 增 "HANDOFF"（列已 varchar,零 DDL）;
- API：`POST /api/v1/conversations/{id}/handoff`（转人工）、`GET /api/v1/handoffs?status=`、`POST /api/v1/handoffs/{id}/claim`、`POST /api/v1/handoffs/{id}/resolve`;权限：转人工=ORG_CHAT:SEND、工作台=ORG_CHAT:READ+UPDATE;
- messages POST 前置 HANDOFF 拦截;conversation DTO +status 已有;
- 前端：chat 页黄条+按钮、/handoffs 页 + 菜单「人工接管」（UserSwitchOutlined）;api-client handoffApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| CHAT-003-01 | 对话发消息→转人工（reason）→ 会话 HANDOFF+系统消息可见 | e2e |
| CHAT-003-02 | HANDOFF 态发消息 → 422「人工处理中」 | e2e |
| CHAT-003-03 | /handoffs 认领→解决（结论）→ 会话恢复,再发消息成功 | e2e |
| CHAT-003-04 | 重复转人工 422;未登录 401;reason 空 422 | jmx |
| 单测 | zod round-trip + 状态机派生 | — |

## 6. 基线深度对标

蓝图 §6 S8：approvals/inbox/转人工记录——本地全量落转人工记录与工作台;approvals 映射受上游 member 体系约束（实测登记）。

## 7. 里程碑与验收

交付清单：shared zod → API 四端点+jmx → chat 页黄条/按钮+ /handoffs 页+菜单 → e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
