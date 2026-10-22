# SOP 状态机编排

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | SKILL-002 |
| 所属迭代   | sprint-skill-2（蓝图 S9+ 团队与渠道批次） |
| 优先级     | P1 |
| 所属模块   | skill |
| 文档状态   | Prototyped |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | SkillDefinition.sopGraph 列（一次建齐,零 DDL） · SKILL-001 /skills 页 · 员工发布链路 |
| 下游消费   | 员工绑定 SOP 技能;运行留痕 |
| 上游依据   | 蓝图 §4 F3/§6 S9+：SOP 状态机编排（蒸馏+可视化编辑） |
| **高保真确认** | **批量待走查**：原型 `docs/design/SKILL-002-sop-orchestration/` |
| 工作量估算 | 后端 1.5 人日 / 前端 1.5 人日 / 联调 0.5 人日 |

## 1. 概述

SOP 技能启用（kind=SOP）：**节点序列定义 + 条件分支**的状态机,绑定员工后可「运行」——按节点逐步 sendTurn 执行,每步留痕。首期编辑形态为**表单式节点列表**（节点=提示步骤,边=顺序/条件跳转）;**画布可视化编辑器登记增强**（R-CANVAS,不进本切片——antd 无图编辑器,引入图库属架构级决策）。运行执行为**同步单次**（顺序执行全部节点,条件分支求值跳转,人工节点=暂停待 HANDOFF 解决后继续——复用 CHAT-003）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| SOP 定义：节点（start/llm/human/end）+ 条件边（含变量比较） | ✅ | — |
| 表单式编辑（节点列表+边选择;JSON 视图） | ✅ | R-CANVAS：画布编辑器 |
| SOP 校验（连通性/必填/首尾节点;纯函数单测） | ✅ | — |
| 运行：逐步 sendTurn + 条件求值跳转 + 步骤留痕 | ✅ | — |
| 人工节点：暂停→HANDOFF→解决后继续（复用 CHAT-003） | ✅ | — |
| SOP 蒸馏（对话历史→自动生成 SOP） | ❌ | 后续（AI 辅助生成） |
| 并行节点/子流程嵌套 | ❌ | 蓝图列已注释,远期 |
| 画布可视化编辑 | ❌ | R-CANVAS |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| SKILL-002-C1 | /skills 创建/编辑 SOP 技能（节点表单:类型/提示词/条件出边） |
| SKILL-002-C2 | SOP 校验：非法图（无 start/环不可达 end/节点空提示）422 透出 |
| SKILL-002-C3 | 运行 SOP（选员工+变量）：逐步执行,LLM 步骤走 sendTurn,步骤留痕可见 |
| SKILL-002-C4 | 条件边求值：变量比较（eq/gte/lte/contains）跳转 |
| SKILL-002-C5 | 人工节点：执行暂停（PENDING_HANDOFF）→ /handoffs 解决 → 继续执行 |
| SKILL-002-C6 | JSON 视图查看 sopGraph;未登录 401 |

## 2. 业务逻辑

### 2.1 sopGraph 结构（zod 冻结）

```jsonc
{
  "nodes": [
    { "id": "n1", "type": "start" },
    { "id": "n2", "type": "llm", "prompt": "检索 {{query}} 并总结" },
    { "id": "n3", "type": "human", "instruction": "人工复核摘要" },
    { "id": "n4", "type": "end" }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" },
    { "from": "n3", "to": "n4" }
  ],
  "variables": [{ "key": "query", "required": true }]
}
```

条件边：`{ from, to, when: { var: "score", op: "gte", value: 80 } }`——**多条出边时按声明序取第一条命中**（无 when 的边为兜底,必须最后）。

### 2.2 校验规则（纯函数 `validateSopGraph`,单测矩阵）

1. 恰好一个 start、至少一个 end;节点 id 唯一;
2. llm/human 节点 prompt/instruction 非空;
3. 边引用的 from/to 必须存在;start 有出边,end 无出边;
4. 从 start 可达全部节点（BFS）,且每个 end 可达（无悬挂）;
5. 多出边节点：条件边在前,兜底边至多一条且最后。

### 2.3 运行执行体（`runSop(skillId, employeeId, variables)`）

- 建 origin="SOP" 会话（originRef=`soprun:{runId}`）;
- 从 start 起沿边走：llm 节点=sendTurn（prompt 变量渲染 `{{key}}`,同 CRON 模板）,回复存入消息流+步骤记录;human 节点=创建 HumanHandoffRecord（reason=instruction）+ 会话 HANDOFF + 运行态 PAUSED_HANDOFF,**解决后从该节点继续**（复用 CHAT-003 resolve 钩子——resolve 时检查会话有无 PAUSED SOP 运行并续跑）;end 节点=完成;
- 步骤留痕：`SopRunStep`（无表——**存 Conversation 系统消息 + RunRecord.detail? 首期用 ScheduledTaskRun? 不通**——**新增轻量表? 零 DDL 原则冲突**——用**消息镜像 SYSTEM 消息**留痕每步 `[SOP] 节点n2 → 完成`,SOP 运行列表查询=按 origin=SOP 会话聚合）;
- 运行状态：SopRun 状态存哪?——**复用 RunRecord**：status EXT 不可……首期**同步执行不落独立运行态**:PAUSED 除外（由会话 HANDOFF 状态承载）,完成后会话 status=IDLE。

### 2.4 变量

运行入参 variables 必填校验（required 项缺失 422）;渲染进 prompt `{{key}}`。

## 3. UI/UX 设计

原型 `docs/design/SKILL-002-sop-orchestration/`。/skills SOP 编辑：节点卡片列表（类型 tag/提示词/出边表格）+「添加节点/边」+ 右侧 JSON 抽屉;运行入口：SOP 技能卡「运行」→ 弹窗（选员工+变量表单）→ 执行;人工节点暂停→黄条同 CHAT-003。

## 4. 技术架构

- shared `skill.ts`（新文件）：sopGraph zod（nodes/edges/variables）/`validateSopGraph`/`evaluateCondition` 纯函数 + 单测;
- API：`POST /api/v1/skills/{id}/run`（{ employeeId, variables }→同步执行至暂停/完成）;PATCH skills 扩展 sopGraph 接收;既有 CRUD 复用;
- `apps/web/src/server/sop-run.ts`：执行体 + HANDOFF 解决续跑钩子（handoffs resolve 路由调用）;
- 前端：/skills SOP 分支编辑（节点表单）+ 运行弹窗;api-client skillApi.run。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| SKILL-002-01 | 建 SOP（start→llm→end,变量 query）→ 运行 → 会话含渲染后消息+完成系统消息 | e2e |
| SKILL-002-02 | 条件分支（score≥80→endA,否则→endB）→ 两变量值各跑一次路径正确 | e2e |
| SKILL-002-03 | 人工节点 SOP → 运行暂停（HANDOFF）→ /handoffs 解决 → 续跑至完成 | e2e |
| SKILL-002-04 | 非法图（无 start/条件边后置兜底/缺变量）422 | jmx |
| 单测 | validateSopGraph 全规则矩阵 + evaluateCondition 四操作 | — |

## 6. 基线深度对标

蓝图：蒸馏+可视化编辑——本切片落状态机编排与执行;蒸馏与画布登记增强。

## 7. 里程碑与验收

交付清单：sopGraph zod+校验纯函数单测 → skills API 扩展+jmx → sop-run 执行体+续跑钩子 → /skills UI+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
