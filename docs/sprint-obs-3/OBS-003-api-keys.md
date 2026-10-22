# API Key 三级密钥与开放 API

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | OBS-003 |
| 所属迭代   | sprint-obs-3（蓝图 S6 开放能力） |
| 优先级     | P1 |
| 所属模块   | obs |
| 文档状态   | Implemented（2026-10-23；单测 91 / e2e 33 / jmx 8 计划全绿；走查待人工） |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | ApiKey 表（一次建齐,零 DDL）· OBS-002 audit() |
| 下游消费   | 渠道接入（CHNL-001）· 外部编排 |
| 上游依据   | 蓝图 §4 F6（S6 开放能力）· §3.4 ApiKey（rw_live_ 前缀/pepper 摘要/三级 scope） |
| **高保真确认** | **批量待走查**：原型 `docs/design/OBS-003-api-keys/` |
| 工作量估算 | 后端 1.5 人日 / 前端 1 人日 / 联调 0.5 人日 |

## 1. 概述

`rw_live_` 前缀 API Key 的创建/吊销管理 + **开放 API 通道**（Bearer key 鉴权,首期开放「创建会话+发消息+查会话」三端点,与 Web 会话同一 domain 服务）。三级 scope 首期落 **ACCOUNT**（账号全量）;STAFF/CLIENT 列已建,绑定随渠道接入启用。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| Key 创建（`rw_live_` + 32B 随机明文一次性返回 + pepper sha256 摘要落库 + 前缀展示） | ✅ | — |
| Key 列表（前缀/scope/lastUsedAt/状态）+ 吊销（revokedAt） | ✅ | — |
| 开放 API 鉴权中间件（Bearer → pepper 摘要匹配 → lastUsedAt 更新 + 审计） | ✅ | — |
| 开放端点：POST /open/v1/conversations · POST .../messages · GET .../conversations | ✅ | — |
| STAFF/CLIENT scope 绑定 | ❌ | CHNL-001（列已建齐） |
| 用量配额/限流 | ❌ | OBS 后续（429 容错口径已备） |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| OBS-003-C1 | 创建 Key：明文一次性展示（复制引导）,库只存摘要 |
| OBS-003-C2 | 列表（keyPrefix 掩码展示/lastUsedAt）+ 吊销确认 |
| OBS-003-C3 | 开放 API：Key 创建会话+发消息（mock 员工全链路）→ 200 信封 |
| OBS-003-C4 | 无效/吊销 Key → 401;过期 Key → 401 |
| OBS-003-C5 | 审计联动：key.create/key.revoke/key.auth_failed 落 audit_logs |

## 2. 业务逻辑

1. **Key 生成**：`rw_live_` + crypto.randomBytes(24).toString('base64url')（≈32 字符）;`pepperHash = sha256(pepper_env + key)`;`keyPrefix = 明文前 12 字符`（rw_live_XXXX 展示位）。明文仅创建响应返回一次。
2. **鉴权中间件**（`/api/open/v1/**` 专用,独立于 session middleware 分支）：Bearer 解析 → sha256(pepper+key) 匹配（org 内全表索引 keyPrefix 预筛 → 精确比）→ 未吊销未过期 → 挂 `apiKeyCtx`（orgId/userId=创建者）;失败 401 信封 + `key.auth_failed` 审计。成功后 `lastUsedAt` 异步更新。
3. **开放端点**：复用既有 domain 逻辑（conversations create/send 的核心路径抽公共函数或直接调用 Prisma 流程——首期直连复用 `chatApi` 服务端函数同构实现,mock/real provider 同 Web）。
4. scope=ACCOUNT 首期即「org 全量」。

## 3. UI/UX 设计

原型 `docs/design/OBS-003-api-keys/`。「个人设置」入口（AppShell 底部用户菜单 → /settings/api-keys）：列表 + 创建弹窗 + 创建成功一次性明文展示（accent mono + 复制按钮 + 「关闭后不再显示」警示）。

## 4. 技术架构

- shared `obs.ts` 扩展：`apiKeyCreateInput`（name/expiresInDays?）/`apiKeyDto`（keyPrefix/scope/lastUsedAt/revokedAt）/`apiKeyCreatedDto`（含一次性 plaintext）;
- `apps/web/src/server/api-key.ts`：generateApiKey/verifyApiKey 纯函数 + pepper env（`APIKEY_PEPPER`）;
- API：`GET/POST /api/v1/api-keys`、`DELETE /api/v1/api-keys/{id}`（吊销）;权限 `SYSTEM_PARAM:UPDATE`?——**登记新权限点 `ORG_APIKEY:MANAGE`**（ADMIN 语义;避免 MEMBER :READ 误放行——动作词非 READ 故 MEMBER 不放行 ✓）;
- 开放面：`apps/web/src/app/api/open/v1/conversations/route.ts`（POST 创建）、`[id]/messages/route.ts`（POST 发消息）、`[id]/route.ts`（GET 详情）——经 `withApiKey()` 包装;
- 前端：`/settings/api-keys` 页 + 用户菜单入口;api-client apiKeyApi + openApi（服务端用）。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| OBS-003-01 | UI 建 Key → 明文一次性展示 → 列表前缀可见 | e2e |
| OBS-003-02 | 用明文 Key 调开放 API 建会话+发消息 → 200 + 回复 | e2e（API 级） |
| OBS-003-03 | 吊销后同 Key → 401 | e2e |
| OBS-003-04 | 伪造 Key → 401 + 审计 auth_failed | jmx |
| OBS-003-05 | 未认证（无 Bearer）401 / 重名 422 | jmx |
| 单测 | generate/verify 纯函数（pepper 摘要确定性/伪造拒）+ zod | — |

## 6. 基线深度对标

蓝图 §3.4：rw_live_ 前缀/pepper 摘要/三级 scope——对齐（scope 三级列齐,绑定分阶段）;StaffDeck 密钥模型同构。

## 6.5 实现勘误（2026-10-23）

1. **middleware 放行开放面**：`/api/open/**` 此前会被 session middleware 401 拦截（外部集成无 cookie 永远到不了 Bearer 鉴权）——isPublicApi 增补 `/api/open/`（开放面由 withApiKey 自鉴权）。
2. 发消息开放端点首期同步投递（sendTurn 成功即 201）;回复获取由调用方轮询会话详情——事件流消费随渠道迭代。

## 7. 里程碑与验收

交付清单：api-key 纯函数+单测 → 管理端 API+jmx → 开放面三端点 → /settings 页+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
