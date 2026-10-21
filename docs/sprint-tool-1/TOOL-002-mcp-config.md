# MCP 服务器配置管理

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | TOOL-002 |
| 所属迭代   | sprint-tool-1（蓝图 S4 收尾） |
| 优先级     | P1 |
| 所属模块   | tool |
| 文档状态   | Implemented（2026-10-22；单测 71 / e2e 24 / jmx 5 计划全绿；走查待人工） |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | McpServerConfig 表（已一次建齐,零 DDL） |
| 下游消费   | 运行时 MCP 工具消费（随引擎引入）;员工绑定（type=MCP） |
| 上游依据   | 蓝图 §4 F3/§6 S4;**上游实证无 mcp/workspace 端点 → 纯本地配置管理** |
| **高保真确认** | **批量待走查**：原型 `docs/design/TOOL-002-mcp-config/` |
| 工作量估算 | 后端 0.5 人日 / 前端 1 人日 / 联调 0 |

## 1. 概述

`/mcp` 配置管理：MCP 服务器注册（transport/endpoint/config）CRUD + 连通性测试（streamable_http 仅 ping GET；stdio 形态单机不可执行,仅登记）。**运行时消费随引擎**——本切片只做配置资产。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| MCP 配置 CRUD（name/transport/endpoint/configJson） | ✅ | — |
| streamable_http 连通性测试（经 TOOL-001 守卫出站） | ✅ | — |
| stdio/sse transport 运行时拉起 | ❌ | 引擎引入（单机 web 不拉子进程） |
| AgentScope workspace 推送 | ❌ | 上游无端点（实证） |
| 员工绑定 MCP（type=MCP） | ✅（复用既有 resources 端点,无新开发） | — |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| TOOL-002-C1 | /mcp 列表（transport pill/endpoint）+ 新建/编辑/删除 |
| TOOL-002-C2 | 连通性测试：streamable_http 经出站守卫 ping → 状态/耗时/拒绝原因透出 |
| TOOL-002-C3 | 空态/未登录/422（endpoint 非法、transport 白名单外） |

## 2. 业务逻辑

transport ∈ `streamable_http | sse | builtin`（stdio 登记不可选——无运行时;表列注释保留）。configJson 存 headers 等连接参数（敏感键同 TOOL-001 加密口径?——MCP 配置的鉴权头随引擎接入再加密,首期 configJson 不含敏感凭据,登记 R-MCP-SECRET）。连通性测试 = `GET {endpoint}`（Accept: application/json, text/event-stream）经 guardedFetch——SSRF 同口径（用户配置目标类）。

## 3. UI/UX 设计

原型 `docs/design/TOOL-002-mcp-config/prototype.html`（A 列表/B 编辑/测试面板——形态同 TOOL-001）。菜单「工具」页内 Tab 化（工具/MCP 服务）或独立菜单——采用**独立页 /mcp + 菜单「MCP 服务」**（第八项）。

## 4. 技术架构

- shared `mcp.ts`：mcpCreateInput（transport 枚举/endpoint http(s)）/mcpDto/testInput/testResultDto；
- API：`GET/POST /api/v1/mcp-servers`、`PATCH/DELETE /api/v1/mcp-servers/{id}`、`POST /api/v1/mcp-servers/{id}/test`；权限 ORG_RESOURCE:*；
- 前端：`/mcp` 页 + 菜单；api-client mcpApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| TOOL-002-01 | 建 streamable_http 配置（指向本地 health）→ 测试 → 200 回显 | e2e（白名单同 TOOL-001） |
| TOOL-002-02 | 私网目标测试 → 422 拒绝原因 | e2e |
| TOOL-002-03 | 未认证 401 / transport 非法 422 / 不存在 404 | jmx |

单测：mcp zod round-trip。jmx：契约边界（同 TOOL-001 骨架）。

## 6. 基线深度对标

蓝图 F3 定义 MCP 接入（推送 workspace）——上游无端点,本地配置管理为降级起点（同 TOOL-001/KNW-001 决策链）。

## 7. 里程碑与验收

交付清单：shared mcp zod+单测 → API+jmx → /mcp 页+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
