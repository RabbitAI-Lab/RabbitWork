# CHAT-002 对话工作台重设计（两栏布局 + 交互气泡）

| 元信息项 | 内容 |
| -------- | ---- |
| 文档编号 | CHAT-002 |
| 所属迭代 | sprint-office-1 |
| 优先级 | P1 |
| 所属模块 | chat |
| 文档状态 | **Implemented**（由用户「没问题，开发吧」决策直接进入实现） |
| 最后更新日期 | 2026-10-18 |
| 上游依赖 | CHAT-001 v1（已 Implemented）、OFFICE-001 v2（DS v2.1 主题）、OFFCIE-002（Pixi token 复用 — 本规格不依赖 Pixi） |
| 下游消费 | 未来可能：聊天侧边多会话、消息搜索、任务上下文注入面板 |
| 上游依据 | 用户决策「http://localhost:3600/chat/a56f6c29-66af-4e0b-9649-e2a021042c21 这个 AI 的对话页面，UI 帮我重新设计」 |
| 关联架构文档 | monorepo-structure / react-nextjs / api-conventions |
| 高保真确认 | 2026-10-18（用户走查 `docs/design/CHAT-002-redesign/prototype.html` 后通过） |
| 工作量估算 | 后端 0 / 前端 1.5 人日 / 联调 0.5 人日 |

## 1. 概述

### 1.1 功能定位
把 CHAT-001 v1 的 chat 页（`apps/web/src/app/chat/[id]/page.tsx`）从「紧凑 header + 单列空白 + 裸 composer」改为「品牌头 + 双栏（左 persona / 右消息）+ 交互气泡 + 工具 composer」，DS v2.1 范式 + antdx Bubble/Sender/Welcome 不变。

### 1.2 范围边界表

| 能力 | 本规格 | 去向后置 |
| ---- | ------ | -------- |
| 左侧 employee persona 卡（头像/在线点/工种标签/persona 引文/skills chips/token 用量条/最近任务/新对话按钮） | ✅ | — |
| 顶 header（40px 头像、状态 pill、4 工具按钮：导出/任务/设置/返回） | ✅ | — |
| 用户消息：end placement + bubble-user + hover 显示复制/编辑按钮 | ✅ | — |
| AI 消息：start placement + bubble-agent + hover 显示 5 按钮（复制/重生成/👍/👎/复制 markdown） | ✅ | — |
| AI 元信息行：姓名 · 耗时 · tokens | ✅ | — |
| 流式渲染：thinking 3 跳动 dot + typing 光标 | ✅ | — |
| composer 工具栏：附件 / 代码 / 任务上下文 / 人格切换 + 上下文计数 | ✅（icon 占位 + console） | 真实功能点 |
| composer 输入：textarea + token 预估 + 发送 | ✅ | — |
| 主题响应：`html.dark` MutationObserver 桥 | ✅ | — |
| SSE 流式 / `chatApi.send/interrupt/detail` 调用 | 不变 | — |
| 多会话列表侧边栏 | ❌ | 后置 PR |
| 任务上下文注入面板（agentstate / skills / doc 检索） | ❌ | M2 chatagent 域 |

### 1.3 前置依赖表
| 文档 | 阻塞原因 |
| ---- | -------- |
| CHAT-001 v1 | 当前 chat 页是基础，本规格不替换 API 仅做 UI |
| OFFICE-001 v2 | DS v2.1 token / 主题桥 |
| OFFCIE-002 | pixi tokensFromVars 复用参考（不依赖实际 Pixi） |

### 1.4 能力表（每行 = 一条可验收 · rules/testing §1.2）

