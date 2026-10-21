# 知识库与检索调试（关键词检索首期）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | KNW-001 |
| 所属迭代   | sprint-knw-1（蓝图 S3 能力配置 I；RESOURCE-001 规格外先行产物的规格补齐） |
| 优先级     | P1 |
| 所属模块   | knw |
| 文档状态   | Implemented（2026-10-22；单测 67 / e2e 16 / jmx 3 计划全绿；走查待人工） |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | RESOURCE-001 既有元数据 CRUD（无规格先行，本规格收编）· STAFF 员工域 |
| 下游消费   | CHAT 检索增强（对话注入命中切片，后续迭代）· SKILL-001 |
| 上游依据   | 蓝图 §4 F3 / §6 S3；§9-R3 降级路径 |
| 关联架构文档 | api-conventions / dependency-graph |
| **高保真确认** | **批量待走查**：用户 2026-10-21 授权自动推进；原型 `docs/design/KNW-001-kb-retrieval/` |
| 工作量估算 | 后端 2 人日 / 前端 2 人日 / 联调 0.5 人日 |

## 1. 概述

### 1.1 功能定位

知识域首份规格：KB 管理（收编既有元数据 CRUD）+ 文档上传摄取（同步切片）+ 关键词检索与调试页 + 员工知识绑定。检索为**自建降级口径**（R-VECTOR 详见 §2.4）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| KB CRUD + 文档上传（.md/.txt ≤2MB UTF-8）+ 切片摄取 | ✅ | — |
| 切片级关键词检索 + 调试面板 | ✅ | — |
| 员工绑定 KB（多选，绑定即生效） | ✅ | — |
| 向量检索（pgvector + embedding） | ❌ | R-VECTOR：随 MODEL-001/AI Provider 规格 |
| 对话中检索注入 | ❌ | CHAT 检索增强迭代 |
| 异步摄取流水线（队列） | ❌ | BullMQ 任务体系（同步摄取首期，≤2MB 秒级） |
| 网页抓取/URL 导入/PDF | ❌ | 后续 |

### 1.3 前置依赖表

| 依赖 | 阻塞原因 |
| ---- | -------- |
| KnowledgeBase/Document/IngestJob/EmployeeResourceBinding 表（已一次建齐） | 存储 |
| AgentScope 知识端点 | **实证不存在**（2026-10-22 五路径 404）→ 触发 §9-R3 降级 |

### 1.4 能力表（rules/testing §1.2 最小覆盖单位）

| 编号 | 能力 | 交互类型 |
| ---- | ---- | -------- |
| KNW-001-C1 | KB 列表（文档数/切片数统计）+ 新建 | UI |
| KNW-001-C2 | KB 详情：文档列表（READY/FAILED 状态）+ 删除文档 | UI |
| KNW-001-C3 | 上传 .md/.txt（≤2MB UTF-8）→ 同步切片 → READY | UI/API |
| KNW-001-C4 | 非 UTF-8/超限/类型拒绝 → 422 + 失败留痕 | API |
| KNW-001-C5 | 检索调试：关键词 → 命中切片（文档/序号/片段）+ 耗时 | UI/API |
| KNW-001-C6 | 员工绑定/解绑 KB（chip 编辑） | UI/API |
| KNW-001-C7 | 空态（无 KB/无文档/无命中） | UI |
| KNW-001-C8 | 未登录 401/跳转 | API/UI |

### 1.5 基线核对

AgentScope 实例无知识能力（实证）；StaffDeck 知识库=元数据+上传+绑定。本项目同形，检索为差异点（关键词首期）。

## 2. 业务逻辑

### 2.1 文档摄取（同步）

```
上传(.md/.txt ≤2MB) → 校验(类型/大小/UTF-8 可解码) → doc(PENDING)
→ 切片(chunkText: 800字/重叠100, 见 §4.2) → chunks 入库(分批≤1000) → doc(READY)
→ IngestJob 留痕(status/knowledge-chunk 计数)
任一步失败 → doc(FAILED + error 原文) → 422 返回真实原因
```

### 2.2 检索口径（首期）

- 入参 query 按空白切词（≤8 词），**多词 AND**（每词都需命中切片）；
- 匹配：`content ILIKE '%词%'`（PG 内建，无扩展依赖）；中文分词局限登记（§2.4 R-TOKENIZE）；
- 排序：documentId+seq 稳定序；topK 默认 8；
- 返回耗时（ms）与命中数。

### 2.3 绑定语义

- 员工 ↔ KB 多对多（EmployeeResourceBinding.resourceType=KNOWLEDGE）；保存为**差分写**（删差集/增新集，事务内）；绑定顺序=保存顺序（对话注入按此序合并）。

### 2.4 风险与局限登记

| # | 风险 | 处置 |
| - | ---- | ---- |
| R-VECTOR | 向量检索不可用（无 embedding provider；pgvector 于 embedded-postgres 可用性未证） | 关键词首期；向量随 MODEL-001 |
| R-TOKENIZE | ILIKE 无中文分词（「密码重置」查不到「重置密码」短语内词序变化） | 调试页提示关键词口径；向量期解决 |
| R-CONCURRENCY | 同步摄取大文件占请求线程 | ≤2MB 限额；异步化随队列 |

