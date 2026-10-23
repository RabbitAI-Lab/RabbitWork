"use client";

/**
 * OFFICE-004 · 等距（isometric 2.5D）楼层视图（Pixi v8,Client Component）
 * ─────────────────────────────────────────────────────────
 * 用户指定效果准绳：pixoffice.online/office（bundle 逆向——等距场景/房间/家具/小人+状态）。
 * 网格 (col,row) → 等距屏幕坐标 sx=(col-row)*T/2, sy=(col+row)*T/4;深度按 (col+row) 升序。
 * 家具两色立方（顶亮侧暗）;小人=头+身+名字牌+在线呼吸点;支持拖拽平移与滚轮缩放。
 */

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import type { StaffDto } from "@rabbit/shared";
import { readThemeTokens } from "../PixiWorkstation/draw";

const FLOOR_COLS = 5;
const FLOOR_ROWS = 4;
const FLOOR_SEATS_TOTAL = FLOOR_COLS * FLOOR_ROWS;
/** 等距 tile 宽（屏幕像素）;高 = W/2 */
const TILE_W = 96;
const TILE_H = TILE_W / 2;
const CANVAS_W = 720;
const CANVAS_H = 460;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;

export interface IsometricFloorPlanProps {
  floor: number;
  bySeat: Map<string, StaffDto>;
  dataTestId?: string;
  onSeatClick?: (seat: number, staff?: StaffDto) => void;
}

/** 网格坐标 → 等距屏幕坐标（tile 中心） */
function iso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

interface Theme {
  accent: number;
  card: number;
  border: number;
  borderStrong: number;
  fg: number;
  fgMuted: number;
  fgSubtle: number;
}

function readIsoTheme(): Theme {
  const t = readThemeTokens();
  const root = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const hex = (v: string, fallback: number) => {
    const raw = root?.getPropertyValue(v)?.trim();
    if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return Number.parseInt(raw.slice(1), 16);
    return fallback;
  };
  return {
    accent: t.accent,
    card: hex("--rw-card", 0xffffff),
    border: hex("--rw-border", 0xe4e8ee),
    borderStrong: hex("--rw-border-strong", 0xcbd5e1),
    fg: t.labelFg,
    fgMuted: t.labelFg,
    fgSubtle: hex("--rw-fg-subtle", 0x94a3b8),
  };
}

/** 画一块等距菱形瓷砖 */
function tile(g: Graphics, cx: number, cy: number, w: number, h: number, fill: number, alpha = 1) {
  g.poly([cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy]);
  g.fill({ color: fill, alpha });
}

/** 等距立方体（家具）:顶面菱形 + 左右两侧面 */
function cube(
  g: Graphics,
  cx: number,
  cy: number,
  w: number,
  d: number,
  z: number,
  top: number,
  side: number,
  border: number,
) {
  // 底面中心在 (cx, cy);顶面上移 z
  const h = d / 2;
  const ty = cy - z;
  // 左侧面（朝左下）
  g.poly([cx - w / 2, ty, cx, ty + h, cx, ty + h + z, cx - w / 2, ty + z]);
  g.fill({ color: side });
  // 右侧面（朝右下）
  g.poly([cx + w / 2, ty, cx, ty + h, cx, ty + h + z, cx + w / 2, ty + z]);
  g.fill({ color: side });
  // 顶面
  g.poly([cx, ty - h / 2, cx + w / 2, ty, cx, ty + h / 2, cx - w / 2, ty]);
  g.fill({ color: top });
  g.stroke({ color: border, width: 1, alpha: 0.6 });
}

/** Q 版员工小人:呼吸点 + 头 + 身 + 名字牌 */
function person(
  g: Graphics,
  cx: number,
  cy: number,
  name: string,
  th: Theme,
  online: boolean,
  label: Text,
) {
  const headR = 7;
  const bodyH = 12;
  const bodyW = 16;
  // 头
  g.circle(cx, cy - bodyH - headR, headR);
  g.fill({ color: th.accent, alpha: online ? 1 : 0.5 });
  // 身
  g.roundRect(cx - bodyW / 2, cy - bodyH, bodyW, bodyH, 5);
  g.fill({ color: th.accent, alpha: online ? 0.8 : 0.4 });
  // 呼吸点（在线）
  if (online) {
    g.circle(cx + headR - 1, cy - bodyH - headR * 2, 2.5);
    g.fill({ color: th.accent });
  }
  label.text = name;
  label.style.fill = th.fgMuted;
  label.position.set(cx, cy - bodyH - headR * 2 - 20);
}

