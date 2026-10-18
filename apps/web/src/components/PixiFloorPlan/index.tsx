"use client";

/**
 * OFFCIE-003 · 一层楼 floor plan 的 Pixi 渲染器（Client Component）
 * ─────────────────────────────────────────────────────────
 * 单张 Pixi canvas 容纳整层 20 工位。楼切换/data 变化 → 重建 app。
 */

import { useEffect, useRef } from "react";
import { Application, Graphics, Text, Rectangle } from "pixi.js";
import type { StaffDto } from "@rabbit/shared";
import {
  FLOOR_COLS,
  FLOOR_ROWS,
  FLOOR_SEATS_TOTAL,
  SEAT_W,
  SEAT_H,
  computeFloorSize,
  seatCenter,
  paintSeatAt,
} from "./draw";
import { readThemeTokens } from "../PixiWorkstation/draw";

export interface PixiFloorPlanProps {
  floor: number;
  bySeat: Map<string, StaffDto>;
  dataTestId?: string;
  onSeatClick?: (seat: number, staff?: StaffDto) => void;
}

/** 单个工位的 Pixi 资源句柄。 */
interface SeatHandle {
  graphics: Graphics;
  label: Text;
}

export function PixiFloorPlan({
  floor,
  bySeat,
  dataTestId = "office-pixi-floor-plan",
  onSeatClick,
}: PixiFloorPlanProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // 防止 onSeatClick 触发的 React state 变更 → useEffect 重跑形成反馈
  const dispatchedRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let app: Application | null = null;
    const seatMap = new Map<number, SeatHandle>();
    let destroyed = false;
    let observer: MutationObserver | null = null;

    const setup = async () => {
      try {
        const a = new Application();
        const { w, h } = computeFloorSize();
        await a.init({
          width: w,
          height: h,
          backgroundAlpha: 0,
          antialias: true,
          resolution: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          autoDensity: true,
        });
        if (destroyed) {
          a.destroy(true, { children: true });
          return;
        }
        app = a;
        host.appendChild(a.canvas);
        a.canvas.setAttribute("role", "img");
        a.canvas.setAttribute(
          "aria-label",
          `OFFICE-003 Pixi 渲染的 ${floor}F 楼层平面，含 ${FLOOR_SEATS_TOTAL} 个工位`,
        );
        const stage = a.stage;
        stage.eventMode = "static";

        for (let row = 0; row < FLOOR_ROWS; row++) {
          for (let col = 0; col < FLOOR_COLS; col++) {
            const seatNum = row * FLOOR_COLS + col + 1;
            const g = new Graphics();
            const label = new Text({
              text: "",
              style: {
                fontFamily: "var(--font-display)",
                fontSize: 12,
                fontWeight: "600",
                fill: 0x0f172a,
              },
            });
            label.anchor.set(0.5, 0);
            stage.addChild(g);
            stage.addChild(label);
            const { x: cx, y: cy } = seatCenter(col, row);
            const hit = new Rectangle(cx - SEAT_W / 2, cy - SEAT_H * 0.4, SEAT_W, SEAT_H * 0.8);
            g.eventMode = "static";
            g.hitArea = hit;
            g.cursor = "pointer";
            g.on("pointertap", () => {
              const now = Date.now();
              if (now - dispatchedRef.current < 80) return;
              dispatchedRef.current = now;
              const staff = bySeat.get(`${floor}-${seatNum}`);
              onSeatClick?.(seatNum, staff);
            });
            seatMap.set(seatNum, { graphics: g, label });
          }
        }

        function render() {
          const tokens = readThemeTokens();
          for (let row = 0; row < FLOOR_ROWS; row++) {
            for (let col = 0; col < FLOOR_COLS; col++) {
              const seatNum = row * FLOOR_COLS + col + 1;
              const staff = bySeat.get(`${floor}-${seatNum}`);
              const seat = seatMap.get(seatNum);
              if (!seat) continue;
              const { x: cx, y: cy } = seatCenter(col, row);
              const label = paintSeatAt(
                seat.graphics,
                cx,
                cy,
                { occupied: !!staff, staff, hovered: false },
                tokens,
              );
              if (label) {
                seat.label.text = staff?.name ?? "";
                seat.label.style.fill = tokens.labelFg;
                seat.label.position.set(label.x, label.y);
              } else {
                seat.label.text = "";
                seat.label.position.set(-9999, -9999);
              }
            }
          }
        }
        render();

        observer = new MutationObserver(render);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      } catch (e) {
        console.error("[PixiFloorPlan] init failed:", e);
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
          console.warn("[PixiFloorPlan] destroy ignored:", e);
        }
      }
    };
  }, [floor, bySeat, onSeatClick]);

  return (
    <div
      ref={hostRef}
      data-testid={dataTestId}
      style={{ minHeight: computeFloorSize().h, width: "100%" }}
    />
  );
}