| 编号 | 名称 | 交互类型 | 验收口径 |
| ---- | ---- | -------- | -------- |
| CHAT-002-01 | 顶部 header 加大头像 + 4 工具按钮 | 渲染 | `data-testid=chat-header` 存在；avatar ≥40px；`button[aria-label=...]` × 4 |
| CHAT-002-02 | 左侧 persona 卡完整 | 渲染 | 含 `chat-persona`；6 区齐；空态有占位 |
| CHAT-002-03 | persona token 用量条 | 渲染 | `--rw-accent` 渐变；≥0% ≤100% |
| CHAT-002-04 | 用户气泡：end placement | 渲染 | `data-testid=bubble-user`；hover 显示 复制/编辑 |
| CHAT-002-05 | AI 气泡：start placement | 渲染 | `data-testid=bubble-assistant`；hover 显示 5 个 icon-btn |
| CHAT-002-06 | 流式：thinking dot + 光标 | 动态 | message_completed 前显示 dot、点 `▍` cursor |
| CHAT-002-07 | composer 工具栏 4 icon | 渲染 | icon-btn 4 个；点击仅 console（真功能下一片）|
| CHAT-002-08 | composer send / interrupt 切换 | 交互 | 流式时变 stop，其余时间 send |
| CHAT-002-09 | token 预估 live | 渲染 | in = input.length / 4 上取整；out ≈ input × 6 |
| CHAT-002-10 | 主题切换无裸穿透 | 静态 | dark ↔ light 切换所有 token 同步 |
| CHAT-002-11 | ⌘↵ 发送 / Shift+↵ 换行 | 交互 | keydown listener 触发 send |
| CHAT-002-12 | Esc 关闭菜单 / 退出输入 | 交互 | focus 在 input 时 Esc 清空，Esc 关气泡菜单（如实现） |

### 1.5 基线核对
| 项 | CHAT-001 v1 | CHAT-002 v2 | 备注 |
| - | ---------- | --------- | ---- |
| Header | 头像 34px 单行 | 头像 40px + 工具按钮 | 升级 |
| 主区 | 单列 | 双栏（左 persona + 右消息+composer） | 信息密度翻倍 |
| Composer | 裸 text + send | 工具栏 + textarea + token 预估 | 主流 chat 范式 |
| 气泡 hover | 无 | 5 个操作（用户：2；AI：5） | 交互提升 |
| 元信息（AI） | 仅气泡底部 | 气泡上方（姓名·耗时·tokens） | DS v2.1 节奏 |
| 流式状态 | 仅 typing | typing dot 3 跳 + accent 光标 | 视觉清晰 |

## 2. 业务逻辑

### 2.1 状态机
- `messages: MessageDto[]`：已落库的历史消息
- `streamingText: string`：当前 delta 累积的临时文本（message_completed 后转 message + 清空）
- `streaming: boolean`：EventSource 状态
- `input: string`：受控输入
- `focused: 'input' | 'composer-toolbar'`：键盘监听归属（⌘↵ 仅当 focused='input'）

### 2.2 流程图（发送消息）

```
textarea ⌘↵
  └─→ onSubmit(content)
        └─→ send mutation → chatApi.send({ content })
              ├─ onSuccess(userMessage) → setMessages([...prev, userMessage])
              │                          → openStream() ← EventSource /events
              │                                       ├─ delta → setStreamingText(+text)
              │                                       ├─ message_completed → setMessages(append)
              │                                       ├─ usage → setLastUsage()
              │                                       ├─ done → setStreaming(false); refetch
              └─ onError → message.error
```

### 2.3 规则明细
1. token 预估：`in = max(1, ceil(input.length / 4))`、`out = in * 6 + 32`（经验估算，M2 任务域待接真实计算器）
2. ⌘↵：keydown 监听只在 `textarea:focus` 时触发；非 input 焦点时不拦截
3. ⌘K / Esc（在 input 中）→ 清空 input（与 antdx 默认一致）
4. message_completed 前 delta 与 streamingText 同源，message_completed 后转 messages + 清空 streamingText（避免重复显示）
5. interrupted → 关闭 EventSource + 清空 streamingText + 重新 query

### 2.4 边界与异常
- API auth 失败（10001 / 401）→ redirect 到 `/login`（中间件处理，无须 chat 页自行兜底）
- SSE 异常断开（onerror）→ setStreaming(false) + closeStream + 重新 query 拉最终结果
- response 200 但 code !== 0 → 当前 useQuery 不抛错，由 messages 异常流分支处理（M2 增加 ApiError 校验）

## 3. UI/UX 设计

