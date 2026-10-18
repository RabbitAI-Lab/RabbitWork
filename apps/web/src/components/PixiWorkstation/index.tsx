"use client";

/**
 * OFFCIE-002 · Pixi 演示工位 React 包装
 * ──────────────────────────────────────────
 * 最小骨架：把 Pixi v8 Application 挂到一个 div 内，画一个工位。
 * - 仅客户端（Next.js SSR 不允许 canvas API）
 * - cleanup 时 destroy 掉 Pixi Application，避免 HMR / 切页残留
 * - 主题变化（html.dark 切换）→ 重读 CSS 变量 + 重绘
 * - 后续 OFFCIE-005 会把"主题颜色桥"抽到 React context 里
 */

import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { drawWorkstation, readThemeTokens } from "./draw";

export type PixiWorkstationStatus = "IDLE" | "WORKING";

export interface PixiWorkstationProps {
  /** 名牌文字（占位 = '小钱'，与 office 页已就座员工同名；OFFICE-003 起改为 staffs.name） */
  name: string;
  /** 工位状态：待命 / 工作中（影响 monitor 内 accent 流光） */
  status?: PixiWorkstationStatus;
  /** canvas 尺寸（默认 256×192，与原型一致） */
  size?: { w: number; h: number };
  /** 主题 / 暗亮桥触发重绘的额外 token（骨架期未用） */
  dataTestId?: string;
}

export function PixiWorkstation({
  name,
  status = "WORKING",
  size = { w: 256, h: 192 },
  dataTestId = "office-pixi-demo",
}: PixiWorkstationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // 错误态：Pixi init 失败 → 用静态 SVG fallback（rules/observability §4 外部调用禁止静默吞错）
  const [errored, setErrored] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let app: Application | null = null;
    let stage: Container | null = null;
    let destroyed = false;
    let observer: MutationObserver | null = null;

    const setup = async () => {
      try {
        const a = new Application();
        await a.init({
          width: size.w,
          height: size.h,
          backgroundAlpha: 0, // 透明：让容器卡片背景透出
          antialias: true,
          resolution: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          autoDensity: true,
        });
        if (destroyed) {
          a.destroy(true, { children: true, texture: true });
          return;
        }
        app = a;
        stage = a.stage;
        host.appendChild(a.canvas);
        a.canvas.setAttribute("aria-label", "Pixi 渲染演示工位（占位）");
        a.canvas.setAttribute("role", "img");

        const tokens = readThemeTokens();
        const g = new Graphics();
        const label = drawWorkstation(g, tokens, name, status);
        stage.addChild(g);
        stage.addChild(label);

        // 主题桥：监听 html.dark class 切换，重绘 Graphics + Text
        observer = new MutationObserver(() => {
          if (destroyed || !app || !stage) return;
          const t2 = readThemeTokens();
          g.clear();
          // 重画时不再次新建 Text，直接更新文本色
          drawWorkstation(g, t2, name, status);
          label.style.fill = t2.labelFg;
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      } catch (e) {
        // Pixi init 不可静默吞错（rules/observability §4）
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[PixiWorkstation] init failed:", msg);
        setErrored(msg);
      }
    };

    setup();

    return () => {
      destroyed = true;
      observer?.disconnect();
      if (app) {
        try {
          app.destroy(true, { children: true, texture: true });
        } catch (e) {
          console.warn("[PixiWorkstation] destroy ignored:", e);
        }
      }
    };
  }, [name, status, size.h, size.w]);

  if (errored) {
    // Fallback：纯静态 SVG-desk。a11y / 视觉退化都不让位。
    return (
      <div data-testid={dataTestId} aria-label="Pixi 渲染失败，静态 SVG 兜底">
        <svg viewBox="0 0 256 192" width={size.w} height={size.h}>
          <rect x={36} y={78} width={184} height={12} fill="#94a3b8" />
          <rect x={48} y={90} width={4} height={60} fill="#cbd5e1" />
          <rect x={204} y={90} width={4} height={60} fill="#cbd5e1" />
          <text x={20} y={170} fontSize={11} fill="#94a3b8">
            Pixi 初始化失败：{errored}
          </text>
        </svg>
      </div>
    );
  }

  return <div ref={hostRef} data-testid={dataTestId} />;
}