export function IsometricFloorPlan({
  floor,
  bySeat,
  dataTestId = "office-iso-floor-plan",
  onSeatClick,
}: IsometricFloorPlanProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dispatchedRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let app: Application | null = null;
    let destroyed = false;
    let observer: MutationObserver | null = null;

    const setup = async () => {
      try {
        const a = new Application();
        await a.init({
          width: CANVAS_W,
          height: CANVAS_H,
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
          `OFFICE-004 等距楼层视图：${floor}F，${FLOOR_SEATS_TOTAL} 个工位`,
        );

        const world = new Container();
        world.x = CANVAS_W / 2;
        world.y = 40;
        a.stage.addChild(world);
        a.stage.eventMode = "static";

        const seatsLayer = new Container();
        const bgLayer = new Container();
        world.addChild(bgLayer);
        world.addChild(seatsLayer);

        // ── 背景：地板瓷砖 + 两面墙 + 房间标签（一次性绘制） ──
        const bg = new Graphics();
        bgLayer.addChild(bg);
        const labels: Text[] = [];

        function drawBg() {
          const th = readIsoTheme();
          bg.clear();
          // 地板瓷砖
          for (let r = 0; r < FLOOR_ROWS + 2; r++) {
            for (let c = 0; c < FLOOR_COLS + 2; c++) {
              const p = iso(c - 1, r - 1);
              tile(bg, p.x, p.y, TILE_W, TILE_H, th.card, 0.9);
              bg.poly([
                p.x,
                p.y - TILE_H / 2,
                p.x + TILE_W / 2,
                p.y,
                p.x,
                p.y + TILE_H / 2,
                p.x - TILE_W / 2,
                p.y,
              ]);
              bg.stroke({ color: th.border, width: 1, alpha: 0.5 });
            }
          }
          // 北墙（沿 col 方向的瓷砖边）与西墙（沿 row 方向）
          const n0 = iso(-1, -1);
          const n1 = iso(FLOOR_COLS + 1, -1);
          const s0 = iso(-1, FLOOR_ROWS + 1);
          const wallH = 46;
          // 西墙（col=-1 一侧,沿 row 增长）
          bg.poly([
            n0.x - TILE_W / 2,
            n0.y,
            n0.x,
            n0.y + TILE_H / 2,
            n0.x,
            n0.y + TILE_H / 2 + (FLOOR_ROWS + 2) * TILE_H,
            n0.x - TILE_W / 2,
            n0.y + (FLOOR_ROWS + 2) * TILE_H,
          ]);
          bg.fill({ color: th.card, alpha: 0.9 });
          bg.poly([
            n0.x - TILE_W / 2,
            n0.y,
            n0.x,
            n0.y + TILE_H / 2,
            n0.x,
            n0.y + TILE_H / 2 + (FLOOR_ROWS + 2) * TILE_H,
            n0.x - TILE_W / 2,
            n0.y + (FLOOR_ROWS + 2) * TILE_H,
          ]);
          bg.stroke({ color: th.borderStrong, width: 1.5 });
          // 北墙（row=-1 一侧,沿 col 增长）
          bg.poly([
            n0.x - TILE_W / 2,
            n0.y,
            n1.x + TILE_W / 2,
            n1.y,
            n1.x + TILE_W / 2,
            n1.y + wallH,
            n0.x - TILE_W / 2,
            n0.y + wallH,
          ]);
          bg.fill({ color: th.card, alpha: 0.9 });
          bg.poly([
            n0.x - TILE_W / 2,
            n0.y,
            n1.x + TILE_W / 2,
            n1.y,
            n1.x + TILE_W / 2,
            n1.y + wallH,
            n0.x - TILE_W / 2,
            n0.y + wallH,
          ]);
          bg.stroke({ color: th.borderStrong, width: 1.5 });
          void s0;
          void wallH;
          // 房间标签
          for (const l of labels) l.destroy();
          labels.length = 0;
          const mkLabel = (text: string, col: number, row: number) => {
            const t = new Text({
              text,
              style: { fontFamily: "PingFang SC, sans-serif", fontSize: 11, fill: th.fgSubtle },
            });
            t.anchor.set(0.5);
            const p = iso(col, row);
            t.position.set(p.x, p.y - 8);
            bgLayer.addChild(t);
            labels.push(t);
          };
          mkLabel("会议室", 4, 0);
          mkLabel("开放工位区", 2, 3);
          mkLabel("休息角", 4, 4);
          // 绿植（休息角）
          const plant = iso(4, 4);
          bg.circle(plant.x + 34, plant.y - 6, 8);
          bg.fill({ color: 0x3fa576, alpha: 0.85 });
          bg.circle(plant.x + 34, plant.y - 14, 5);
          bg.fill({ color: 0x3fa576, alpha: 0.7 });
        }
        drawBg();

        // ── 工位层:每工位 = 桌 + 椅 + 小人/空位（深度序重建） ──
        interface SeatView {
          holder: Container;
          gfx: Graphics;
          label: Text;
        }
        const seatViews = new Map<number, SeatView>();
        for (let row = 0; row < FLOOR_ROWS; row++) {
          for (let col = 0; col < FLOOR_COLS; col++) {
            const seatNum = row * FLOOR_COLS + col + 1;
            const holder = new Container();
            const gfx = new Graphics();
            const label = new Text({
              text: "",
              style: { fontFamily: "PingFang SC, sans-serif", fontSize: 11, fontWeight: "600" },
            });
            label.anchor.set(0.5);
            holder.addChild(gfx);
            holder.addChild(label);
            const p = iso(col, row);
            holder.x = p.x;
            holder.y = p.y;
            holder.eventMode = "static";
            holder.cursor = "pointer";
            holder.hitArea = {
              contains: (x: number, y: number) =>
                Math.abs(x) < TILE_W / 2 && y > -TILE_H && y < TILE_H * 1.6,
            } as never;
            holder.on("pointertap", () => {
              const now = Date.now();
              if (now - dispatchedRef.current < 80) return;
              dispatchedRef.current = now;
              onSeatClick?.(seatNum, bySeat.get(`${floor}-${seatNum}`));
            });
            seatsLayer.addChild(holder);
            seatViews.set(seatNum, { holder, gfx, label });
          }
        }

        function renderSeats() {
          const th = readIsoTheme();
          // 深度排序（painter's algorithm）：按 (col+row) 升序重挂
          const ordered = [...seatViews.entries()].sort((a, b) => {
            const da = Math.floor((a[0] - 1) / FLOOR_COLS) + ((a[0] - 1) % FLOOR_COLS);
            const db = Math.floor((b[0] - 1) / FLOOR_COLS) + ((b[0] - 1) % FLOOR_COLS);
            return da - db;
          });
          for (const [, v] of ordered) seatsLayer.addChild(v.holder);
          for (const [seatNum, v] of seatViews) {
            const staff = bySeat.get(`${floor}-${seatNum}`);
            const g = v.gfx;
            g.clear();
            const dw = TILE_W * 0.62;
            const dd = TILE_H * 0.62;
            // 桌（立方体:顶亮侧暗）
            const deskTop = staff ? 0xd6dbe4 : th.card;
            const deskSide = staff ? 0xb9c1cd : 0xd7dce4;
            cube(g, 0, 0, dw, dd, 16, deskTop, deskSide, th.border);
            if (staff) {
              // 椅（小方块在桌前）
              cube(g, 0, dd * 0.85, dw * 0.45, dd * 0.45, 9, 0xaeb7c4, 0x98a2b3, th.border);
              // 显示器（细高立方体）
              cube(g, -dw * 0.22, -2, dw * 0.28, dd * 0.2, 24, 0x2f3b4e, 0x24303f, th.border);
              // 小人（桌后）
              person(g, dw * 0.18, -dd * 0.3, staff.name, th, true, v.label);
            } else {
              // 空位:「+」提示
              g.moveTo(-6, 0);
              g.lineTo(6, 0);
              g.moveTo(0, -6);
              g.lineTo(0, 6);
              g.stroke({ color: th.border, width: 1.5 });
              v.label.text = "";
            }
          }
        }
        renderSeats();

        observer = new MutationObserver(() => {
          drawBg();
          renderSeats();
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        // ── 拖拽平移 + 滚轮缩放 ──
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        const onDown = (e: PointerEvent) => {
          if (e.button !== 0) return;
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          world.x += e.clientX - lastX;
          world.y += e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
        };
        const onUp = () => {
          dragging = false;
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const next = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, world.scale.x * (e.deltaY > 0 ? 0.92 : 1.08)),
          );
          world.scale.set(next);
        };
        a.canvas.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        a.canvas.addEventListener("wheel", onWheel, { passive: false });
        const detach = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        (a.stage as unknown as { __detach?: () => void }).__detach = detach;
      } catch (e) {
        console.error("[IsometricFloorPlan] init failed:", e);
      }
    };

    setup();
    return () => {
      destroyed = true;
      observer?.disconnect();
      const detach = (app?.stage as unknown as { __detach?: () => void } | undefined)?.__detach;
      detach?.();
      if (app) {
        try {
          app.destroy(true, { children: true, texture: true });
        } catch (e) {
          console.warn("[IsometricFloorPlan] destroy ignored:", e);
        }
      }
    };
  }, [floor, bySeat, onSeatClick]);

  return (
    <div ref={hostRef} data-testid={dataTestId} style={{ minHeight: CANVAS_H, width: "100%" }} />
  );
}