```
┌───────── AppShell ──────────────────────────────────┐
│ ┌─────┐ ┌──persona─── ┌──────── 主体 ──────────────┐ │
│ │     │ │ [头像+状态] │ [header:avatar+状态+工具]   │ │
│ │菜单 │ │ persona     │ ────────────────────────── │ │
│ │     │ │ skills chip │ [Welcome / message 流]    │ │
│ │     │ │ token 条    │                          │ │
│ │     │ │ 最近任务    │ [composer:工具+输入+发送] │ │
│ └─────┘ └─────────── └──────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 视觉规范（DS v2.1）

- 左 persona 卡：280px 宽（spec 中 260，调到 280 给 persona 引文多一字宽）；卡片化用 `rw-card`
- avatar 大头像 64px（persona）+ 40px（header）
- persona 引文：左 2px accent 立条 + muted-subtle 底；DS 化用 `.persona-quote::before`
- token 条：高度 4px、`--rw-accent` 渐变；进度文字 mono
- 气泡：bubble-user（`--rw-accent`）/ bubble-agent（card + border）；bubble-in 0.36s 弹出
- AI 元信息：12px + 中间圆点隔 + font-mono tabs nums（与 chat-usage testid 对齐）
- 流式光标：accent + animate-blink；jsx 中单独 `<span>` 避免 React text diff 抖动
- icon-btn：28×28 / 边 1px / hover 加深 border / active scale 0.92
- composer 工具栏：4 个 toolbar-icon（30×30）+ 「已选 N 个上下文」右对齐
- composer input wrap：focus-within 时 accent 边 + 3px ring（与现有 `.rw-sender` 一致）

### 对话式用例走查
1. 进 `/chat/[id]` → 见上方 header 大头像 + 状态 / 左 persona 卡完整 / 下方流白消息区
2. 输入 → 流式：input 同时下方显示预估 token + 流式时右下变 stop 按钮
3. 鼠标 hover 用户消息 → 见复制/编辑；hover AI 消息 → 见复制/重生成/👍/👎/复制 md
4. ⌘↵ 直接发送；Shift+↵ 换行
5. 切主题 → 整页同步切换（包括左右气泡、AI 元信息、composer）
6. 流式中按 Esc → 关闭流、保留 input

## 4. 技术架构

### 4.1 依赖
| 决策 | 选择 | 理由 |
| ---- | ---- | ---- |
| 现有 antdx Bubble/Sender/Welcome 不动 | ✅ | 与 DS v2.1 已贯通；本规格不引入新 component lib |
| 不引 icon 包 | 沿用 emoji/Unicode（最小包） | 复用 CHAT-001 v1 已有 icons 风格 |
| 不引 CodeBlock 库 | 用 `<code>` + `<pre>` 自带样式（M2 引入） | 骨架期最少依赖 |
| token 预估不接真实 API | 输入侧即时估算（M2 接 runtime） | UX 反馈即时 |

### 4.2 数据模型
无 schema 变更。继续 `MessageDto` / `ChatEvent`。  

新增本地辅助类型（page 内私有）：
```ts
interface TokenUsage { model?: string; input?: number; output?: number; total?: number; }
```

### 4.3 关键代码示意（仅新增的 ChatPersonaCard / ChatBubble / ChatComposer）

```tsx
// components/ChatPersonaCard.tsx
interface PersonaCardProps {
  employee: { name: string; title: string; personaPrompt?: string } | null;
  usage?: TokenUsage | null;
  recentTasks: Array<{ title: string }>;
  totalTokens: number;
  onNewChat: () => void;
}
function ChatPersonaCard({ employee, usage, recentTasks, totalTokens, onNewChat }: PersonaCardProps) {
  return (
    <aside data-testid="chat-persona" className="...">
      {/* 5 区 + 新对话 */}
    </aside>
  );
}

// components/ChatBubble.tsx
function ChatBubble({ role, content, streaming, usage, name, onCopy, onRegenerate, onFeedback }: Props) {
  const isUser = role === "USER";
  return (
    <div className="bubble-host relative group">
      {/* 头像 + 元信息 + bubble */}
      <div className="bubble-actions opacity-0 group-hover:opacity-100 ...">
        <button onClick={onCopy}>⧉</button>
        ...
      </div>
    </div>
  );
}

