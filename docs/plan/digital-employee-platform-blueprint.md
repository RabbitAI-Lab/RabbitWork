# 数字员工平台总体规划（最终版 v1.0）

> **状态：Draft（待产品定位评审）** · 2026-10-17 定稿（合并自《数字员工平台总体方案》与本文草案）
> 评审通过后：回填 AGENTS.md §0 与 docs/README §一，并拆分为各 Sprint 功能规格（按 [plan/功能规格模板.md](./功能规格模板.md) 七章结构）。
> 参考系：StaffDeck（OpenBMB 数字员工平台，AGPL-3.0，**只借鉴设计不复制代码**）；智能体运行时：自部署 AgentScope 实例。

---

## 0. 产品一句话（建议填入 AGENTS.md §0）

**RabbitWork：面向企业的数字员工平台——把岗位经验、SOP 流程、知识与工具固化为你团队里可持续工作、可治理、可追溯的数字员工。**

对标基线：StaffDeck v0.4（功能对标）；差异定位：**不自建 Agent 运行时，执行层全面复用自部署 AgentScope 服务**，RabbitWork 专注企业侧的资产管理、治理与体验层，做薄做快。

---

## 1. 总体架构与职责边界（本规划最重要的决策）

### 1.1 两层架构

```
┌────────────────────────────────────────────────────────────┐
│  RabbitWork（本仓，Next.js 全栈）= 产品平台层（管理与体验）  │
│                                                            │
│  · 企业管理面：员工档案/知识库/技能/工具/任务/API Key/审计   │
│  · 对话工作台：Web 聊天（SSE 流式）/执行过程可视化          │
│  · 治理层：RBAC 权限（已有三级模型）、用量统计、反馈闭环、开放 API │
│  · 业务数据库：Prisma（embedded PG）—— 全部业务实体的真相源 │
└───────────────┬────────────────────────────────────────────┘
                │ packages/agentscope 适配层（唯一出口）
                │ HTTP + SSE，服务账号 JWT
┌───────────────▼────────────────────────────────────────────┐
│  AgentScope 实例（106.52.237.179:10946）= 智能体运行时层    │
│                                                            │
│  · Agent 执行循环：推理、工具调用、沙箱、HITL 审批          │
│  · Session/消息持久化、SSE 事件流（缓冲回放）、interrupt    │
│  · Memory（短/长期）、RAG 知识库、MCP/skill workspace      │
│  · Agent Team（leader/worker 多智能体）、cron 自动化       │
│  · 凭证与模型接入（/credential、/model 发现）              │
└────────────────────────────────────────────────────────────┘
```

### 1.2 职责划分原则

| 能力 | 归属 | 说明 |
| --- | --- | --- |
| Agent 执行循环 / 推理 / 工具调用 | **AgentScope** | 平台**禁止**自建 agent loop（StaffDeck 教训：运行时是最大成本中心） |
| Session 与消息的**完整持久化** | AgentScope | 平台只镜像展示所需字段（标题、摘要、状态），不双写全量消息 |
| 业务实体真相源（员工档案、绑定、权限、审计） | **RabbitWork** | AgentScope 侧资源一律视为「运行时投影」，可重建 |
| 用户认证与 RBAC | **RabbitWork** | 平台用户体系独立（沿用已建 User/Organization/OrgMember/ProjectMember 基线）；平台→AgentScope 走**服务账号**（§5.2） |
| 知识库资产（上传、版本、权限） | **RabbitWork** | 检索与向量化**委托** AgentScope knowledge_bases（实测可用则用，不可用降级 pgvector，§9-R3） |
| 观测：业务级（谁用了、答得如何、成本） | **RabbitWork** | 执行级 trace 透传 AgentScope 事件流 |
| 渠道接入（IM） | 首期不做 | AgentScope 自带飞书/钉钉/Discord 渠道；平台首期只做 Web（§6 M5） |

**核心铁律：平台数据库里的 `agentScopeRef` 类字段是「引用」不是「副本」——所有以 AgentScope 为真相的数据（消息全文、事件流）不做双向同步，只做拉取式镜像与摘要；AgentScope 控制台里的手工改动视为临时态，以平台为真相（单向同步：平台 → AgentScope）。**

---

## 2. AgentScope 实例能力盘点（2026-10-17 实测）

