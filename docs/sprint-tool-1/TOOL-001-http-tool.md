# HTTP 工具定义与试运行

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | TOOL-001 |
| 所属迭代   | sprint-tool-1（蓝图 S4 能力配置 II） |
| 优先级     | P1 |
| 所属模块   | tool |
| 文档状态   | Prototyped |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | ToolDefinition 表（已一次建齐，零 DDL） |
| 下游消费   | TOOL-002 MCP · 员工工具绑定（EmployeeResourceBinding type=TOOL） |
| 上游依据   | 蓝图 §4 F3 / §6 S4；**上游实证无 tools/workspace 端点（2026-10-22，404）→ 纯本地工具管理** |
| **高保真确认** | **批量待走查**：原型 `docs/design/TOOL-001-http-tool/`（用户授权自动推进） |
| 工作量估算 | 后端 1.5 人日 / 前端 1.5 人日 / 联调 0.5 人日 |

## 1. 概述

工具域首份规格：`/tools` 管理页（HTTP 工具定义 CRUD）+ **试运行**（平台侧真实调用目标 URL，供调试）。上游无推送端点（实证），工具的运行时消费（对话中调用）随引擎/CHAT 深集成后续迭代。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 工具 CRUD（name/method/url/headers(加密)/描述） | ✅ | — |
| 试运行（真实 HTTP 调用 + 响应展示） | ✅ | — |
| SSRF 防护（平台侧 URL 出站守卫） | ✅ | **dispatcher 工厂形态（rules/security §8.6-①：禁薄包装 fetch）** |
| input/outputSchema 校验编排 | ❌ | JSON Schema 随引擎消费落地（表列已建齐） |
| AgentScope workspace 推送 | ❌ | 上游无端点（实证） |
| 对话中工具调用 | ❌ | CHAT 工具深集成迭代 |

### 1.4 能力表

| 编号 | 能力 | 交互类型 |
| ---- | ---- | -------- |
| TOOL-001-C1 | /tools 列表（方法 pill/URL/状态）+ 新建/编辑/删除 | UI/API |
| TOOL-001-C2 | headers 凭证 AES-GCM 加密落库、接口不回显（写忽略/读掩码） | API |
| TOOL-001-C3 | 试运行：入参 → 真实调用 → 状态/耗时/响应体（截断 4KB 展示） | UI/API |
| TOOL-001-C4 | 试运行 SSRF 拒绝（私网/协议白名单 http(s)）→ 422 透出 | API |
| TOOL-001-C5 | 空态/未登录/无权限 | UI/API |

## 2. 业务逻辑

1. **CRUD**：method ∈ GET/POST/PUT/PATCH/DELETE；url http(s) ≤512；headers 键值对（值含 `authorization/apikey/token/secret` 关键字的**加密列**存储——headersJson 明文存非敏感头，敏感头拆 `secureHeaders` 加密——**需加列？** 表仅 headersJson 一列 → **本规格 migration 加 `secure_headers` 加密列**（工具域首份规格补齐场景，同 TEAM-001 先例）。
2. **试运行**：POST /api/v1/tools/{id}/test-run {paramsJson?}——url 模板 `{{param}}` 渲染（未识别占位符报错，rules/engine §4.3）；经**出站守卫 dispatcher**（工厂构造、连接期 IP 校验私网黑名单+DNS 重绑定防护——参照 rules/security §3.4/§8.6-①形态）真实调用；超时 10s；响应体截断 4KB 返回（status/tookMs/truncated/bodyText）。目标 URL 属「被测/用户配置目标」类（产品语义）——私网默认拒绝、管理员白名单 env `TOOL_SSRF_ALLOWLIST`（CIDR 逗号分隔）可放行。
3. **审计**：试运行写 AuditLog（action=TOOL_TEST_RUN）。

## 3. UI/UX 设计

原型 `docs/design/TOOL-001-http-tool/`（A 列表/B 编辑弹窗/C 试运行面板）。要点：方法 pill 语义色（GET=accent/POST=success/PUT=warning/DELETE=danger）；敏感头值掩码展示 `••••`；试运行面板左入参右响应（mono，状态+耗时+truncated 标记）；SSRF 拒绝错误原文透出。

## 4. 技术架构

- migration `TOOL-001-tool-secure-headers`：`tool_definitions` + `secure_headers TEXT`（AES-GCM 密文，主密钥 env `TOOL_HEADER_SECRET`——复用 security §4.2 模式）；
- `packages/shared/src/tool.ts`：toolCreateInput/toolUpdateInput/toolDto/testRunInput/testRunResultDto zod；
- `apps/web/src/server/outbound.ts`：**outboundDispatcher() 工厂**（模块级单例构造；禁「导出函数直接以自身参数调 fetch」的薄包装形态——§8.6-①）；IP 校验（解析 DNS → 私网/环回/链路本地拒绝 + 重绑定二次校验）；
- API：`GET/POST /api/v1/tools`、`PATCH/DELETE /api/v1/tools/{id}`、`POST /api/v1/tools/{id}/test-run`；权限 ORG_RESOURCE:*（复用）；
- 前端：`/tools` 页（列表+弹窗+试运行面板）+ 菜单「工具」（ToolOutlined）；api-client toolApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| TOOL-001-01 | 建工具（GET 公网 echo URL）→ 试运行 | 200 + bodyText 回显（e2e 用 mock 上游 httpbin 形态:试运行目标指向 mock 服务?——**e2e 内起本地目标属私网会被拒** → 用 `TOOL_SSRF_ALLOWLIST` env 在 e2e 栈注入 127.0.0.1 放行,e2e 断言真实回显） |
| TOOL-001-02 | 试运行私网地址（未在白名单） | 422 + SSRF 拒绝原因 |
| TOOL-001-03 | 敏感头创建后详情回读 | 值掩码不回显 |
| TOOL-001-04 | 未认证/名称重复/URL 非法 | 401/422 |
| 单测 | outboundDispatcher IP 校验矩阵（私网/环回/公网/白名单）+ 占位符渲染 | 全分支 |
| jmx | CRUD + test-run 401/422/404（happy path e2e 覆盖——网络目标不可控,豁免登记） | — |

## 6. 基线深度对标

StaffDeck 无工具概念；蓝图 F3 定义 HTTP 工具+MCP。上游实例无 workspace（实证）——本地工具管理为差异化起点，运行时消费随引擎。

## 7. 里程碑与验收

交付清单：shared tool zod+单测 → outbound.ts 守卫+单测（SSRF 矩阵）→ migration → API+jmx → /tools 页+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。演示：建 echo 工具 → 试运行回显 → 私网目标被拒。
