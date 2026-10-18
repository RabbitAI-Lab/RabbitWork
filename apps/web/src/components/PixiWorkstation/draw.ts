/**
 * OFFCIE-002 · Pixi 演示工位渲染（SVG / Vector 路径）
 * ─────────────────────────────────────────────────────────────
 * 用 Pixi v8 的 Graphics API 矢量化绘制一个工位（desk + chair + monitor
 * + nameplate），不依赖任何外部 sprite / atlas —— 满足骨架期「零美术
 * 资产、零授权依赖、零 CSP 改动」三条硬约束。完整 sprite 集成进入
 * OFFCIE-005 再做。
 *
 * 颜色全部从 globals.css 的 --rw-* 语义变量读取（DESIGN.md §2.1）；
 * 颜色桥更新由 React 端通过 MutationObserver 触发（详见 index.tsx）。
 */

import { Graphics, Text } from "pixi.js";

/** 从 CSS 变量抽取得到的当前主题颜色。hex string（如 '#94a3b8'）。 */
export interface ThemeTokens {
  /** desk 桌面（暖米 / 浅灰 都行） */
  deskTop: number;
  /** desk 桌腿 / 边框 */
  deskEdge: number;
  /** chair 椅子 */
  chair: number;
  /** chair 椅背 */
  chairBack: number;
  /** monitor 显示器外壳 */
  monitor: number;
  /** 名牌文字色 */
  labelFg: number;
  /** 状态徽章底色（accent 翠绿） */
  accent: number;
  /** 工位区域内底（透明 0 = 不画） */
  bgAlpha: number;
}

/** 默认中性灰色（无 DOM 时的兜底）。 */
const FALLBACK: Required<ThemeTokens> = {
  deskTop: 0x64748b,
  deskEdge: 0xcbd5e1,
  chair: 0xcbd5e1,
  chairBack: 0x94a3b8,
  monitor: 0x0f172a,
  labelFg: 0x0f172a,
  accent: 0x10b981,
  bgAlpha: 0,
};

/** 纯函数：从 var 映射得到 ThemeTokens（不入 DOM，便于单测）。 */
export function tokensFromVars(vars: Record<string, string>): ThemeTokens {
  const get = (name: string, key: keyof ThemeTokens): number => {
    const raw = vars[name]?.trim();
    if (!raw) return FALLBACK[key];
    const v = raw.startsWith("#") ? parseInt(raw.slice(1), 16) : NaN;
    return Number.isFinite(v) ? v : FALLBACK[key];
  };
  return {
    deskTop: get("--rw-fg-muted", "deskTop"),
    deskEdge: get("--rw-border-strong", "deskEdge"),
    chair: get("--rw-border-strong", "chair"),
    chairBack: get("--rw-fg-subtle", "chairBack"),
    monitor: get("--rw-fg", "monitor"),
    labelFg: get("--rw-fg", "labelFg"),
    accent: get("--rw-accent", "accent"),
    bgAlpha: 0,
  };
}

/** 在浏览器侧：读 document.documentElement 的 CSS 变量，SSR / 单元测试会拿不到 → 走 tokensFromVars({})。 */
export function readThemeTokens(): ThemeTokens {
  if (typeof document === "undefined" || !document.documentElement) {
    return tokensFromVars({});
  }
  const root = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {
    "--rw-fg-muted": root.getPropertyValue("--rw-fg-muted"),
    "--rw-border-strong": root.getPropertyValue("--rw-border-strong"),
    "--rw-fg-subtle": root.getPropertyValue("--rw-fg-subtle"),
    "--rw-fg": root.getPropertyValue("--rw-fg"),
    "--rw-accent": root.getPropertyValue("--rw-accent"),
  };
  return tokensFromVars(vars);
}

/** 在指定 `Graphics` 上画一个工位（desk + chair + monitor + label + accent dots）。 */
export function drawWorkstation(
  g: Graphics,
  tokens: ThemeTokens,
  name: string,
  status: "IDLE" | "WORKING",
): Text {
  g.clear();

  const W = 256;
  const H = 192;
  // 投影（圆形）
  g.ellipse(W / 2, H - 16, 64, 8).fill({ color: 0x000000, alpha: 0.08 });

  // desk 桌面（圆角矩形）
  g.roundRect(36, 78, 184, 12, 3).fill({ color: tokens.deskTop });
  g.roundRect(36, 78, 184, 12, 3).stroke({ color: tokens.deskEdge, width: 1 });

  // desk 桌腿（左 + 右）
  g.rect(48, 90, 4, 60).fill({ color: tokens.deskEdge });
  g.rect(204, 90, 4, 60).fill({ color: tokens.deskEdge });

  // chair 椅座 + 椅背（靠下，朝向桌面）
  g.roundRect(70, 130, 36, 8, 2).fill({ color: tokens.chair });
  g.rect(80, 110, 4, 26).fill({ color: tokens.chairBack });

  // monitor（外框 + 屏内 abstract 高亮）
  g.roundRect(150, 56, 50, 28, 2).fill({ color: tokens.monitor });
  // 屏内一条 accent 流光（用 graphic 绘一段）
  if (status === "WORKING") {
    g.roundRect(154, 60, 42, 20, 1).fill({ color: tokens.accent, alpha: 0.18 });
  }

  // monitor 支架
  g.rect(170, 84, 10, 6).fill({ color: tokens.monitor });
  // 底盘
  g.roundRect(160, 90, 30, 4, 1).fill({ color: tokens.monitor });

  // 名牌（Pixi Text，由使用方 addChild）
  const label = new Text({
    text: name,
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 12,
      fontWeight: "600",
      fill: tokens.labelFg,
    },
  });
  label.position.set(36, 154);
  // 名牌底
  g.roundRect(34, 152, 80, 18, 3).fill({ color: tokens.deskEdge, alpha: 0.4 });
  g.roundRect(34, 152, 80, 18, 3).stroke({ color: tokens.deskEdge, width: 0.5 });
  // 重绘文字在最上层
  label.x = 44;
  label.y = 156;

  return label;
}
