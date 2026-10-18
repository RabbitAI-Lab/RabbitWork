# PixiWorkstation · OFFCIE-002 演示工位

> OFFCIE-002 Pixi.js 接入骨架产物。详细规格见 `docs/sprint-office-1/OFFICE-002-pixi-workstation-skeleton.md`。

## 用法

```tsx
import { PixiWorkstation } from "@/components/PixiWorkstation";

<PixiWorkstation name="小钱" status="WORKING" size={{ w: 256, h: 192 }} />;
```

## 依赖

- `pixi.js@^8.22.0`（MIT，零 peer dep）

## 实现摘要

1. `useEffect` 内 `new Application() → app.init({...})`
2. 把 `app.canvas` 挂载到 host div
3. 用 Pixi `Graphics` 矢量化绘制 desk + chair + monitor + nameplate
4. `MutationObserver(document.documentElement, attributeFilter: ['class'])` 监听 `.dark` 切换 → 重读 `--rw-*` CSS 变量 → 重绘

## 已知局限（按 OFFCIE-002 scope 划线）

- 1 个 demo，无 60 工位 grid
- 无 sprite / atlas / 角色动画（OFFCIE-005）
- 无 立体办公楼 2.5D 化（OFFCIE-004）
- 主题桥是「重绘触发器」而非「双向同步」，OFFICE-005 再升级

## 测试

- 单测：`apps/web/src/components/PixiWorkstation/__tests__/draw.test.ts`（vitest，4 用例）
- e2e：`tests/e2e/OFFICE-002-pixi-skeleton.spec.ts`（playwright，2 用例）