实例：`http://106.52.237.179:10946`（公网 HTTP，生产须 HTTPS，§7-2）。

**认证**：`POST /api/auth/login` `{username, password}` → JWT Bearer（实测有效期 7 天）。角色 `user`+`admin`。

**管理面 `/api/*`**（已实测）：`sessions`、`workspaces`（agentsMd/mcpServers/skills）、`environments`（sandbox）、`files`。

**网关面 `/api/v1/*`**（多数需 `tenant`/`namespace` 参数；已实测）：

| 端点 | 用途（映射到本平台） |
| --- | --- |
| `GET/POST /api/v1/chat-agents`、`/api/v1/agents` | 对话型智能体注册 ↔ 数字员工运行时实例（tenant/namespace/agentKey/version/status） |
| `GET/POST /api/v1/chats`、`/chats/{id}` | 发起/管理对话运行（SSE 事件经 events） |
| `GET /api/v1/sessions`、`/sessions/{id}/status` | 会话列表与状态（idle/busy/parked/terminated） |
| `GET /api/v1/events?tenant=…`（SSE） | 事件流订阅 → 执行过程可视化 |
| `GET/POST /api/v1/automations` | cron 自动化 ↔ 定时任务 |
| `GET/POST /api/v1/teams`、`/api/v1/agent-tasks` | 多智能体团队与任务 ↔ 数字员工协作 |
| `GET/POST /api/v1/approvals`、`/api/v1/inbox` | HITL 审批与收件箱 ↔ 人工接管 |
| `GET/POST /api/v1/artifacts`、`/artifacts/uploads` | 产物管理与上传 |
| `GET/POST /api/v1/namespaces`、`GET /api/v1/me/scope` | 多租户/命名空间（default 全局 + personal） |

> ⚠️ 该实例 API 形态是「托管控制台版」（`/api/v1/...` + 多租户），与官方文档 2.0.10 agent-service 的裸 REST（`/agent`、`/chat`、`/sessions` 直挂根路径）**不完全一致**——实例更丰富但属增强形态。**接入层必须按「适配器」设计，把两种形态差异隔离在 `packages/agentscope` 内部**（§5.1、§9-R1）。

