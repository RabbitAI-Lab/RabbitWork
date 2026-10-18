# OFFCIE-003 一层 20 工位全迁 Pixi（floor plan）

| 元信息项 | 内容 |
| -------- | ---- |
| 文档编号 | OFFCIE-003 |
| 所属迭代 | sprint-office-1 |
| 优先级   | P0（用户决定「全部切立体办公室」后首要） |
| 所属模块 | office |
| 文档状态 | **Implemented**（Draft 已上线实现，由用户「帮我完成开发」决策推进） |
| 最后更新日期 | 2026-10-18 |
| 上游依赖 | OFFICE-002（Pixi 接入、token 桥、MutationObserver 主题响应） |
| 下游消费 | OFFICE-004（立体办公楼 iso 化）、OFFICE-005（sprite 资产 + 表情动画）、OFFICE-006（click-to-walk） |
| 实现位置 | `apps/web/src/components/PixiFloorPlan/` + `apps/web/src/app/office/page.tsx` |
| e2e 用例 | 暂未补（更多测试在 BACKLOG，下条 sprint） |
| 工作量估算 | 后端 0 / 前端 3 人日（本次会话 = 1 人日，已完成「绘制 + 主题响应 + 点击」最小集） |

## 1. 概述

### 1.1 功能定位
把 1F / 2F / 3F 全部 60 个工位的 CSS Q-version 渲染层（office.css 中 `.iso-floor-plate` + `.desk-furniture` + `.rw-seat` 等 1500 行）迁出，改为单张 Pixi canvas 容纳整层 20 工位。本规格**只覆盖一层 20 工位**（OFFCIE-003 slice = "一层"，3 层通过 floor state 切换复用同一组件）。

### 1.2 范围边界表

| 能力 | 本规格（OFFCIE-003 layer） | 去向后置（OFFCIE-004~006） |
| ---- | ------------------------ | ----------------------- |
| 60 工位全部迁 Pixi | ✅（一层一张 canvas；3 层切换复用） | — |
| 卡通人物基础形态（发型 + 五官 + 躯干 + 双臂） | ✅（Pixi Graphics 矢量） | 升级为 sprite + 表情动画 |
| 主题双模（亮 / 暗）响应 | ✅（CssVar + MutationObserver） | — |
| 工位点击 → 进入对话 / 打开 picker | ✅（canvas hitArea + pointertap） | — |
| 工位菜单（4 选项：发起对话 / 资料 / 换座 / 表情） | ❌ | OFFCIE-005 + 工作位置推出 popover |
| 立体办公楼 → iso 2.5D | ❌（当前还是 CSS iso-building） | OFFCIE-004 |
| 角色 sprite + 待命/工作中/表情动画 | ❌ | OFFCIE-005 |
| 点击空位 → 角色走过去（walk-to-assign） | ❌ | OFFCIE-006 |
| 工作流动画（emote 3.2s 弹出） | ❌ | OFFCIE-005 |

### 1.3 前置依赖表
| 文档 | 阻塞原因 |
| ---- | -------- |
| OFFICE-002 | 必须先用 Pixi 接入 + tokensFromVars + readThemeTokens 桥 |
| OFFICE-001-v2 | office/page.tsx 现存布局作为 canvas 容器 |

### 1.4 能力表（每行一条可验收能力 · rules/testing §1.2）

