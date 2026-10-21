# 技能管理页（PROMPT 模板）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | SKILL-001 |
| 所属迭代   | sprint-skill-1（蓝图 S4 能力配置 II 首切片） |
| 优先级     | P1 |
| 所属模块   | skill |
| 文档状态   | Implemented（2026-10-22；e2e 18 全绿；走查待人工） |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | RESOURCE-001 既有 skills CRUD（规格外先行,本规格收编 UI 层） |
| 下游消费   | SKILL-002 SOP 状态机（kind=SOP 启用） |
| 上游依据   | 蓝图 §4 F3 / §6 S4 |
| **高保真确认** | **批量待走查**：原型 `docs/design/SKILL-001-skill-page/` |
| 工作量估算 | 后端 0 人日（无 API 变更）/ 前端 1 人日 / 联调 0 |

## 1. 概述

技能域首份规格（UI 收编）：`/skills` 管理页——PROMPT 技能列表（卡片：类型 pill/版本/绑定数）+ 新建/编辑弹窗（模板正文 mono 编辑）。SOP 类型置灰展示去向（SKILL-002）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| /skills 列表 + 新建/编辑/删除（PROMPT） | ✅ | — |
| SOP 类型（状态机编排） | ❌ | SKILL-002（选项置灰） |
| 版本历史/diff | ❌ | 后续（version 字段已建齐） |
| AgentScope workspace 推送 | ❌ | 上游无端点（2026-10-22 实证 404,见马拉松记忆） |

### 1.4 能力表

| 编号 | 能力 | 交互类型 |
| ---- | ---- | -------- |
| SKILL-001-C1 | 列表卡片（名称/类型/版本/绑定数） | UI |
| SKILL-001-C2 | 新建（名称/简介/PROMPT 模板正文）→ 201 | UI/API |
| SKILL-001-C3 | 编辑（同字段）→ version 自增回显 | UI/API |
| SKILL-001-C4 | 删除（确认） | UI |
| SKILL-001-C5 | 空态引导 | UI |

## 2. 业务逻辑

纯 CRUD 透传（RESOURCE-001 既有端点）：`GET/POST /api/v1/skills`、`PATCH/DELETE /api/v1/skills/{id}`；kind 固定 PROMPT（SOP 随 SKILL-002）。绑定数展示：EmployeeResourceBinding groupBy（前端不逐卡查询——列表页一次 groupBy 汇总）。

## 3. UI/UX 设计

原型 `docs/design/SKILL-001-skill-page/prototype.html`（A 列表 / B 编辑弹窗）。要点：导航「技能」；模板正文 mono 字体；SOP 选项 disabled+tooltip 去向。

## 4. 技术架构

- 页面 `apps/web/src/app/skills/page.tsx` + AppShell 菜单第 6 项；
- api-client 既有 `skillApi`（list/create/update/remove）——无变更；
- 绑定数：`GET /api/v1/skills` 响应不带——新增轻量统计端点？**零后端原则**：绑定数用 `staffResourceApi` 不可行（按员工查）——**本切片不展示绑定数**（卡片显示 v 版本与简介；绑定数随 SKILL-002/资源管理迭代补统计端点,登记 R-BINDING-COUNT）。
- **无 DDL / 无新端点 / 无权限变更**。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| SKILL-001-01 | 新建技能（名称+模板）→ 列表出现 → 编辑改模板 → v 自增 → 删除 | 三态闭环（e2e,三类断言） |

- 单测：无需（纯 UI,既有 skillApi 已覆盖契约）。
- JMeter：**豁免**——无 API 变更（RESOURCE-001 既有端点,后续随资源管理规格补全量契约计划）。
- e2e：`tests/e2e/SKILL-001-skill-page.spec.ts`。

## 6. 基线深度对标

StaffDeck 无独立技能页（技能埋在员工配置）；本项目独立管理+复用绑定——对齐蓝图 F3。

## 7. 里程碑与验收

交付清单：/skills 页 + 菜单 + e2e → 文档流转。DoD：e2e 绿 + 远端 CI 绿 + push。回归：ResourceBindings 新建技能 Modal（共用 skillApi）。