// components/ChatComposer.tsx
function ChatComposer({ input, onChange, onSubmit, streaming, onInterrupt, contextCount }: Props) {
  return (
    <div className="composer-wrap">
      <div className="composer-toolbar">📎 ⌨ 📋 🧪 ... 已选 {contextCount}</div>
      <textarea value={input} onKeyDown={handleKeyDown} onChange={onChange} ...>
      <div className="composer-row">...token... 发送</div>
    </div>
  );
}
```

### 4.4 权限点（无新增）

### 4.5 错误处理
- 复制失败：fallback 用 `navigator.clipboard.writeText`；旧浏览器降级到隐藏 textarea + execCommand
- SSE 异常断开：onerror 兜底
- 反馈（👍/👎）：写入 `chatApi.feedback(msgId, score)`（M2 提供，本规格只占位）

## 5. 测试用例

### 5.1 Vitest 单测
| 编号 | 文件 | 摘要 |
| ---- | ---- | -------- |
| CHAT-002-VT-01 | `apps/web/src/app/chat/[id]/utils.ts` 等纯函数 | token 预估（in / out 公式）、message_completed 折叠逻辑 |

### 5.2 Playwright e2e
| 编号 | 摘要 |
| ---- | -------- |
| CHAT-002-E2E-01 | 进入 `/chat/[id]`：`data-testid=chat-header / chat-persona / chat-messages / chat-input` 全部可见；console 无 error |
| CHAT-002-E2E-02 | hover 用户消息 → 复制/编辑 icon 可见；hover AI 消息 → 5 icon 可见 |
| CHAT-002-E2E-03 | 主题切换 dark ↔ light 无 console error |
| CHAT-002-E2E-04 | composer 输入 → `in 32 / out ~220` 数字更新 |

### 5.3 JMeter 接口用例（无新 API → 跳过）

### 5.4 关键状态二态（rules/testing §1.2）
| 二态 | 覆盖 |
| ---- | ---- |
| 流式 vs 已发送 | ✅ typing dot + cursor 切换 |
| 暗 vs 亮 | ✅ E2E-03 |
| 加载完成 vs SSE 推送中 | ✅ streaming state + UI 切换 |

## 6. 基线深度对标

| 决策点 | CHAT-001 v1 | CHAT-002 v2 |
| ------ | ---------- | --------- |
| Header | 1 行 | 加大头像 + 工具栏 |
| 主区 | 单列 | 双栏（persona 卡 / 消息流） |
| 气泡 hover | 无 | 5 个 icon-btn |
| Composer | 单 textarea + send | toolbar + textarea + token 预估 + send |
| AI 元信息 | 气泡内底部小字 | 气泡上方独立行 |
| token 数字 | 单行 | token 条 + 行内预估 |

## 7. 里程碑与验收

### 7.1 交付清单
| # | 交付物 | DoD |
| - | ------ | -- |
| 1 | `apps/web/src/app/chat/[id]/page.tsx` 重写 | 双栏布局；hover actions；toolbar composer |
| 2 | `apps/web/src/components/ChatPersonaCard.tsx` | 6 区齐全；空态占位；testid chat-persona |
| 3 | `apps/web/src/components/ChatBubble.tsx` | user/ai 两种 placement；hover 行为；testid bubble-user/bubble-assistant |
| 4 | `apps/web/src/components/ChatComposer.tsx` | 4 工具 + textarea + token 预估 + send/interrupt 切换；testid chat-composer |
| 5 | `apps/web/src/app/chat/chat.css` | 双栏布局 + 气泡动画 + 工具栏交互 |
| 6 | 单测（apps/web/src/app/chat/[id]/__tests__/） | token 预估 + 流式状态机 ≥4 用例 |
| 7 | e2e（tests/e2e/CHAT-002-redesign.spec.ts） | ≥2 用例 |

### 7.2 演示脚本（人工走查）
1. `pnpm dev`（或 prod 模式已起），浏览器 `http://localhost:3600/chat/<id>`（登录态）
2. 看左 persona / 顶 header / 消息流 / composer 全部到位
3. hover 用户消息 → 看复制/编辑；hover AI → 看 5 操作
4. 写消息 → ⌘↵ → 看流式 typing dots + accent 光标 + 元信息行
5. 切主题 → 全部同步

### 7.3 回归范围
- ✅ CHAT-001 v1 SSE 流式、interrupt、message 分发（不破坏）
- ✅ OFFICE-001 v2 5 数据卡 + 三列 + composer
- ✅ OFFCIE-002 token 桥（数据视觉一致性）
- ✅ login 页 useSearchParams Suspense 兜底（需注意不能漏包）

### 7.4 不在 DoD
- 多会话侧边栏（M2）
- 任务上下文注入面板（M2）
- 反馈持久化接口（M2 任务域）

### 7.5 Sprint 收尾（rules/git-workflow §8）
1. commit + push
2. CI 远端跑过
3. sprint-office-1 交付表更新
