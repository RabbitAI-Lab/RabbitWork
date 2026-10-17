# rabbitWork_zcode — 数字员工平台 S1 实现(ZCode 工作副本)

> 本目录是 RabbitWork 的工作副本(**槽位固定 1**:web **3601** / PG **6441** / Redis db1),
> 按 [docs/plan/digital-employee-platform-blueprint.md](../RabbitWork/docs/plan/digital-employee-platform-blueprint.md)(最终版 v1.0)
> 落地 S1 主链路:**STAFF-001 员工创建/发布 + CHAT-001 对话(SSE 流式)+ SYS-001 最小认证 + INFRA-002 AgentScope 适配层**。

## 启动

```bash
pnpm install
pnpm dev        # http://localhost:3601 · 自动起 embedded PG(6441)+ migrate + seed
```

登录:`admin@rabbitwork.local` / `rabbit123`(seed,可用 `SEED_ADMIN_PASSWORD` 覆盖)。

验证:`curl http://localhost:3601/api/v1/system/ready` → 200。

## AgentScope 运行面配置(apps/web/.env)

| 变量                               | 说明                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `AGENTSCOPE_MODE`                  | `mock`(默认,内置脚本回复,CI 用)/ `real`(连真实实例)                      |
| `AGENTSCOPE_BASE_URL`              | 实例地址(自部署 2.0.10 托管控制台版)                                     |
| `AGENTSCOPE_USERNAME` / `PASSWORD` | 服务账号(JWT 自动登录,7 天有效期内缓存)                                  |
| `AGENTSCOPE_TENANT` / `NAMESPACE`  | 多租户作用域(实例为 multi 模式,agent 需在对应 namespace)                 |
| `AGENTSCOPE_FALLBACK_AGENT_ID`     | 回退 agent:新建 agent 卡 provisioning 时兜底(实例需控制台完成运行时配置) |

**已实测冻结的契约**(2026-10-17,详见 `packages/agentscope/src/`):
登录 `POST /api/auth/login`;建 agent `POST /api/v1/agents`;对话 `POST /api/v1/chats`(**不带消息建空 chat**)+ `POST /api/v1/chats/{id}/turns`(turn 响应含 `eventStreamUrl`);事件回放 `GET /api/v1/sessions/{sessionId}/events?chatId=…`;事件信封 `item.delta / item.completed(final_output) / usage.recorded / run.ended`。

## 本副本新增结构

```
packages/agentscope/        # AgentScope 适配层(唯一出口):real 客户端 + mock + 事件归一化 + 契约单测
packages/shared/src/staff.ts # staff/chat 域 zod DTO + SSE 事件信封
packages/shared/src/team.ts  # team 域 zod DTO(我的团队)
packages/shared/src/token.ts # HMAC 会话令牌(Web Crypto,Node/Edge 通用)
apps/web/src/server/         # auth(scrypt+cookie)/ http(信封收口)/ agentscope(globalThis 单例)/ dto / team-dto
apps/web/src/app/api/v1/     # auth / staffs(CRUD/publish) / conversations(消息/SSE/打断) / teams(CRUD/成员)
apps/web/src/app/            # login / office(工位门户) / staffs / teams(+[id]) / chat/[id](SSE 流式渲染)
```

**布局**(参照 StaffDeck):左侧菜单(办公室/我的数字员工/我的团队)+ 右侧内容区;
办公室 = 数字员工工位墙(点击工位进入对话,空工位引导招聘);团队 = TL/成员管理(AgentScope teams 运行时映射 S6+ 预留)。
我的数字员工 = 统计 + 分类过滤(全部/在岗/草稿/下线)+ 搜索 + 卡片列表 → **员工详情页** `/staffs/{id}`
(档案头/人设全文/职责边界/运行时映射/工作数据统计/会话记录/档案编辑)。

数据模型:staff 域 18 张表一次建齐(门禁 3),迁移 `packages/db/prisma/migrations/*staff_domain/`。

## 已验证链路(2026-10-17)

- mock 模式:登录→建员工→发布→开会话→发消息→SSE 流式(delta/usage/completed/done)→run SUCCEEDED + 消息镜像 + 用量日聚合 ✓
- real 模式:发布(fallback 到 XAgent)→发消息→glm-5.3 流式回复→SSE 透传→token 计量落库 ✓
- 浏览器走查:登录页/员工管理页(表格+创建+发布)/对话页(流式+打断按钮+token 展示)✓

## 与主仓 RabbitWork 的关系

- 主仓 = 工程规范与文档真相源(九条门禁);本副本 = 实现工作区,槽位隔离并行互不冲突。
- 回流主仓时按门禁补:功能规格文档(S1 四份)、高保真原型确认、JMeter/Playwright 用例、CI 接入。
