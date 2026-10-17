# RabbitWork Design System — MASTER v2.1

> **LOGIC**：开发任何页面前，先查本文件；页面级覆盖规则放 `design-system/rabbitwork/pages/{page}.md`（存在则覆盖本文对应章节）。
> 可视化对照：`design-system/rabbitwork/preview.html`（浏览器直接打开，含亮/暗切换与全部动效演示）。
> 本规范于 2026-10-17 由用户拍板（推翻 v1 藏青金融风）；执行机制见 `rules/design-system.md`（评审清单）。

---

**风格定位**：现代工具感（Linear/Vercel 气质）× 高级编排。中性灰阶为骨，运行绿为魂；锐利几何、紧凑密度、编排式动效。企业可信但不沉闷，克制但处处有回应。

**四条铁律（违反即打回）**：

1. **单一强调色**：全系统唯一品牌色 = 运行绿。渐变只允许出现在「氛围层」（背景极光、头像底）与 `linear-gradient(135deg, accent, accent-hover)` 同色系微渐变；**禁止**渐变按钮、渐变横幅、彩色光晕卡片、紫罗兰/AI 紫配色。
2. **色彩只做语义**：颜色仅承载状态/交互语义（绿=在岗/成功、琥珀=草稿/警告、玫红=下线/失败、灰=禁用），不做装饰。
3. **圆角三级封顶**：`4px`（按钮/输入/标签/头像）/ `8px`（卡片/面板）/ `12px`（弹窗/浮层）——任何组件不得超过 12px（胶囊 pill 的 999px 仅限状态标签与徽章）。
4. **动效有语义有层级**：只做 L1-L4 四层体系内的事；常驻循环动效仅「在岗呼吸点」与「loading 指示」两类，其余全部一次性。

---

## 1. 设计 Token（唯一事实源：CSS 变量）

> 定义位置：`apps/web/src/app/theme/tokens.css`（`:root` 亮色 + `.dark` 暗色同名双套）。Tailwind v4 `@theme` 与 antd `cssVar` 主题均从这批变量取值（§6 代码架构）。

### 1.1 色彩（语义变量，禁止组件内写裸 hex）

| 语义 | 变量 | 亮色 | 暗色 | 用途 |
|---|---|---|---|---|
| 页面底 | `--rw-bg` | `#FAFAFA` | `#0B0F1A` | 应用背景 |
| 卡片面 | `--rw-card` | `#FFFFFF` | `#111827` | 卡片/表格/浮层容器 |
| 前景 | `--rw-fg` | `#0F172A` | `#F1F5F9` | 主文本 |
| 次前景 | `--rw-fg-muted` | `#64748B` | `#94A3B8` | 辅助文本/标签 |
| 弱前景 | `--rw-fg-subtle` | `#94A3B8` | `#5B6B82` | 占位/禁用（只配大字号或非关键信息） |
| 边框 | `--rw-border` | `#E4E8EE` | `#1E293B` | 1px 发丝线 |
| 沉浸边框 | `--rw-border-strong` | `#CBD5E1` | `#334155` | 输入框/hover 边框 |
| **强调** | `--rw-accent` | `#10B981` | `#34D399` | 主按钮/链接/focus/在岗 |
| 强调 hover | `--rw-accent-hover` | `#059669` | `#6EE7B7` | — |
| 强调前景 | `--rw-accent-fg` | `#FFFFFF` | `#052E21` | 强调底上的文字 |
| 强调浅底 | `--rw-accent-subtle` | `#ECFDF5` | `rgba(52,211,153,.12)` | 选中态/高亮底 |
| 成功 | `--rw-success(-subtle)` | 同 accent 系 | 同 accent 系 | 在岗/成功 |
| 警告 | `--rw-warning(-subtle)` | `#D97706` / `#FEF3E2` | `#F59E0B` / `.14 透明底` | 草稿/警告 |
| 危险 | `--rw-danger(-subtle)` | `#DC2626` / `#FDECEC` | `#F87171` / `.12 透明底` | 删除/下线/失败 |
| 中性底 | `--rw-muted-subtle` | `#F1F5F9` | `rgba(148,163,184,.10)` | 标签底/hover 底 |
| 焦点环 | `--rw-ring` | `rgba(16,185,129,.45)` | `rgba(52,211,153,.5)` | focus 光环（3px 扩散） |
| 浮层阴影 | `--rw-shadow-float` | `0 8px 24px rgba(15,23,42,.12)` | `0 8px 24px rgba(0,0,0,.5)` | 仅弹窗/下拉/hover 浮起 |
| 氛围光 A | `--rw-aurora-a` | `rgba(16,185,129,.07)` | `rgba(52,211,153,.09)` | 背景极光（绿） |
| 氛围光 B | `--rw-aurora-b` | `rgba(14,165,233,.05)` | `rgba(56,189,248,.06)` | 背景极光（蓝，辅助） |