**官方文档能力参考**（docs.agentscope.io 2.0.10 [agent-service](https://docs.agentscope.io/zh/versions/2.0.10/deploy/agent-service)）：agent CRUD + `chat_config`、`POST /chat` 异步运行 + 会话级 SSE（缓冲回放/多订阅者扇出）、interrupt、消息分页、cron schedule、credential/model 发现（声明式卡片 + JSON schema，前端可无代码渲染表单）、workspace 的 MCP 与 skill 管理、knowledge_bases（RAG）、后台任务卸载、文件工作区（per_agent/per_session；本地/Docker/E2B 沙箱）、Agent Team、实时语音（实验）、默认 `X-User-ID` 鉴权（本实例已替换为真实 JWT 登录）。

---

## 3. 域模型设计（Prisma，门禁 3：一次建齐）

新增域 `digital-employee`（表命名遵循 rules/database.md：snake_case 复数、UUID 主键、软删 deletedAt、状态列 varchar+应用层 zod）。核心表（列含未启用项，首期只开开关）：

### 3.1 档案域
- **DigitalEmployee → `digital_employees`** 数字员工档案：`id`、`orgId`、`code`（工号）、`name`、`title`（岗位）、`personaPrompt`（人设）、`boundary`（职责边界）、`avatarUrl`、`status`（DRAFT|PUBLISHED|ARCHIVED）、`visibility`（PRIVATE|ORG|GALLERY）、`creatorId`、`agentScopeAgentId?`（运行时投影引用）、`usage`（聚合计量，只读列）、软删除。
- **EmployeeModelBinding → `employee_model_bindings`**：按角色绑模型（role：router/step/response 可各绑不同模型，StaffDeck 先例）+ 协议/URL/模型名/参数快照与指纹。
- **EmployeeResourceBinding → `employee_resource_bindings`**：**通用资源绑定表**（StaffDeck AgentResourceBinding 先例）：`employeeId`、`resourceType`（KNOWLEDGE|SKILL|TOOL|MCP）、`resourceId`、`capabilityScope`（GENERAL|SOP_SPECIFIC）、`paramsJson`、`agentScopeRef?`、`enabled`——新资源类型零 DDL。
- **EmployeeVersion → `employee_versions`**：档案版本快照（发布/回滚，含 assemblyJson 装配清单与 promptCompiled）。

### 3.2 会话域
- **Conversation → `conversations`**：`employeeId`、`userId`、`origin`（web/api/channel/team）、`title`、`status`（ACTIVE|IDLE|TERMINATED）、`agentScopeSessionId?`（originType=chat，originRef=平台会话 id）、`lastMessageAt`、软删除。
- **MessageMirror → `message_mirrors`**：展示所需镜像（contentPreview、agentScopeMsgId、tokenUsage）。**全文以 AgentScope 为准，镜像仅服务列表页**。
- **RunRecord → `run_records`**：执行留痕（agentScopeRunId、status 状态机、eventSummaryJson、durationMs、tokenIn/out、error）。

### 3.3 能力资产域
- **KnowledgeBase / KnowledgeDocument / KnowledgeIngestJob**：元数据与版本在平台；检索/向量化经适配器调 AgentScope（降级 pgvector，§9-R3）。
- **SkillDefinition → `skill_definitions`** + 版本：首版为 Markdown/提示词技能（Agent Skills 格式）；SOP 状态机图（sopGraph jsonb：节点/条件边/人工节点/子流程）**列一次建齐、S4+ 启用**。
- **ToolDefinition**（HTTP 工具：input/output schema、鉴权凭证 AES-GCM 加密）、**McpServerConfig**（transport：stdio/streamable_http/sse/builtin）。
- **ScheduledTask + ScheduledTaskRun**：cron 表达式、目标员工、入参模板、`agentScopeAutomationId?`、执行历史。

### 3.4 治理域
- **ApiKey**（开放 API：`rw_live_` 前缀，只存 pepper 摘要；scope 三级：账号全量/员工运行/API Client——对齐 StaffDeck 密钥模型）。
- **FeedbackRecord**（消息级 👍/👎 + 文本；后续接演进提案闭环）、**AuditLog**（管理动作 + 调用审计：actor/action/target/reqId/latency/statusCode）、**UsageDaily**（按员工/天聚合 token 与次数）。
- **HumanHandoffRecord**（转人工：发起、处理人、结论；首期列建齐不开功能）。

### 3.5 关系不变量
- Organization 1—N DigitalEmployee（复用既有 RBAC 基线表）；员工经绑定表挂模型/资源（不冗余到员工表）。
- Conversation 是 Web/API/渠道/团队任务的统一载体（单一执行入口好审计）。
- 所有 `agentScope*` 字段可空且可重建（实例故障/迁移时按平台真相源重投影）。

---

## 4. 功能模块清单（产品全貌）

| # | 模块 | 域前缀 | 核心能力 | 阶段 |
| --- | --- | --- | --- | --- |
| F1 | 员工画廊与档案 | STAFF | 创建/复制/发布数字员工；岗位、人设、边界、头像；版本与可见性 | S1-S2 |
| F2 | 对话工作台 | CHAT | 多会话管理、SSE 流式回复、执行过程事件可视化、打断、awaiting/HITL 交互 | S1-S2 |
| F3 | 能力配置 | KNW/SKILL/TOOL | 知识库（上传/建索引/检索调试）、技能（Markdown）、HTTP 工具、MCP 接入 | S3-S4 |
| F4 | 模型管理 | MODEL | 协议化模型配置（openai_chat_completions/anthropic/gemini）、验证状态机、默认模型 | S5 |
| F5 | 定时任务 | CRON | cron 调度员工执行、执行历史、失败告警 | S7 |
| F6 | 治理与运营 | OBS | 用量统计、反馈看板、审计日志、API Key 与开放 API | S2 起/S6 |
| F7 | 团队协作 | TEAM | 多员工组队（leader/worker）、任务分派（复用 AgentScope teams，后期） | S9+ |
| F8 | 渠道接入 | CHNL | 飞书/钉钉/企微 IM（复用 AgentScope channels，后期） | S9+ |
| F9 | 系统管理 | SYS | 登录、用户/组织/权限、命名空间与 AgentScope 实例健康监控 | S1 |

---

## 5. 关键技术设计

### 5.1 `packages/agentscope` 适配层（新增包）

```
packages/agentscope/
  src/client.ts          # 底层 HTTP：baseUrl、JWT 登录/缓存/到期前自动重登、重试、超时
  src/types.ts           # AgentScope 资源类型（从实例实测契约冻结，zod 定义，注册进 packages/shared）
  src/agents.ts          # chat-agents 生命周期：注册/更新（人设→system prompt）/下线
  src/chats.ts           # 发起运行、SSE 事件流消费（断线缓冲回放）、interrupt
  src/sessions.ts        # 会话/状态/消息分页拉取
  src/capabilities.ts    # skills/tools/mcp/memory/knowledge 的推送与查询
  src/contract.ts        # 平台域模型 ↔ AgentScope 资源的映射函数（唯一转换点）
```

- **配置**：`AGENTSCOPE_BASE_URL`、`AGENTSCOPE_USERNAME`、`AGENTSCOPE_PASSWORD`、`AGENTSCOPE_TENANT`、`AGENTSCOPE_NAMESPACE` 进 `.env`（`.env.example` 同步补齐）；凭证只存在服务端，浏览器永不可见。
- **契约测试**：`__contract__/` 内以录制的真实请求/响应 fixture 做单测；CI **不访问公网实例**（§8.2）。
- **契约文档**：Sprint 1 首任务产出《agentscope-integration.md》（接口清单、SSE 事件 schema union、错误映射、降级矩阵）作为评审载体；OpenAPI 快照生成管线（门禁 4 遗留项）在此一并落地进 CI。

### 5.2 认证与多租户映射

- 平台用户 → 平台 RBAC（已有三级模型），与 AgentScope 无关。
- 平台 → AgentScope：**单服务账号 + namespace 隔离**（首期）：平台用一个 admin 服务账号，平台组织映射到 AgentScope namespace（`tenant-{orgId}`）；个人命名空间不用于生产。后期多实例/多账号再演进（§9-R2）。

### 5.3 对话链路（端到端）

```
浏览器 ──POST /api/v1/employees/{id}/conversations──▶ Next Route Handler
  └─ 平台鉴权（withPermission）→ 创建 Conversation（状态机：active）
  └─ 适配层：确保 AgentScope chat-agent 存在（懒注册：人设+能力快照）
  └─ POST /api/v1/chats（agent、session、消息）→ 返回 runId
浏览器 ◀──GET /api/v1/conversations/{id}/events（SSE）── Route Handler
  └─ 适配层订阅 AgentScope events（SSE 上游），逐事件：
       · 归一化为平台事件信封（token/工具调用/阶段/完成/错误）
       · RunRecord 增量更新（异步，批量落库）
       · 透传给浏览器（纯透传不加工的 fast path）
打断：interrupt 端点透传；会话历史：messages 分页拉取（不镜像全量）
```

- SSE 透传在 Next Route Handler 用 `ReadableStream` 直通；**上游断线利用 AgentScope 缓冲回放重建**；平台不终结事件流语义。
- AgentScope 不可达时 BFF 返回 `503 + AGENTSCOPE_UNAVAILABLE`（api-conventions 错误码分段）。
- BullMQ/Redis 首期只用于：事件聚合落库、定时任务触发（领域内异步，不碰对话关键路径）。

### 5.4 员工配置同步（单向：平台 → AgentScope）

档案/绑定变更 → 适配层 `syncEmployee()`：更新 chat-agent（人设=personaPrompt、工具挂载、模型覆盖）。

### 5.5 API 规范与前端

- 全部端点遵循 [architecture/api-conventions.md](../architecture/api-conventions.md)；schema 用 zod 定义于 `packages/shared`，前端只走 `packages/api-client`（门禁 4）。
- 前端页面结构（对齐 §4 模块）：工作区 `/workspace`（画廊、`/chat/:id`）+ 管理端 `/manage/*`（员工、知识、技能、工具、任务、治理），AntD + Tailwind，SSE 用原生 EventSource 封装 hook。

---

## 6. Sprint 分期规划（每 Sprint 收尾遵循门禁 9：push + 远端 CI 绿）

| 里程碑 | Sprint | 主题 | 交付（验收 = 可演示的最小闭环） |
| --- | --- | --- | --- |
| M1 | S1 | **立柱：接入与最小对话闭环** | ① `INFRA-002 agentscope-adapter`（契约冻结 + zod + OpenAPI 快照进 CI + client 包 + health 探活端点；接口契约评审替代高保真）；② `SYS-001 auth`（登录/登出/当前用户/withPermission 装配）；③ `STAFF-001` 员工 CRUD + 发布映射（digital_employees 域表**一次建齐**）；④ `CHAT-001` 会话创建 + SSE 流式回复 + 消息渲染（含流式/中断/错误态）。**验收：在 RabbitWork 里登录、创建一个员工并完整对话一轮。** |
| M1 | S2 | 对话体验 | `CHAT-002` 执行过程事件可视化、打断、多会话管理（列表/归档/回放）；`OBS-001` 消息反馈 👍/👎 + RunRecord 留痕页 + 最小看板（调用量/成功率） |
| M2 | S3 | 能力配置 I | `KNW-001` 知识库（委托 AgentScope）+ 绑定 + 检索调试页；`STAFF-002` 员工人设模板 |
| M2 | S4 | 能力配置 II | `TOOL-001` HTTP 工具 + `TOOL-002` MCP 接入（推送 AgentScope workspace）+ 工具试运行页；`SKILL-001` Markdown 技能 |
| M3 | S5 | 模型与运营 | `MODEL-001` 模型配置（协议/验证状态机）；`OBS-002` 用量统计、审计日志 |
| M3 | S6 | 开放能力 | `OBS-003` API Key 三级密钥 + 开放 API v1（创建会话/run/查询） |
| M4 | S7 | 自动化 | `CRON-001` 定时任务（automations 映射）+ 执行历史 |
| M4 | S8 | HITL 与接管 | `CHAT-003` 审批（approvals）/inbox/转人工记录 |
| M5 | S9+ | 团队与渠道 | `TEAM-001` teams 多员工协作（先浅映射：任务列表+状态）；`SKILL-002` SOP 状态机编排（蒸馏+可视化编辑）；`STAFF-003` 员工广场（画廊资源复用/复制不动原件）；`CHNL-001` 飞书/钉钉渠道（评估 AgentScope channels 直用 vs 平台侧网关） |

每个 Sprint 严格走门禁：规格（Approved）→ 高保真原型（`docs/design/{MODULE}-NNN-{slug}/`，人工确认，**原型产出排在编码之前**）→ 编码 + 三类测试（Vitest/JMeter/Playwright）→ CI 全绿合入。S1 属「纯后端+首版 UI」：INFRA-002 以接口契约评审替代高保真，但登录页与对话页仍需原型。

---

## 7. 安全设计要点（对齐 rules/security.md）

1. **服务边界**：AgentScope 调用全部在服务端（适配层）；浏览器到 AgentScope **零直连**（凭证不泄露、CORS 不放开、公网实例不暴露给终端用户）。
2. **传输**：当前实例是公网 HTTP 明文——联调可接受，**生产必须**：HTTPS 反代 + IP 白名单（只放行 RabbitWork 服务端出口）+ 强密码/独立服务账号。**登记为上线前阻塞项**。
3. **凭证存储**：AgentScope 服务账号密码、工具凭证 AES-GCM 加密落库（node:crypto）；API Key 只存 pepper 摘要；凭证不进日志。
4. **SSRF**：工具定义的 URL 校验（schemes 白名单、内网地址黑名单）。
5. **权限点**：每个端点 `withPermission()`（`packages/shared/permissions.ts`），员工资源按 创建者/org/可见性 判定（复用 RBAC 三级模型）。

## 8. 测试策略（门禁 7/8 原样适用）

1. **单测（Vitest）**：适配层以 contract fixtures 驱动；`contract.ts` 映射函数 100% 覆盖；SSE 归一化用事件流样本回放。
2. **契约冒烟（独立脚本，非 CI）**：`scripts/agentscope-smoke.mjs` 对真实实例跑只读+沙箱写，本地/联调手动执行，输出漂移报告。**CI 与 e2e 一律 mock**（Playwright route 拦截 `/api/v1/events` 等上游，回放 fixture），保证测试可重复、无外网依赖、无 token 消耗。
3. **JMeter（四场景×四断言）与 Playwright（三类断言：UI + Console 无 error + 接口）** 按 §4 模块的规格 §1.2 能力行建用例；修复循环超 30 分钟启用 `E2E_DATABASE_URL` 环境复用（AGENTS.md §4.1）。

## 9. 风险与待决策清单（评审议题）

| # | 风险/决策 | 影响 | 建议 |
| --- | --- | --- | --- |
| R1 | 实例 API 与官方文档形态不一致（托管控制台版 `/api/v1`）；无公开 OpenAPI（/docs 为 SPA 回退） | 适配层契约靠实测冻结，实例升级可能破坏 | 向实例维护方索取 OpenAPI/版本 pin 2.0.10 承诺；适配层加版本探测与契约冒烟；调用面锁定最小集（chat-agents/chats/sessions/events） |
| R2 | 多租户映射策略（单服务账号+namespace vs 多账号） | 隔离强度与运维复杂度 | 首期单账号+namespace（§5.2），S6 开放 API 前重审 |
| R3 | AgentScope knowledge_bases 在该实例是否启用（未实测） | 知识库方案 A/B | S1 期间实测；不可用则降级自建 pgvector 检索，平台侧接口不变 |
| R4 | SSE 事件流在该实例的具体信封（events 端点带 tenant 参数）待冻结 | 对话体验核心 | S1 第一周产出事件类型清单文档并评审 |
| R5 | 公网 HTTP 明文 + 弱凭证 | 安全阻塞项 | 上线前完成 §7-2 |
| R6 | AgentScope teams/approvals 语义与平台域模型（竞标/黑板）的映射深度 | S5-S9 范围 | 先浅映射（任务列表+状态），深编排不进 v1 |
| R7 | AGPL-3.0（StaffDeck 为参考而非代码引入） | 合规 | 只借鉴设计不复制代码；如确需引用须法务评审 |
| R8 | token/用量计量口径（事件流是否含 usage 字段） | OBS 计费/考核 | S1 契约冻结时确认；缺则按消息级估算并登记误差 |
| R9 | embedded-postgres 单机 vs 生产外接 PG | 数据可靠性 | 沿用现有双轨（DATABASE_URL 切换），生产走外接 |

---

## 10. 评审通过后的落地路线（门禁合规）

1. 回填 AGENTS.md §0 一句话 + docs/README §一 + 术语表（数字员工/装配清单/运行时投影/镜像等）
2. `docs/architecture/dependency-graph.md` 补域 DAG（SYS→STAFF→CHAT→KNW/SKILL/TOOL/OBS）+ `scripts/check-boundaries.domains.json` 登记
3. 新增 `docs/architecture/agentscope-integration.md`（接口契约、SSE 事件 schema、错误映射、降级矩阵）——INFRA-002 的评审载体
4. Sprint 1 四份规格按七章结构产出，逐个走 Draft→Approved→Prototyped（高保真确认）→编码；首批原型目录：`docs/design/SYS-001-login/`、`docs/design/STAFF-001-*/`、`docs/design/CHAT-001-*/`
5. `.env.example` 补 AgentScope 配置项；`packages/agentscope` 新包纳入 monorepo 边界检查

---

## 附录 A：StaffDeck 关键先例索引（设计参考，不复制代码）

| 主题 | StaffDeck 出处 | 借鉴点 |
| --- | --- | --- |
| 通用资源绑定表（一套表挂 5 类能力） | `AgentResourceBinding` | §3.1 EmployeeResourceBinding |
| 模型协议 Driver/验证状态机/配置指纹 | `backend/app/llm/`、`design-model-api-protocols.md` | F4 模型管理；按角色绑模型 |
| Harness run/turn 留痕模型 | `HarnessRunRecord/TurnRecord/InvocationRecord` | RunRecord 简化版 |
| 三级 API Key 密钥模型 + scope 子集校验 | `docs/open-api-v1.md` | F6 开放 API |
| durable inbox/outbox 渠道可靠性（入站幂等/出站重试） | `backend/app/channels/`、`development-feishu-channel.md` | M5 渠道接入 |
| 多智能体=数据模型先行（竞标/黑板/唤醒队列） | `design-multi-agent-team-decisions.md` | F7 设计输入 |
| 反馈→演进提案闭环 | `EvolutionProposal` | F6 反馈看板后期演进 |
| 决策记录文档实践（含被否方案与理由） | `design-*.md` | 本仓 docs 惯例对齐 |