| 编号 | 名称 | 交互类型 | 验收口径 |
| ---- | ---- | -------- | -------- |
| OFFCIE-003-01 | 单层 20 工位 canvas 渲染 | 渲染 | `data-testid="office-pixi-floor-plan"` 存在 + 内部含 `<canvas>` 且长宽 658×462 |
| OFFCIE-003-02 | 每个工位包含 desk + chair + 投影 + 名称 | 渲染 | screenshot 显示 4×5 = 20 工位有 desk top + chair + nameplate |
| OFFCIE-003-03 | 占用工位含卡通人物（头发 + 头 + 身 + 双臂 + 腮红 + 眼睛） | 渲染 | screenshot 显示 4 个工作位的人物都有 head + body + arms |
| OFFCIE-003-04 | 主题切换 → canvas 颜色随之切换（无裸穿透） | 静态 | e2e：dark→light 切换后 canvas 内 desk/chair/人物颜色同步 |
| OFFCIE-003-05 | 楼层切换 → canvas 重建 + 数据重绘 | 交互 | 点 1F/2F/3F 按钮，canvas 立即画出对应 floor 的 bySeat |
| OFFCIE-003-06 | 点击占用工位 → enterDesk.mutate(staff.id) | 交互 | pointertap → onSeatClick(seat, staff) → enter chat（需登录） |
| OFFCIE-003-07 | 点击空工位 → 打开 picker（assign 模式） | 交互 | pointertap → onSeatClick(seat, undefined) → picker 开 |
| OFFCIE-003-08 | 与既有 stereo 办公楼 + 任务流 + composer 共存 | 静态 | office page 同时显示左侧 CSS iso-building + 中央 Pixi canvas + 右侧 CSS task + 底部 CSS composer |

### 1.5 基线核对
| 项 | PixOffice（参考） | RabbitWork 本规格 |
| - | --------- | --------- |
| 渲染引擎 | Pixi.js | Pixi.js |
| 1 楼 1 张 canvas | 1 楼 1 张 canvas（含图集） | ✅ |
| 人物实现 | sprite + Anime.js 表情 | Pixi Graphics 矢量（无 sprite） |
| 主题 | 内部色板 | 复用 `--rw-*` token（DS v2.1） |
| 点击交互 | Pixi + React 端回流 | Pixi pointertap + onSeatClick 回调 |

## 2. 业务逻辑

### 2.1 状态机
- `floor` state：当前楼层 1/2/3（user 点 iso-building 按钮切换）
- `staffs` query：useQuery({ queryKey: ["staffs"], queryFn: () => staffApi.list({ pageSize: 100 }) })
- `bySeat`：派生自 staffs.data.items，key = `${floor}-${seat}`
- canvas 内：每工位独立 seatMap[seatNum] = { graphics, label }
- 楼切换 / data 变化 / 主题切换：均通过 useEffect deps / MutationObserver 重建/重绘

### 2.2 流程图（点击工位）
```
Pixi canvas pointertap on seat(i, j)
  └─→ onSeatClick(seatNum, staff | undefined)
        ├─ staff → useMutation enterDesk.mutate(staff.id)
        │         └─ onSuccess → router.push(`/chat/${conversationId}`)
        └─ empty → setPicker({ staff: null }) — 打开空位分配 modal
```

### 2.3 规则明细
1. **资源释放**：cleanup useEffect 调 `app.destroy(true, { children: true, texture: true })`，移除 canvas + observer（rules/observability §4 外部调用禁止泄漏）
2. **键盘 / Esc / 点击空白关闭工位菜单**（OFFCIE-005 popup 时再启用）
3. **DPI 自适应**：`resolution: window.devicePixelRatio || 1` + `autoDensity: true`
4. **client-only**：Pixi `Application` 在 `useEffect` 内 new，避免 SSR 报错
5. **主题桥**：MutationObserver 监 `html.dark` 切换 → 调用 `render()` 重画（每工位重新 paintSeatAt）

### 2.4 边界与异常
- **API auth 失败（code 10001）**：staffs.data = undefined → all = [] → 全部 20 工位空位（dev preview：`?withMock=1` 注入 mock bySeat 验证视觉）
- **Pixi init 失败**：catch → console.error + 抛错到上界（rules/observability §4 禁止静默吞）
- **resize**：骨架期 canvas 不自适应，OFFICE-005 时按容器 resize 重建

## 3. UI/UX 设计

### 页面挂载位置

```
┌─────────────── Office Page ───────────────┐
│  [标题 + 描述 + 刷新]                          │
│  [5 张数据卡]                                  │
│  ┌────────┬─────────────────────┬─────────┐  │
│  │ 立体办公楼│ Pixi Floor Canvas    │ 当前任务流 │
│  │ [iso-building, 1F/2F/3F]   │   │ 实时动态 │
│  │ 待安排就座│ 1F 楼层平面           │        │  │
│  │           │ (5×4 = 20 工位)       │        │  │
│  └────────┴─────────────────────┴─────────┘  │
│                                              │
│  [chat composer]                                │
└──────────────────────────────────────────────┘
```

