# rules/design-system.md — UI 设计规范执行（开发与评审清单）

> 由 CLAUDE.md 挂载引用。**唯一事实源：[design-system/rabbitwork/MASTER.md](../design-system/rabbitwork/MASTER.md)**（含完整 token 表/组件映射/页面模式/动效体系）；可视化对照 `design-system/rabbitwork/preview.html`。本文件回答「开发时怎么执行、评审时查什么」。

## 1. 开发前（必做）

1. 读 MASTER.md 全文一次（新会话首次开发 UI 前）；开发具体页面前查 `design-system/rabbitwork/pages/{page}.md` 是否有覆盖规则。
2. 打开 `/design`（showcase 对照页）作为组件与动效的人肉参照。
3. 技术栈铁律：通用组件 = antd 5（主题穿透，禁手写基础组件替代）｜AI 对话 UI = `@ant-design/x`（禁自绘气泡体系）｜布局排版 = Tailwind v4 语义类。

## 2. 编码硬规则（违反 = Review 阻塞）

1. **颜色**：只允许 `var(--rw-*)` 语义变量或其 Tailwind 映射类（`text-rw-fg` / `bg-rw-card` / `border-rw-border`…）；**禁止**组件内裸 hex、`bg-slate-500` 等裸色板类、`text-gray-*`。
2. **圆角**：只允许 4 / 8 / 12（pill 999px 仅状态标签）；间距只允许刻度值（4/8/12/16/20/24/32/48）。
3. **字体**：标题 `font-display`、正文 `font-body`、代码/工号 `font-mono`；数字加 `tabular-nums`；禁 Inter/Roboto 做主字体。
4. **阴影**：默认零阴影；浮起/弹窗用 `--rw-shadow-float`。
5. **动效**：只在 MASTER §2 四层白名单内；只动 opacity/transform；常驻循环仅呼吸点与 loading；页面入场编排 ≤3 幕。
6. **主题**：亮暗双套必须同 PR 验证（切换 `.dark` 走查无裸色残留）；新颜色必须先在 tokens.css 登记（双值）再用。
7. **antd/antdx**：经 ConfigProvider/XProvider 主题穿透使用，禁绕过主题自行覆盖组件内颜色；对话页 UI 一律 antdx 组件。
8. **a11y**：focus-visible 翠绿环不可移除；对比度 ≥4.5:1；可交互元素 ≥32×32 热区 + 可访问名称；`prefers-reduced-motion` 全局收敛不得破坏。

## 3. PR Review Checklist（UI 类必过，追加到 git-workflow §4）

- [ ] 无裸 hex / 裸色板类（grep `#[0-9a-fA-F]{3,8}` 与 `bg-slate|text-gray` 于本次 diff）
- [ ] 圆角/间距/字号全部出自刻度表；数字 tabular-nums
- [ ] 亮暗双主题截图走查（PR 附两态截图）
- [ ] hover/active/focus 三态反馈齐全；按压 scale(0.96) 语言一致
- [ ] 加载=骨架屏、空态=引导出口、错误=真实原因透出
- [ ] 入场编排 ≤3 幕；无装饰性循环动画
- [ ] antd 组件主题穿透生效（抽查 primary 按钮/focus 环）；对话 UI 来自 antdx
- [ ] 弹层 portal；路由高亮精确匹配（end）
- [ ] e2e 含视觉断言（computed style：accent 值/圆角/暗色翻转）

## 4. showcase 与回归

1. `/design` 页是组件规范的活文档：token 或组件规范变更必须同步 showcase。
2. e2e 视觉断言锁定：`--rw-accent` 亮暗双值、按钮 borderRadius=4px、卡片 8px、Modal 12px、`.dark` 切换后 body 背景翻转——漂移即 CI 红灯。
3. 新页面 PR 必须附：亮/暗两态整页截图 + （有动效时）录屏。
