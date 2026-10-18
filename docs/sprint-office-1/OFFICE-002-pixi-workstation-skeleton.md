# OFFCIE-002 引入 Pixi.js 渲染一个工位（最小骨架）

| 元信息项 | 内容 |
| -------- | ---- |
| 文档编号 | OFFICE-002 |
| 所属迭代 | sprint-office-1 |
| 优先级   | P1 |
| 所属模块 | office |
| 文档状态 | **Draft**（待 Approved；本规格由 AI 起草，需人工 review） |
| 最后更新日期 | 2026-10-18 |
| 上游依赖 | INFRA-001（脚手架）、OFFICE-001-v2（已 Implemented 的 office 页面框架 + Q 版工位 + 立体办公楼） |
| 下游消费 | OFFICE-003~006（Pixi.js 全面接管办公区渲染，由本规格沉淀的 integration pattern 沿用） |
| 上游依据 | 用户决策（2026-10-18）：「免费商用用 PixOffice」、「整层办公楼一起重画」（用户在 path 选择中选了「路径 B：装 PixOffice scene-office 4-6 周」） |
| 基线核对 | 参考仓库：[workbzw/pixoffice](https://github.com/workbzw/pixoffice)（仅 MIT 商用免费版本；本仓**不直接安装**其 `scene-office` 包，自写适配层以保持 monorepo 边界清晰） |
| 关联架构文档 | tech-stack.md、monorepo-structure.md、api-conventions.md、dependency-graph.md |
| **高保真确认** | 待确认（人工确认不可下放 AI）·原型路径：`docs/design/OFFICE-002-pixi-skeleton/`（待产出） |
| 工作量估算 | 后端 0 / 前端 4-6 人日（本次会话仅实现「最小骨架」切片，1-2 人日）+ 美术 0（M2 复用 Pixi `Graphics` API 矢量绘制，无需外部 sprite） |

## 1. 概述

### 1.1 功能定位
把 RabbitWork 办公室页面的「工位」渲染层**逐步迁出 CSS/SVG 拟立体**，改用 Pixi.js Canvas 渲染——为后续逐工位迁移、立体办公楼 2.5D 化、角色 sprite 集成铺路。本次只做**最小骨架**：依赖接入、React-Pixi 桥接器、一个工位的 Pixi 矢量绘制、暗亮主题颜色桥。其余 59 工位 + 多层办公楼 + 角色动画保留现有 CSS/JSX，仅作为对比基线。

### 1.2 范围边界表

| 能力 | 本规格（OFFICE-002 骨架） | 去向后置（OFFICE-003~006） |
| ---- | ----------------------- | ------------------------ |
| Pixi.js 接入 web、`react-pixi` 选择 | ✅（详见 §4.1） | — |
| Pixi ↔ React 桥接：生命周期 / cleanup / 主题响应 | ✅（最小可用骨架） | 完整体（OFFICE-005 主题双向桥） |
| 一个工位的 Pixi 矢量绘制（desk + chair + 顶部标签） | ✅ | 完善角色 sprite、待命/表情动画 |
| 60 工位全部迁 Pixi | ❌ | OFFICE-003 |
| 立体办公楼 1F/2F/3F 立体化 | ❌ | OFFICE-004 |
| 角色 sprite 接入（待机/工作中/表情） | ❌ | OFFICE-005 |
| Click-to-walk、3D 路径导航 | ❌（本期不实现，留入口） | OFFICE-006 |
| 立体办公楼楼面切换（键盘 ← → / 点 1F/2F/3F） | ❌ | OFFICE-004 |

### 1.3 前置依赖表
| 文档 | 阻塞原因 |
| ---- | -------- |
| INFRA-001 | TS strict、types/tailwind/pnpm 工程基线已落地 |
| OFFICE-001-v2 | 当前 office/page.tsx 已落地，作为对比基线（不在本规格中删除，仅新增 demo） |

### 1.4 能力表（每行一条可验收能力 · rules/testing §1.2）

| 编号 | 名称 | 交互类型 | 验收口径 |
| ---- | ---- | -------- | -------- |
| OFFCIE-002-01 | Pixi.js 包接入 + 编译通过 | 静态 | `pnpm typecheck` 0 错误；web app build 成功 |
| OFFCIE-002-02 | 一个工位在 office 页可见 | 渲染 | `data-testid="office-pixi-demo"` 元素存在 + 内部含 `<canvas>` |
| OFFCIE-002-03 | 该工位 canvas 在 1F 楼层平面右上方显眼 | 静态 | 视觉断言截图（亮/暗双主题） |
| OFFCIE-002-04 | 切换主题不抛错、不残留旧色 | 静态 | e2e：切 light/dark，no console error/pageerror |
| OFFCIE-002-05 | 与现有 Q 版工位共存不崩溃 | 静态 | 1F 工位网格 20 个保留渲染（Pixi demo 在外部右上角） |

### 1.5 基线核对
| 对标项 | PixOffice（workbzw/pixoffice）做法 | RabbitWork 本规格做法 | 备注 |
| ------ | --------------------- | --------------------- | ---- |
| 渲染引擎 | Pixi.js | Pixi.js | MIT 一致 |
| 角色动画 | PNG sprite（art/characters/） | Pixi `Graphics` 矢量绘制（无外部 sprite） | 资产 0 依赖；M2 再补 sprite |
| 工作区目录 | `packages/scene-office/` 独立 monorepo 包 | 暂放 `apps/web/src/components/PixiWorkstation/` | 不为骨架独立建包 |
| 主题适配 | 内部 color tokens + 业务自渲染 | 仅桥接 `--rw-card` / `--rw-fg` 等语义变量 | 留 OFFCIE-005 完整化 |
| demo 入口 | `examples/dashboard`（独立 host） | 嵌入到现有 `apps/web/src/app/office/page.tsx` 一角 | 共存路径 |

## 2. 业务逻辑

### 2.1 状态机 / 流程图

```
PixiWorkstation (React component)
  │
  ├── useRef<HTMLDivElement>  (挂载点)
  ├── useEffect  (初始化 Pixi Application)
  │     - new Application({...}) → 挂到 div
  │     - draw DeskGraphics / ChairGraphics / Label
  │     - 监听 theme change（DOM .dark class）→ 更新颜色
  │     - return cleanup → app.destroy()
  └── render: <div ref={...} data-testid="office-pixi-demo" />
```

### 2.2 规则明细
1. Pixi Application 仅在客户端初始化（Next.js SSR 不允许 canvas API）；用 `useEffect` 限定 client-only，避免 hydration mismatch。
2. 主题颜色来源于 `globals.css` 定义的 CSS 变量；Pixi 角色监听 `html.dark` class 切换读取对应 token。
3. 一个 React 组件只挂一个 Pixi Application；如未来需要多应用并行，分实例管理（OFFICE-003 阶段细化）。
4. canvas 内不允许触发任何副作用（在 React 控制外），所有交互通过 React 端回流（pixi 提供全局事件，由 React 端 `app.stage.eventMode = 'static'` 收事件）。

### 2.3 边界与异常
- 同源策略：Pixi 不联网；所有资源来自 in-memory 矢量绘制。
- 资源释放：`useEffect` cleanup 中 `app.destroy()`（Pixi v8 API）— 注意 `destroy({removeView: true})` 避免残留 DOM 节点。
- 设备像素比：自适应 `window.devicePixelRatio`（避免 DPI 改变时模糊）。resize 时同样需重设。

## 3. UI/UX 设计

> §3 的人机界面仅描述 demo 工位在 office 页中的位置 / 风格，与 pixi.js 渲染输出对齐。完整 60 工位迁移不在本规格。

页面挂载点：

```
┌─────────────────────────── office-page ───────────────────────────┐
│  [办公室 + 描述 + 刷新按钮]                                            │
│  [5 张 stat 卡]                                                        │
│  ┌────────┬──────────────────────────┬──────────┐                  │
│  │ 立体楼 │ 1F 楼层平面（20 Q 版工位）│ 当前任务流 │  ← 现有结构   │
│  └────────┴──────────────────────────┴──────────┘                  │
│                                                                  │
│  ┌──────────────────────────────────────┐                          │
│  │  [OFFCIE-002 · Pixi 演示工位]  ▷ 实验   │  ← 新 demo 卡片          │
│  │  ┌──────────────────────────────┐    │                          │
│  │  │     Pixi Canvas (Desk+Chair)   │    │                          │
│  │  └──────────────────────────────┘    │                          │
│  │  说明：M3 全面迁移；当前仅 1 个        │                          │
│  └──────────────────────────────────────┘                          │
└───────────────────────────────────────────────────────────────────┘
```

`OFFCIE-002` demo 卡的视觉：
- 卡片外框：现有 `.rw-card` 风格，accent 翠绿左边色条（prototype 风格）。
- canvas 内：256×192 显示区，desk + chair 矢量绘制（色随主题），`大钱` 占位标签。
- 暗色：背景 `--rw-card`，desk top `--rw-fg-muted`，chair `--rw-border-strong`。
- 亮色：背景 `--rw-card`，desk top `--rw-fg-muted`，chair `--rw-border`。

### 对话式用例走查
1. 用户进入 `/office` → 看见现有 1F 楼层平面 20 工位 + 一个高亮的 "Pixi demo" 卡片。
2. 切换亮/暗主题 → demo 卡 canvas 颜色随之切换（应用层订阅 `html.dark` MutationObserver）。
3. 离开页面 → demo 卡 canvas 被 `app.destroy({removeView: true})` 清理（无残留 DOM）。

## 4. 技术架构

### 4.1 依赖
| 决策 | 选择 | 理由 |
| ---- | ---- | ---- |
| 渲染引擎 | `pixi.js@^8.22.0` | MIT、零 peer dep、active maintained |
| React 集成 | 裸 Pixi.js + 自适配 React（不引 `react-pixi`） | 减少 60KB 桥接开销；骨架期自适配代码量可控；OFFICE-003 再评估 react-pixi |
| 颜色桥 | Pixi 端读 `getComputedStyle(document.documentElement).getPropertyValue('--rw-card')` + MutationObserver 监 `html.dark` | 无需依赖 React context 同步 |

### 4.2 数据模型
本规格不写表（OFFICE-003 起才动 schema）。现有 `StaffDto` / `DeskEntity` 等不动。

### 4.3 前端组件与状态
```
apps/web/src/components/PixiWorkstation/
  ├── index.tsx              // React 包装 + canvas mount + theme bridge
  ├── draw.ts                // 纯函数：用 Pixi Graphics 绘制 1 工位（desk+chair+label）
  └── README.md              // 用法说明
```

Props（极简）：
```ts
interface PixiWorkstationProps {
  name: string;       // 工位上的员工名（占位 "小钱"）
  size?: { w: number; h: number };  // 默认 256x192
  status?: 'IDLE' | 'WORKING';
}
```

### 4.4 worker / 后台（无）

### 4.5 权限点（无）

### 4.6 关键代码示意（伪）

```tsx
// PixiWorkstation/index.tsx (outlined)
"use client";
import { useEffect, useRef } from 'react';
import { Application, Graphics, Text } from 'pixi.js';

export function PixiWorkstation({ name }: PixiWorkstationProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let destroyed = false;
    app.init({
      width: 256,
      height: 192,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (destroyed) { app.destroy(true, { children: true }); return; }
      host.appendChild(app.canvas);
      const desk = new Graphics();
      // draw desk top, legs, chair, monitor outline, label
      drawWorkstation(desk, name, currentThemeTokens());
      app.stage.addChild(desk);
    });
    return () => {
      destroyed = true;
      app.destroy(true, { children: true, texture: true });
    };
  }, [name]);

  return <div ref={hostRef} data-testid="office-pixi-demo" />;
}
```

```ts
// draw.ts (outlined)
export function drawWorkstation(g: Graphics, name: string, tokens: ThemeTokens) {
  g.clear();
  // 桌面（圆角矩形）
  g.roundRect(40, 70, 176, 14, 4).fill({ color: tokens.deskTop });
  // 桌腿（两条短竖线）
  g.rect(58, 84, 4, 60).fill({ color: tokens.deskLeg });
  g.rect(194, 84, 4, 60).fill({ color: tokens.deskLeg });
  // 椅子背（梯形）
  // 显示器
  // 名牌（用 Pixi.Text）
}
```

### 4.7 错误处理与 a11y
- canvas 元素带 `role="img"` + `aria-label="Pixi 渲染演示工位（占位）"`，对屏幕阅读器可见但不可达。
- Pixi 初始化失败（`app.init` reject）→ catch → 输出一段 fallback HTML（含 desk SVG 静态版）+ console.error 上报。
- 主题变化：`MutationObserver` 监听 `document.documentElement.classList` 变化 + 再读 CSS 变量后重绘（OFFICE-003 时改为 Pixi tick 内每帧读，骨架期用 trigger 重绘）。

## 5. 测试用例

### 5.1 Vitest 单测（本规格最少 1 条）
| 编号 | 测点 | 用例摘要 |
| ---- | ---- | -------- |
| OFFCIE-002-VT-01 | Pixi 颜色桥函数 | 给定 mock `--rw-card=#112233` + `--rw-fg=#aabbcc`，`readThemeTokens()` 输出 `{ deskTop: 0x112233, fg: 0xaabbcc }` |

### 5.2 Playwright UI（必备 · rules/testing §3.1）
| 编号 | 用例 |
| ---- | ---- |
| OFFCIE-002-E2E-01 | 进入 `/office`：`data-testid="office-pixi-demo"` 可见；内含一个 `<canvas>` 元素；CSS / 渲染区域尺寸符合预期；无 console error / pageerror；不破坏现有 20 工位渲染 |
| OFFCIE-002-E2E-02 | 主题切换：dark→light、light→dark 各一次；canvas 仍可见且 `<canvas>` 非空；依旧无 console error |

### 5.3 JMeter 接口用例（本规格无新 API 接口 → 跳过）

### 5.4 关键状态二态（rules/testing §1.2）
| 二态 | 覆盖 / 豁免 |
| ---- | ---------- |
| 已就座 vs 空位 | 豁免：本规格不区分（demo 仅展示单工位；状态机由 OFFICE-003 引入）|
| 亮 vs 暗主题 | 覆盖：E2E-02 显式双向切换 |
| 加载完成 vs SSR 渲染 | 覆盖：组件 `useEffect` 内初始化，SSR 不会触发 canvas |

### 5.5 性能与安全
- 性能预算：canvas 启动 + 一次绘制 < 200ms（含 asset 读取）；DOM 不超过一个 `<canvas>`。
- 安全：Pixi 本身零外部依赖、无沙箱逃逸面。颜色取自 CSS 变量（`--rw-*`），不接用户输入字符串。

## 6. 基线深度对标（如有）

| 决策点 | PixOffice（参考）| RabbitWork 本规格 | 差异理由 |
| ------ | --------- | --------- | -------- |
| 渲染引擎 | Pixi.js | Pixi.js | 同源 |
| React 适配层 | 自写 `packages/scene-office` React-friendly adapter | `apps/web/src/components/PixiWorkstation/` | RabbitWork 已 Next.js monorepo，省一包 |
| 资产来源 | 多 PNG sprite | Pixi `Graphics` 矢量（无 sprite） | 美术外购/VLM 生图前先用 Graphics 占位，骨架期零美术依赖 |
| 主题适配 | 内部 `--pixoffice-*` tokens | 复用 `globals.css --rw-*` 现有 tokens | 不重新定义一套 |
| Demo 路径 | `examples/dashboard`（独立 SPA） | 嵌入 office 页面单卡片 | 单仓集成 |

## 7. 里程碑与验收

### 7.1 交付清单
| # | 交付物 | DoD |
| - | ------ | -- |
| 1 | `apps/web/package.json` 增 pixi.js@^8 | lockfile 同步；pnpm typecheck 0 错误 |
| 2 | `apps/web/src/components/PixiWorkstation/{index.tsx,draw.ts,README.md}` | 文件齐全；SPEC §3 视觉一致 |
| 3 | `apps/web/src/app/office/page.tsx` 在 1F 楼层平面下方插入 demo 卡 | 现有 20 工位渲染完整保留；新 demo 卡可见 |
| 4 | `apps/web/src/app/office/office.css` 增 `.rw-pixi-demo-card` 极简样式 | DS v2.1（rw-card + accent 翠绿边条） |
| 5 | Vitest 单测 `apps/web/src/components/PixiWorkstation/__tests__/readThemeTokens.test.ts` | 1 用例通过 |
| 6 | Playwright e2e `tests/e2e/OFFICE-002-pixi-skeleton.spec.ts` | 2 用例通过（UI/Console/接口三类断言齐全） |
| 7 | 高保真原型 `docs/design/OFFICE-002-pixi-skeleton/{prototype.html,README.md}` | 含亮暗双主题截图；人工走查 |

### 7.2 演示脚本（人工走查）
1. `pnpm install` → `pnpm dev`，浏览器打开 `http://localhost:3600/office`
2. 确认页面：原有 1F 楼层平面 20 工位（Q 版）+ 一个 Pixi demo 卡片在下方，canvas 渲染 desk + chair + "小钱"
3. 切主题（暗→亮 → 暗）→ demo 颜色随之变化，console 无 error / warning
4. 关闭浏览器 → 进程退；`pnpm test:e2e` 全绿

### 7.3 回归范围
- 已有 OFFICE-001-v2：5 数据卡 + 三列布局 + composer 全部不动。
- INFRA-001：lint / typecheck / build 全部不破。
- Pixi v8 与 React 19 的 SSR 兼容性已确认（Pixi v8 不再要求 `react`，纯 API）。

### 7.4 不在 DoD
- 60 工位迁移（OFFICE-003）
- 立体办公楼 2.5D 化（OFFICE-004）
- 角色 sprite / 表情动画（OFFICE-005）
- Pixi ↔ React 主题双向桥完整化（OFFICE-005）
- 路径点击 + 3D 导航（OFFICE-006）

### 7.5 Sprint 收尾动作
- 本规格文档状态：Draft → Approved（人工 review）/ Prototyped（原型走查）/ Implemented（PR 合并 + CI 远端绿）
- 不写规格文档直接编码 → AGENTS.md 门禁 2 阻塞（除非本次会话豁免，等用户决定）