### 视觉规范（DS v2.1）
- canvas 背景：透明（`backgroundAlpha: 0`），卡片底色 `--rw-card` 透出
- 工位 desk top：`tokens.deskTop`（暗色 = `--rw-fg-muted` = #64748b；亮色 = #64748b）；主题响应随 vars
- 工位 chair：`tokens.chair` + `tokens.chairBack`
- 工位人物 hair：`pickHair(name)` → HAIR_TONE_HEX[hash] → 9 色发
- 工位人物 body：`pickTone(name)` → STAFF_TONE_HEX[hash] → 8 色衣
- 工位人物眼睛 active 态：`tokens.accent`（翠绿）
- 工位人物眼睛 离岗 态：闭眼横线（`#2c2620`）
- hovered 状态（OFFCIE-005 实现）：外描边 `tokens.accent` 2px，alpha 0.9

### 对话式用例走查
1. 进 `/office?withMock=1` → 看到 4 个 mock 员工座位（李研/陈书/赵审/刘市）+ 16 空位 + 立体办公楼 + 任务卡 + 实时动态 + composer
2. 点 2F → iso-building 上 2F 高亮 → canvas 重建，1F 的人物随 floor=2 重画（李研/陈书/...显示在 2F seat 1/6/11/16）
3. 切暗 ↔ 亮主题 → 所有 token 同步切换 → canvas 颜色更新（桌面、椅子、人物衣色等都跟随）
4. 点座位 → 路由到 `/chat/${id}`（OFFCIE-005 完整菜单版）

## 4. 技术架构

### 4.1 数据模型
- 无 schema 变更。读取 `StaffDto.deskFloor / deskSeat`（已存在）。
- 双层 map：`bySeat = Map<"${floor}-${seat}", StaffDto>`。

### 4.2 关键代码示意

```ts
// apps/web/src/components/PixiFloorPlan/draw.ts
export function paintSeatAt(
  g: Graphics, cx: number, cy: number,
  state: { occupied: boolean; staff?: StaffDto; hovered?: boolean },
  tokens: ThemeTokens,
): Text | null {
  if (!state.occupied) {
    g.roundRect(...).stroke({...});
    g.moveTo(...).lineTo(...); // +
    return null;
  }
  // body + head + hair + arms + eyes + blush
  // ...
  return nameplate;
}

// apps/web/src/components/PixiFloorPlan/index.tsx
useEffect(() => {
  const app = new Application();
  await app.init({ width: 658, height: 462, backgroundAlpha: 0, antialias: true, resolution: dpr, autoDensity: true });
  // 20 个工位循环：graphics + text + hitArea + pointertap
  function render() {
    for (row, col) {
      const seat = seatMap.get(seatNum);
      const label = paintSeatAt(seat.graphics, cx, cy, { occupied: !!staff, staff }, tokens);
      if (label) { seat.label.text = staff.name; ... }
    }
  }
  observer = new MutationObserver(render);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => { observer.disconnect(); app.destroy(true, { children: true, texture: true }); };
}, [floor, bySeat, onSeatClick]);
```

### 4.3 权限点（无新增）

### 4.4 worker / 后台（无）

### 4.5 关键 CSS（rules/design-system.md §2 色/圆角/间距要求）
- `.rw-pixi-floor-wrap`：flex 0 0 auto（不被父 flex 压扁）；padding 8px 0；overflow auto
- canvas：width 100%, max-width 720px, height auto（保持宽高比）

## 5. 测试用例

### 5.1 Vitest 单测
| 编号 | 文件 | 摘要 |
| ---- | ---- | -------- |
| OFFCIE-003-VT-01 | `PixiFloorPlan/__tests__/draw.test.ts` | computeFloorSize 尺寸正确；seatCenter 坐标正确；同行邻距 = SEAT_W + COL_GAP（4 用例全绿） |

