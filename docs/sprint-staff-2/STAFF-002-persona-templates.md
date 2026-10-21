# 人设模板（预置）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | STAFF-002 |
| 所属迭代   | sprint-staff-2（蓝图 S3 能力配置 I 收尾） |
| 优先级     | P2 |
| 所属模块   | staff |
| 文档状态   | Implemented（2026-10-22） |
| 最后更新日期 | 2026-10-22 |
| 上游依赖   | STAFF-001 员工 CRUD（既有） |
| 下游消费   | 无（独立体验增强） |
| 上游依据   | 蓝图 §4 F1（S1-S2 能力延展）· §6 S3「员工人设模板」 |
| **高保真确认** | **批量待走查**：原型 `docs/design/STAFF-002-persona-templates/`（用户授权自动推进） |
| 工作量估算 | 后端 0 人日（无 API 变更）/ 前端 0.5 人日 / 联调 0 |

## 1. 概述

新建员工弹窗顶部增加「从模板开始」：预置 6 个人设模板（内容策划/数据分析/客户支持/代码评审/中英互译/项目助理），选中即预填 岗位/人设/边界（可改后提交）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 预置模板常量（6 个，四段骨架）+ 选择预填 | ✅ | — |
| 组织级自定义模板（建/编/共享） | ❌ | R-CUSTOM-TEMPLATE：随用户/资源管理域 |
| 模板市场/广场复用 | ❌ | STAFF-003 员工广场 |

### 1.4 能力表

| 编号 | 能力 | 交互类型 |
| ---- | ---- | -------- |
| STAFF-002-C1 | 模板下拉展示 6 预置（名称 · 岗位） | UI |
| STAFF-002-C2 | 选择预填 title/personaPrompt/boundary；切换覆盖 | UI |
| STAFF-002-C3 | 预填可改；编辑既有员工不显示模板入口 | UI |

## 2. 业务逻辑

选择模板 → `form.setFieldsValue`（title/personaPrompt/boundary 三字段；姓名不覆盖）；再次选择/切换同规则覆盖；allowClear 清除选择不撤销已填内容。模板常量结构四段（角色/风格/擅长/输出习惯）+ 边界，prompt 长度与 staffCreateInput（≤20000）对齐。

## 3. UI/UX 设计

原型 `docs/design/STAFF-002-persona-templates/prototype.html`（A 表单顶部模板选择与预填态）。要点：仅新建态显示；Select virtual={false}（rules/testing §3.2.3）。

## 4. 技术架构

- `packages/shared/src/persona-templates.ts`：`PersonaTemplate` 类型 + `PERSONA_TEMPLATES`（readonly）+ `personaTemplateByKey`——随 shared 发版，前端直接导入（零 API）。
- `apps/web/src/app/staffs/page.tsx`：新建分支顶部 Form.Item（非 Form 字段,受控 Select）。
- **无 DDL / 无新端点 / 无权限变更**。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| STAFF-002-01 | 新建 → 选「代码评审」 | 三字段预填；提交 201 且落库值=模板值（e2e，三类断言） |

- **单测**：模板结构完整性（key 唯一/四段/长度）——`packages/shared/src/__tests__/persona-templates.test.ts`。
- **JMeter**：**豁免**——无 API 变更（纯前端 + 常量），契约由 STAFF-001 既有计划覆盖。
- **e2e**：`tests/e2e/STAFF-002-persona-templates.spec.ts`（UI+Console+接口三类断言）。

## 6. 基线深度对标

StaffDeck 无模板概念（空白人设起步）；本项目以预置模板降低冷启动成本——差异化增强。

## 7. 里程碑与验收

交付清单：常量+单测 → 表单接入 → e2e → 文档流转。DoD：本地三类绿 + 远端 CI 绿 + push。回归范围：staffs 新建/编辑链路。
