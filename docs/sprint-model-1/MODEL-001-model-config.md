# 模型配置（协议化定义与验证状态机）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | MODEL-001 |
| 所属迭代   | sprint-model-1（蓝图 S5 模型与运营） |
| 优先级     | P1 |
| 所属模块   | model |
| 文档状态   | Implemented（2026-10-22；单测 90 / e2e 27 / jmx 6 计划全绿；走查待人工） |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | 无（**模型域首份规格——新表一次建齐**；上游实证无 models/llm/providers 端点,2026-10-22 四路径 404） |
| 下游消费   | 员工绑定模型（远期）· KNW-001 R-VECTOR（pgvector+embedding）· 对话模型选择 |
| 上游依据   | 蓝图 §4 F4 / §6 S5 |
| **高保真确认** | **批量待走查**：原型 `docs/design/MODEL-001-model-config/` |
| 工作量估算 | 后端 1.5 人日 / 前端 1.5 人日 / 联调 0.5 人日 |

## 1. 概述

模型域首份规格：协议化模型配置（openai_chat_completions / anthropic / gemini）CRUD + **验证状态机**（DRAFT→VERIFIED/FAILED,真调一次 chat 验证凭据与连通）+ 默认模型标记。凭据加密存储（复用 TOOL-001 AES-GCM 模式）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 模型 CRUD（协议/baseUrl/型号/凭据加密/默认标记） | ✅ | — |
| 验证状态机（一键验证 → 真调 chat → VERIFIED/FAILED+原因） | ✅ | — |
| 员工绑定模型 / 对话动态选模型 | ❌ | 引擎/CHAT 深集成 |
| 用量按模型统计 | ❌ | OBS-002 |
| AgentScope 推送 | ❌ | 上游无端点（实证） |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| MODEL-001-C1 | /models 列表（协议 pill/状态 pill/默认徽标）+ 新建/编辑/删除 |
| MODEL-001-C2 | 凭据加密落库、掩码回显、占位回传=沿用 |
| MODEL-001-C3 | 一键验证：按协议真调一次最小 chat → VERIFIED(耗时) / FAILED(原因透出)；出站守卫同口径 |
| MODEL-001-C4 | 默认模型唯一（设默认互斥切换） |
| MODEL-001-C5 | 空态/未登录/422（协议白名单外、baseUrl 非法） |

## 2. 业务逻辑

1. 协议白名单：`openai_chat_completions | anthropic | gemini`（SCREAMING_SNAKE,登记 shared）。
2. 验证状态机：`UNVERIFIED → VERIFYING → VERIFIED | FAILED`；验证=最小 chat 请求（各协议标准 messages 端点,1 token 上限,15s 超时）——经 **TOOL-001 前置解析守卫**（模型 baseUrl 属用户配置目标类）;失败保留 error 原文。同步验证（首期,单机;异步随队列）。
3. 默认模型：org 内唯一 `isDefault`——设默认时事务内清旧立新。
4. 凭据（apiKey）：AES-GCM 加密列（复用 secure-headers 模式,主密钥同 TOOL_HEADER_SECRET 体系或独立 MODEL_SECRET——**独立 `MODEL_APIKEY_SECRET`**,职责分离）。

## 3. UI/UX 设计

原型 `docs/design/MODEL-001-model-config/`（形态同 TOOL-001：列表+编辑弹窗+验证面板）。菜单「模型」（第九项）。要点：协议 pill 语义色；VERIFIED 呼吸点/FAILED 错误展开（同 /runs 模式）；默认徽标 Crown。

## 4. 技术架构

- **migration `MODEL-001-model-configs`（模型域首份,一次建齐）**：
```prisma
model ModelConfig {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  name        String   @db.VarChar(128)
  protocol    String   @db.VarChar(48) // openai_chat_completions | anthropic | gemini
  baseUrl     String   @db.VarChar(512)
  modelId     String   @db.VarChar(128) // 如 gpt-4o-mini / claude-sonnet-5-5
  apiKeyEnc   String   @map("api_key_enc") // AES-GCM 密文
  status      String   @default("UNVERIFIED") @db.VarChar(32)
  isDefault   Boolean  @default(false) @map("is_default")
  lastError   String?  @db.Text
  lastVerifiedAt DateTime? @map("last_verified_at") @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(3)
  @@unique([orgId, name])
  @@index([orgId, deletedAt])
  @@map("model_configs")
}
```
- shared `model.ts`：MODEL_PROTOCOLS 枚举 + modelCreateInput（协议白名单/baseUrl http(s)/apiKey ≤512）+ modelDto（apiKey 恒掩码）+ verifyResultDto；`buildVerifyRequest(protocol, baseUrl, modelId, apiKey)` 纯函数（各协议请求体/头构造——单测锚点）。
- API：`GET/POST /api/v1/models`、`PATCH/DELETE /api/v1/models/{id}`、`POST /api/v1/models/{id}/verify`、`POST /api/v1/models/{id}/default`；权限 ORG_RESOURCE:*（模型属组织资源）。
- 前端：`/models` 页 + 菜单；api-client modelApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| MODEL-001-01 | 建模型（本地 mock 目标当 baseUrl）→ 验证 → VERIFIED+耗时 | e2e（白名单同口径） |
| MODEL-001-02 | 验证失败目标 → FAILED+原因透出 | e2e |
| MODEL-001-03 | 私网 baseUrl → 守卫拒绝 | e2e |
| MODEL-001-04 | 设默认互斥（A 默认 → 设 B → A 失默认） | e2e |
| MODEL-001-05 | 未认证 401 / 协议白名单外 422 / 重复名 422 | jmx |
| 单测 | buildVerifyRequest 三协议构造矩阵 + zod round-trip | — |

## 6. 基线深度对标

蓝图 F4：协议化配置+验证状态机+默认模型——本地全量实现（上游无对应端点,同 TOOL/KNW 降级决策链）。

## 6.5 实现勘误（2026-10-22）

1. **schema @map 遗漏**：baseUrl/modelId/lastError 初版漏 `@map`（migration 为 snake_case 而 client 找 camelCase 列 → 500）——已补齐;库列无需变更（migration 本就是目标态）。
2. **表单协议默认值**：注册表单 protocol 无默认值时 required 校验静默拦截（无请求无提示）——补 `initialValues` 默认 openai_chat_completions。
3. **e2e 断言口径**：默认互斥断言走 API（行内「设默认」按钮文案会误伤 contains /默认/ 类断言）;创建链路断言经列表回读（glob 集合 URL 竞态,既有教训）。

## 7. 里程碑与验收

交付清单：migration → shared model zod+纯函数（单测）→ API+jmx → /models 页+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