### 5.2 Playwright UI（BACKLOG · 本次未补）
> 下条 sprint 补：进入 `/office`，断言 canvas 存在 + 4 人物渲染 + 楼层切换 + 主题响应 + 点击 → chat route（需要 mock auth 路径）

### 5.3 JMeter 接口用例（无新 API → 跳过）

### 5.4 关键状态二态（rules/testing §1.2）
| 二态 | 覆盖 / 豁免 |
| ---- | ---------- |
| 已就座 vs 空位 | ✅ paintSeatAt 内部 if 分支（单元测试覆盖） |
| 亮 vs 暗主题 | ✅ MutationObserver 自动重绘（手动截图双模已确认） |
| 加载完成 vs SSR | ✅ useEffect 内初始化避免 SSR 报 canvas 错 |
| 有权 (登录) vs 无权 (auth=10001) | ⚠️ 豁免：mock bridge 桥接（dev-only） |

## 6. 基线深度对标

| 决策点 | PixOffice（参考）| RabbitWork 本规格 | 差异理由 |
| ------ | --------- | --------- | -------- |
| 渲染引擎 | Pixi.js | Pixi.js | 同源 |
| 1 楼 1 canvas | 是 | 是 | 一致 |
| 动画 | sprite + Anime.js | Pixi Graphics 静态 | 骨架期零 sprite；OFFICE-005 升级 |
| 主题 | 内部色板 | 复用 DS v2.1 `--rw-*` | 不重新定义一套 |
| 鼠标 hover | Pixi 事件 | Pixi 静态 hint（OFFICE-005 升级为真 hover 描边） | 骨架优先 |

## 7. 里程碑与验收

### 7.1 交付清单
| # | 交付物 | DoD |
| - | ------ | -- |
| 1 | `apps/web/src/components/PixiFloorPlan/{index.tsx, draw.ts, __tests__/draw.test.ts, README.md}` | 文件齐全；OFFCIE-002 token 桥复用；CLICK pointertap 正常 |
| 2 | `apps/web/src/app/office/page.tsx`：移除 SeatTile 渲染、改接 PixiFloorPlan | 原有 CSS iso-floor-plate 不再渲染；data-testid=office-pixi-floor-wrap 替换 |
| 3 | `apps/web/src/app/office/office.css`：`.rw-pixi-floor-wrap` + 调整 floor-plan-card 不再 overflow-y: auto | 花键被允许画到自然高度；4 行座位全显示 |
| 4 | dev-only `?withMock=1` 桥：auth 卡死时可注入 mock bySeat | dev preview 模式 |
| 5 | 单测 vitest 4 用例全绿 | 已实测 |

### 7.2 演示脚本（人工走查）
1. `pnpm install` → `pnpm dev`，浏览器打开 `http://localhost:3600/office`
2. 看现有 20 工位 Q 版显示 → 与 OFFCIE-003 对比
3. 加 `?withMock=1` → 重启浏览器到 `http://localhost:3600/office?withMock=1`
4. 看 4 卡通人物 + 16 空位 + iso-building + 任务流 + composer + 亮暗主题响应
5. 点 1F/2F/3F → canvas 重建
6. 切主题按钮 → 颜色同步

### 7.3 回归范围
- ✅ INFRA-001 脚手架（lint / typecheck / build）
- ✅ OFFICE-001-v2 顶部 5 卡 + 三列布局 + composer 全部不动
- ⚠️ auth 阻断 staffs API 时，1F 楼层平面渲染空位（mock bridge 补）—— auth 修通后零行为变更

### 7.4 不在 DoD
- 立体办公楼 iso 化（OFFCIE-004）
- 角色 sprite / 表情动画（OFFCIE-005）
- 空位点击 → 角色走过去（OFFCIE-006）
- e2e Playwright 用例（BACKLOG）

### 7.5 Sprint 收尾（按 rules/git-workflow.md §8）
1. commit OFFCIE-003 changes（PixiFloorPlan 组件 + page.tsx + office.css + spec / mock bridge）
2. push → 远端 CI 跑过才能收尾
3. 更新 sprint-office-1 交付表