## 3. UI/UX 设计

原型：`docs/design/KNW-001-kb-retrieval/prototype.html`（A 列表/B 详情+调试/C 绑定）。要点：新导航「知识库」；详情 Tab（文档｜检索调试）；失败原因 mono 透出（§5.7）；检索命中关键词 accent 高亮；空态三态引导；绑定 chip 编辑（staffs/[id] 新增区块）。

## 4. 技术架构

### 4.1 数据模型（migration `KNW-001-knowledge-chunks`——知识域首份规格补齐切片表）

```prisma
model KnowledgeChunk {
  id         String   @id @default(uuid())
  documentId String   @map("document_id")
  baseId     String   @map("base_id")
  seq        Int
  content    String   @db.Text
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  document KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  @@index([baseId])
  @@index([documentId, seq])
  @@map("knowledge_chunks")
}
```

### 4.2 纯函数（packages/shared/src/knowledge.ts；单测锚点）

- `chunkText(text, {size=800, overlap=100}): string[]`——按字符切片（中文友好），尾片并入前片若 <overlap；
- `parseQuery(query): string[]`——空白切词、去重、≤8 词、每词 ≤64 字符。

### 4.3 API 契约（zod 于 packages/shared/src/knowledge.ts）

| 方法·路径 | 说明 |
| --------- | ---- |
| `POST /api/v1/knowledge-bases/{id}/documents` | multipart（file）→ 摄取 → 201 docDto（含 chunkCount/status/error） |
| `GET /api/v1/knowledge-bases/{id}/documents` | 文档列表（chunkCount 经 groupBy） |
| `DELETE /api/v1/knowledge-bases/{id}/documents/{docId}` | 删文档（级联切片） |
| `POST /api/v1/knowledge-bases/{id}/retrieve` | `{query, topK?}` → `{items:[{documentId,documentTitle,seq,snippet}], tookMs, total}` |
| 既有 `GET/PUT /staffs/{id}/resources` | **复用**（RESOURCE-001 已实现差分写绑定，含技能+知识库；KNW-001 不另建端点） |
| 既有 `GET/POST /knowledge-bases` | DTO 扩展 `documentCount/chunkCount`（列表统计） |

权限：ORG_RESOURCE:READ / WRITE（既有）。

### 4.4 前端组件

- `app/knowledge/page.tsx`（列表+新建）、`app/knowledge/[id]/page.tsx`（Tab：文档+上传+调试）；
- `app/staffs/[id]/page.tsx` 增「知识绑定」区块；
- api-client `kbApi.documents/upload/remove/retrieve/bindings`；AppShell 菜单「知识库」。

## 5. 测试用例

### 5.1 功能用例表

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| KNW-001-01 | 建 KB → 上传 md（含目标词） | READY + chunkCount≥1 |
| KNW-001-02 | 上传非 UTF-8 文件 | 422 + FAILED 留痕 + 原因透出 |
| KNW-001-03 | 检索命中词 | 命中切片含文档名/序号/片段 |
| KNW-001-04 | 检索无命中词 | 空列表 + 空态文案 |
| KNW-001-05 | 绑定/解绑员工 | chip 增减 + 重进页面回显 |
| KNW-001-06 | 多词 AND（一词不存在） | 0 命中 |
| KNW-001-07 | 未登录/无权限 | 401/403 信封 |

### 5.2 JMeter（tests/api/KNW-001-kb-retrieval.jmx）

正常（retrieve 命中/空、documents 列表、绑定 PUT）/ 401 / 422（query 空、topK 越界）/ 404（KB 不存在）。**上传 multipart 不进 jmx**（文件采样器维护成本高，happy path 由 e2e 覆盖——豁免登记）。

### 5.3 Playwright（tests/e2e/KNW-001-kb-retrieval.spec.ts）

从首页导航→知识库→建 KB→上传（fixture 生成 .md 文件）→READY→检索命中→绑定员工→staffs 详情回显。三类断言齐备；上传用 `page.setInputFiles`。

### 5.4 二态覆盖

空/有数据（C7/C1）· READY/FAILED（C2/C4）· 命中/无命中（C5/C7）· 绑定/未绑定（C6）· 未登录/已登录（C8）。

## 6. 基线深度对标

| 维度 | StaffDeck | 本项目 |
| ---- | --------- | ------ |
| KB 模型 | 元数据+文档+绑定 | 同（表已建齐） |
| 检索 | 向量（内置 embedding） | 关键词首期（R-VECTOR） |
| 摄取 | 异步 | 同步（≤2MB） |

## 7. 里程碑与验收

**交付清单**：shared knowledge zod+纯函数（单测）→ migration → API（documents/retrieve/bindings + jmx）→ UI（列表/详情/绑定 + e2e）→ 文档流转。

**DoD**：三类测试绿 → 远端 CI 绿 → push。

**演示脚本**：建 KB → 上传产品手册 → 检索「重置密码」命中 → 绑定员工 → 员工页看到 chip。

**回归范围**：staffs 详情页（新增区块）· 既有 knowledge-bases CRUD。