**默认零阴影**：卡片常态无阴影，靠 1px 边框分层；hover/浮起才用 `--rw-shadow-float`。

### 1.2 字体（双语分治）

| 层 | 栈 |
|---|---|
| 标题/数字 | `"Space Grotesk", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif` |
| 正文 | `"DM Sans", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif` |
| 代码/工号/ID | `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` |

字号阶梯（紧凑工具密度）：`12 / 13(正文) / 15 / 20(页题) / 30–38(英雄)`；行高 1.6；标题 600 字重不加 bold；标题字距 `-0.01em ~ -0.025em`；数字一律 `font-variant-numeric: tabular-nums`。

### 1.3 间距 / 圆角 / 尺寸刻度

- 间距：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48`（Tailwind 默认刻度，禁止 10/14/18 等非刻度值）
- 圆角：`--radius-sm 4px` · `--radius-md 8px` · `--radius-lg 12px`（pill 999px 仅状态标签）
- 列表行高 40px；卡片内边距 16-20px；区块间距 24px；页面左右留白 28-32px；内容最大宽度 1080-1200px
- 交互热区 ≥ 32×32px（图标按钮）；触屏场景 ≥ 44px

### 1.4 动效刻度

```css
--t-fast: 140ms;   /* L1 */
--t-base: 200ms;   /* L2 */
--t-slow: 360ms;   /* L2 重 */
--t-reveal: 520ms; /* L3 */
--ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1);  /* 仅按压/弹入 */
```

---

## 2. 动效四层体系（L1-L4）

| 层 | 语义 | 时长/缓动 | 清单（白名单制） |
|---|---|---|---|
| **L1 交互反馈** | 系统收到了 | 140ms · ease-out/spring | 按钮 hover 变色+光晕 · 按压 `scale(0.96)` · 输入 focus 环 · chip 弹起 · 链接下划线 |
| **L2 状态过渡** | 属性变化连续性 | 200-360ms · ease-out | 卡片 hover（边框亮起+顶线流光+translateY(-3px)+浮层阴影）· 主题切换颜色过渡 · 骨架 shimmer · 气泡 pop-in（spring）· 展开/收起 |
| **L3 编排揭示** | 页面叙事 | 520ms · 错峰 80ms | Hero 三幕（徽章→逐行标题+下划线展开→数据）· 统计数字 count-up（900ms, cubic-out）· 卡片墙错峰入场（fade-up 14px）· 滚动出现（IntersectionObserver 一次性） |
| **L4 环境氛围** | 空间质感 | 46-58s 极慢漂移 | 背景极光（径向渐变 blur(90px) 漂移动画）· 噪点纹理（SVG feTurbulence, opacity ≤0.05）· 玻璃顶栏（blur(16px) saturate(1.4)）· 在岗呼吸点（2.4s pulse） |

**工程红线**：

- 只动画 `opacity / transform`（GPU 合成），禁止 width/height/top/left/margin 动画
- 常驻循环仅两类：状态呼吸点（在岗/在线语义）与 loading（shimmer/打字点/Spinner）——禁止装饰性无限循环
- `prefers-reduced-motion: reduce` → 所有动画/过渡 0.01ms 收敛为终态（全局规则已内置）
- 入场动画只播一次；路由切换时同规则重放
- 数字滚动仅用于统计卡/仪表类数据，表单值不滚动

---

## 3. 组件规范（antd 5 映射）

> 原则：**不重造 antd 轮子**；通过 §6 主题穿透让 antd 组件天生符合本规范；下表是「用哪个 antd 组件 + 定制点」。

| 场景 | 组件 | 定制要点 |
|---|---|---|
| 主操作 | `Button type="primary"` | 实色 accent（主题已穿透）；hover 自动光晕；`danger` 用 `--rw-danger` |
| 次操作 | `Button`（default） | 边框态，配 `--rw-border-strong` |
| 幽灵/取消 | `Button type="text"` | hover 中性底 |
| 表单 | `Form` + `Input/Select/TextArea` | 边框 `--rw-border-strong`；focus 环 accent 3px；紧凑 `size` 优先 |
| 工号/ID 展示 | mono 字体 span/Tag | `--rw-*` 等宽 + accent-subtle 底 |
| 列表 | `Table` | 行高 40px；表头背景 `--rw-muted-subtle`；边框发丝线；hover 行 `--rw-muted-subtle` |
| 卡片容器 | `div` + Tailwind | `bg-[var(--rw-card)] border border-[var(--rw-border)] rounded-lg(8px)`；可点卡片加 L2 hover 全套 |
| 弹窗 | `Modal` | 12px 圆角；浮层阴影；`destroyOnHidden`；表单弹窗宽度 560px 基准 |
| 确认删除 | `Popconfirm` | danger 语义 |
| 状态标签 | 自建 `StatusPill`（packages/ui） | 胶囊 + 呼吸点（仅 success 态 pulse）；见 preview 02 区 |
| 头像 | 自建或 `Avatar` | 4px 圆角；accent 同色系微渐变底或中性底；单字中文名 |
| 加载态 | 骨架屏优先 | shimmer 骨架 > Spin；表格用 `Skeleton.Button/Input` 组合；禁止整页转圈 |
| 空态 | `Empty` + 主操作引导 | 空态必须给「创建第一个 X」出口按钮 |
| 提示反馈 | `App.useApp()` 的 message/notification | **必须有 `<App>` 祖先**（providers 已修）；成功=success 语义色 |
| 分页 | `Pagination` | 紧凑 size；总数展示 |
| 下拉/浮层 | `Select/Dropdown` | 4px 圆角浮层 + `--rw-shadow-float`；**必须 portal 挂载**（rules/react-nextjs §5.5） |

**弹层红线**（继承 rules/react-nextjs §5.5）：所有浮层 portal/fixed，禁止被父容器 overflow 裁剪。

---

## 4. AI 对话组件（Ant Design X）

> 全部 AI 对话 UI 使用 `@ant-design/x`（Bubble / Sender / Conversations / ThoughtChain / Welcome / Attachments），经 `XProvider` 接入同一主题——翠绿、亮暗、token 自动穿透，**禁止自绘对话气泡体系**。

| 组件 | 用法 | 规范点 |
|---|---|---|
| `Bubble` | 消息列表 | 用户消息 = accent 实心（右）；员工消息 = card 底 + 边框（左）+ 28px 头像；入场 pop-in（spring 360ms）；markdown 渲染走安全管线（禁 raw HTML） |
| `Sender` | 输入区 | 4px 圆角 + focus-within 环；⌘/Ctrl+Enter 发送；placeholder 语义化（「给 XX 发消息…」）；变高上限 6 行 |
| `Conversations` | 会话列表（chat 侧栏） | 紧凑行高；活跃会话 accent-subtle 底 |
| `ThoughtChain` | 推理/步骤过程 | mono 小字；步骤完成打钩动画（一次性） |
| `Welcome` | 空态唤醒 | 快捷话题 chips（≤3 个）+ 主引导语；chips hover 弹起 |
| 打字指示 | Bubble typing | 三点 blink；**生成完成后必须消失**（状态翻转强信号，rules/testing §3.5.1） |

**对话页专属**：消息区 `scroll-slim` 细滚动条；SSE 断线重连提示条用 warning 语义；interrupt 后残留气泡标记「已中断」。

---

## 5. 页面模式（布局骨架）

### 5.1 全局骨架（AppShell）

玻璃顶栏（56px，sticky，blur 16px）+ 左侧导航（icon+文字，激活态 accent-subtle 底 + 左侧 2px accent 指示条；路由高亮精确匹配 end）+ 内容区（max-w 1080-1200px 居中）。氛围层（极光+噪点）全局 fixed 挂载一次，pointer-events: none。

### 5.2 列表页模式（staffs/teams/conversations 通用）

1. 页头：H1 页题（20px）+ 副说明（12px muted）+ 右侧主操作按钮
2. 统计条：3-4 个统计卡（icon + count-up 数字 + 标签；数字 tabular-nums）
3. 过滤区：Segmented 分类（含计数）+ 搜索框（allowClear）；右侧对齐
4. 内容区：卡片墙（3 列 grid，≤860px 两列，≤580px 单列）或表格（字段密集型）
5. 空态：Empty + 「创建第一个」主操作
6. 加载：卡片骨架 ×3（shimmer）

页面加载编排：页头(L3 先入) → 统计数字滚动 → 卡片墙 80ms 错峰。

### 5.3 详情页模式

面包屑返回 + 标题区（头像+名称+状态 pill+meta）→ Tab 分区（基本信息/统计/关联资源）→ 各区面板。危险操作（删除/下线）收进「危险区」面板，danger 边框语义。

### 5.4 表单弹窗模式

新建/编辑统一 Modal 560px；必填项 `requiredMark=false` + placeholder 说明；字段 label 12px muted；提交按钮 loading 态（confirmLoading）；**成功后必须：message.success + 关闭弹窗 + 列表 invalidate + 表单 reset**（本仓曾因缺 `<App>` 祖先致此链断裂，回归用例已覆盖）。

### 5.5 聊天页模式（chat/[id]）

左侧会话列表（Conversations，可折叠）+ 右侧主区：头部（员工名+状态）→ 消息流（Bubble.List，滚动到底）→ 底部 Sender。快捷话题仅空会话时展示（Welcome）。

### 5.6 状态与反馈

- 加载：骨架屏（结构已知）或局部 Spin（局部刷新）；禁止整页白屏转圈
- 错误：Inline 错误条（warning/danger 语义）+ 真实错误原因透出（rules/react-nextjs §5.7）；重试按钮
- 权限未就绪：fail-closed 禁用态（视觉=无权限态）
- 乐观更新失败：回滚 + toast danger

---

## 6. 代码架构（CSS 变量单源）

```
apps/web/src/app/theme/
├── tokens.css        # §1 全部 --rw-* 变量（:root 亮 + .dark 暗）——唯一事实源
└── antd-theme.ts     # ThemeConfig：从 tokens 取值映射 antd token（cssVar 模式）
apps/web/src/app/providers.tsx
└── QueryClientProvider → ConfigProvider(theme + cssVar) → AntdApp → children
apps/web/src/components/theme-toggle.tsx
└── 亮暗切换（html.dark + localStorage + 跟随系统）
```

接线规则：

1. **antd**：`ConfigProvider theme={{ cssVar: true, algorithm: light/dark, token: { colorPrimary: var(--rw-accent), borderRadius: 4, ... } }}`；antdx 的 `XProvider` 同 theme 直传（继承穿透）。
2. **Tailwind v4**：`@theme` 内 `--color-rw-bg: var(--rw-bg)` 等映射；暗色用 `@custom-variant dark (&:where(.dark, .dark *))`（class 策略）；**业务代码只允许语义类**（`text-rw-fg-muted` / `bg-rw-card` / `border-rw-border`），禁止 `bg-slate-500` 这类裸色板类与裸 hex。
3. **主题切换**：`html.classList.toggle('dark')` + `localStorage('rw-theme')` + 无 `localStorage` 时跟随 `prefers-color-scheme`；**防闪烁**：layout `<head>` 内联一小段阻塞脚本先设 class（禁止 React effect 后置设置）。
4. **组件层**：跨页面复用组件沉淀 `packages/ui`（StatusPill / StatCard / EmptyState / PageHeader 等）；组件内禁止读写非语义色。

---

## 7. 执行机制（怎么保证「严格按照规范」）

1. **rules/design-system.md**（已挂 CLAUDE.md）：开发前必读 + PR review checklist 逐项核对；违规项按 Code Review 阻塞处理。
2. **/design showcase 对照页**（`apps/web/src/app/design/page.tsx`）：全部标准组件/状态/动效的真实 React 实现（antd+antdx+Tailwind 全链路），开发时人肉对照；showcase 本身随 token 演进同步维护。
3. **e2e 视觉断言**（tests/e2e/）：对 showcase 与关键页面断言 computed style——`--rw-accent` 实际值、圆角 4/8/12、`.dark` 切换后变量翻转、按钮 hover/active 态存在 transition；token 漂移即 CI 红灯。
4. **页面级覆盖**：特殊页面需求写 `design-system/rabbitwork/pages/{page}.md` 登记（如聊天页对气泡的特殊约定），评审时对照。

---

## 8. 反模式（Do NOT）

- ❌ 紫罗兰/AI 紫渐变、多彩渐变按钮/横幅、彩色光晕卡片
- ❌ 圆角 >12px（pill 标签除外）；全圆角胶囊按钮
- ❌ 常态阴影卡片；多层阴影堆叠
- ❌ 组件内裸 hex / Tailwind 裸色板类（`bg-slate-*` 等）
- ❌ emoji 当图标；图标不统一（统一 `@ant-design/icons`，缺的用内联 SVG）
- ❌ 装饰性无限循环动画；width/height/top/left 动画
- ❌ 整页 `'use client'`；弹层非 portal
- ❌ 通用文案错误提示（「操作失败」）；权限先放行后纠正
- ❌ 自绘对话气泡体系（必须用 antdx）
- ❌ Inter/Roboto/Arial 做英文主字体；中文场景无回退字体栈

---

## 9. 交付前检查清单（每页过一遍）

- [ ] 全部颜色来自 `--rw-*` 语义变量（含暗色验证：切换 `.dark` 无裸色残留）
- [ ] 圆角 ∈ {4, 8, 12}；间距 ∈ 刻度表
- [ ] 字体三层正确（标题 Space Grotesk / 正文 DM Sans / 代码 JetBrains Mono）；数字 tabular-nums
- [ ] 交互反馈齐全：hover / active 按压 / focus-visible 环
- [ ] 入场有编排（≤3 幕）；无装饰循环动画
- [ ] 加载=骨架、空态=引导、错误=真实原因
- [ ] 可访问性：对比度 4.5:1、键盘可达、focus 可见、reduced-motion 收敛
- [ ] antd 组件经主题穿透（抽查 primary 按钮/focus 环为翠绿）
- [ ] 对话类 UI 全部来自 antdx
- [ ] e2e 三类断言 + 视觉断言通过（CI 绿）

---

## 10. 现有页面迁移（旧 → 新）

| 页面 | 现状问题 | 迁移动作 |
|---|---|---|
| login | 旧品牌色、无氛围层 | 新 token 重做 + hero 编排入场 |
| office | 旧色板卡片 | 换 token + 统计 count-up + 卡片 hover L2 |
| staffs (+[id]) | `bg-slate-*` 裸类、旧渐变按钮、avatar 渐变 | 语义类替换 + StatusPill + 编排入场 |
| teams (+[id]) | 同上 | 同上 |
| chat/[id] | 自绘气泡/输入 | **重写为 antdx Bubble+Sender+Conversations** + 主题穿透 |

迁移随各功能迭代 PR 逐步进行（不一次性大爆炸）；新页面一律直接按本规范开发。

---

*生成：2026-10-17 · 决策记录：推翻 v1 藏青金融风 → 现代工具感（用户拍板）；亮暗双主题；圆角 4/8/12（用户修正）；AI 组件 = Ant Design X（用户指定）；动效四层（用户要求「高端大气眼前一亮」）。*
