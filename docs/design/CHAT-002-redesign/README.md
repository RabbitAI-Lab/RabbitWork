# CHAT-002 对话页重设计（高保真原型）

| 元信息项 | 内容 |
| -------- | ---- |
| 文档编号 | CHAT-002 |
| 原型版本 | v1（重设计） |
| 所属模块 | chat |
| 优先级   | P1 |
| 状态     | **待确认**（用户授权走标准流程：原型 → walkthrough → 编码） |
| 高保真确认 | 待确认人 / 确认日期；按 CLAUDE.md 门禁未确认前不得编码 |
| 原型路径 | `docs/design/CHAT-002-redesign/prototype.html` |
| 关联 | 替换 `apps/web/src/app/chat/[id]/page.tsx`（CHAT-001 v1） |

## 1. 当前实现观察（CHAT-001 v1）

- **header 紧凑过头**：avatar 仅 34px，name + title 只一行
- **中间浪费**：仅有消息 + Welcome card，左右有大片空白（信息密度低）
- **composer 裸**：仅文字 textarea + 翠绿发送按钮，缺工具（附件 / 任务上下文 / 人格切换）
- **消息气泡仅显示**，没有 hover 操作（无复制 / 重生成 / 反馈）
- **缺员工档案**：用户与员工对话时看不见 persona / skill / 最近任务
- **token usage 简陋**：仅在发送按钮上方一行小字

## 2. 重设计要点（v1 → v2）

| 维度 | 之前 | v2 | 来源 |
| ---- | ---- | -- | ---- |
| 头部 | 1 行紧凑 | 加大 avatar 40px + 状态 pill + 工具按钮（导出/任务/设置/返回） | DS v2.1 头像节奏 |
| 主区 | 单列 | **左右双栏**：左 260px 员工档案 \| 右 消息流 + composer | 信息密度 |
| 员工档案 | 无 | 左栏：头像 + 状态 + persona quote + skill chips + token 用量 + 最近任务 + 新对话按钮 | DS v2.1 「人物卡」范式 |
| 消息气泡 hover | 无操作 | hover 显 5 个 icon-btn：复制 / 编辑 / 重生成 / 👍 / 👎 / 复制 markdown | antd x Bubble 类型继承 |
| 流式视觉 | 无 | 头像下「小钱 正在思考 ▍ + 三点跳动」 | antd x 标准 |
| AI 回复元信息 | 无 | 头像下方一行：姓名 + 耗时 + tokens（与 sheet/chat-usage 对齐） | DS v2.1 元信息节奏 |
| composer 工具栏 | 无 | 上方工具条：附件 / 代码 / 任务上下文 / 人格切换；中间 textarea；下方提示 + token + 发送 | 主流 chat 范式 |
| token 计量 | 简单 1 行 | token 进度条 + 上下字符预估（in/out live est.） | DS v2.1 资源卡节奏 |
| 主题响应 | 仅全局 | 整页含 hover/select/bubble 全部走 `--rw-*` | 同 |

## 3. 走查要点

走查登记表（人工 walk-through 后填）：

| 批 | 走查项 | 状态 | 笔记 |
| -- | ------ | ---- | ---- |
| ① | 左侧员工档案 5 区齐：头像/状态/persona/skills/tokens/最近任务 | ☐ | |
| ② | 头像右下「在线点」绿 + 翠绿描边 | ☐ | |
| ③ | persona 引用样式（左 2px accent 立条 + muted-subtle 底）| ☐ | |
| ④ | skills chips 5+（可换行） | ☐ | |
| ⑤ | token 用量条 +「1.2K / 8K」比例文字 | ☐ | |
| ⑥ | 最近任务 3 条 pill 样式 + hover 加深 | ☐ | |
| ⑦ | 顶部 header：大头像 + 状态 pill + 4 工具按钮 | ☐ | |
| ⑧ | 消息气泡 hover 显示 5 个 icon-btn | ☐ | |
| ⑨ | AI 回复元信息行：姓名 + 耗时 + tokens | ☐ | |
| ⑩ | 流式 typing dot 3 点跳动 + accent 光标 | ☐ | |
| ⑪ | composer 工具栏 4 个 icon + 上下文计数 | ☐ | |
| ⑫ | 暗 ↔ 亮切换无裸色穿透 | ☐ | |

## 4. 勘误登记

| 编号 | 内容 | 决议 |
| ---- | ---- | ---- |
| —    |      |      |

## 5. 后续

- 原型确认 → 进入规格：`docs/sprint-office-1/CHAT-002-redesign.md`（七章）
- 规格状态转 Approved → 才开始编码 `apps/web/src/app/chat/[id]/page.tsx`
- 编码期间双人对三走查：实现 vs 原型
- 单元测试：`composer / persona-quote / bubble-actions / token-usage` 等纯函数
- e2e Playwright：「hover 气泡 → 5 操作可见」「流式打字机点动」「主题切换无 console」
