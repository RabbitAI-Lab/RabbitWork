# OFFCIE-002 · Pixi 演示工位（最小骨架）— 高保真原型

| 元信息项 | 内容 |
| -------- | ---- |
| 文档编号 | OFFCIE-002 |
| 原型版本 | v1（骨架） |
| 所属模块 | office |
| 关联参考 | [workbzw/pixoffice](https://github.com/workbzw/pixoffice)（仅参考视觉范式，未用其代码或资产） |
| 优先级 | P1 |
| 状态 | **Implemented（骨架切片）** |
| 高保真确认 | 「完成开发」决策（2026-10-18）授权进入编码；规格 Draft 见 [OFFICE-002-pixi-workstation-skeleton.md](../../sprint-office-1/OFFICE-002-pixi-workstation-skeleton.md)；后续人工 review 决定 Approved/Prototyped |
| 实现位置 | `apps/web/src/components/PixiWorkstation/` + `apps/web/src/app/office/page.tsx`（demo 卡片） |
| e2e 用例 | `tests/e2e/OFFICE-002-pixi-skeleton.spec.ts`（2 用例） |

## 1. 原型内容

直接在 `apps/web/src/app/office/page.tsx` 主页面上挂一个 demo 卡（不另出独立静态 HTML —— Pixi 是 canvas 静态 HTML 跑不动）。该 demo 即是原型本身：

- 翠绿左边色条 + `OFFICE-002 · Pixi 骨架` 标签（monospace 字体）+ 右上元信息 `演示 1 个工位（Pixi v8 · Graphics 矢量绘制，无 sprite 资产）`
- 256×192 canvas 容器，由 `PixiWorkstation` React 组件挂载，内部用 `pixi.js@^8.22.0` Graphics API 矢量化绘制：椭圆投影 / desk top / desk 腿 / chair 座 / chair 背 / monitor 外框 + accent 流光（WORKING 态）/ monitor 支架 / monitor 底盘 / nameplate
- 右侧 meta 块：员工名（font-display 22px）+ 工种 + 说明文字

## 2. 走查参考截图

| 主题 | 文件 |
| ---- | ---- |
| 暗色 + WORKING 状态 | `office-002-pixi-demo-dark.png`（1440×900） |

> 本地起服务走查：`pnpm dev` → `http://localhost:3600/office` 滚到底部即可看到 OFFCIE-002 demo 卡。

## 3. 走查要点

| 批 | 走查项 | 状态 | 笔记 |
| -- | ------ | ---- | ---- |
| ① | demo 卡可见 + canvas 在 (256×192) | ✅ | DOM 查询：`section=✓ canvas=✓ size=256x192` |
| ② | WORKING 态：monitor 屏内有 accent 流光 | ✅ | 颜色 = `--rw-accent` 解析值 |
| ③ | 暗色主题：desk top = fg-muted、chair = border-strong | ✅ | `tokensFromVars({})` 走 fallback 也正常 |
| ④ | 0 console error / 0 pageerror | ✅ | canvas 加载无 Pixi 警告 |
| ⑤ | cleanup：destroy app + remove observer | ✅ | `app.destroy(true, { children: true, texture: true })` |
| ⑥ | 单测覆盖：`tokensFromVars` 纯函数 + `readThemeTokens` fallback | ✅ | 7 用例全绿 |

## 4. 勘误登记

| 编号 | 内容 | 决议 |
| ---- | ---- | ---- |
| 勘误 1 | 不单独出 `prototype.html` 静态文件 —— Pixi 必须跑在真浏览器，截图即原型 | 接受 |
| 勘误 2 | Demo 名牌显示"小钱 / 前端开发" 硬编码（不接 staffs API）| 接受，OFFICE-003 切真实数据时改 |
| 勘误 3 | size 写死 256×192，OFFICE-003 起改为响应式（看父容器宽度）| 接受 |
| 勘误 4 | 颜色桥走「重绘」而非「双向同步」（OFFICE-005 升级）| 接受，骨架够用 |

## 5. 后续（去向后置）

- **OFFICE-003** — 60 工位全迁 Pixi（grid container + 1 个 worker 绘制 N 个座位）
- **OFFICE-004** — 立体办公楼（1F/2F/3F）等轴测化
- **OFFICE-005** — 角色 sprite 集成（待机 / 工作中 / 表情动画）+ 主题双向桥 + a11y focus ring 同步
- **OFFICE-006** — Click-to-walk（点击空位 → 角色走过去）+ OfficeSimulator 路径
- 每个后置切片都是独立 PR + SPEC + Walkthrough
