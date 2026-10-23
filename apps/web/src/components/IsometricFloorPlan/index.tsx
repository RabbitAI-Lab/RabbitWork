"use client";

/**
 * OFFICE-004 v2 · 等距办公室楼层（Pixi v8,Client Component）
 * ────────────────────────────────────────────────────────────
 * 效果准绳 pixoffice.online/office（用户点名,2026-10-23）：立体房间感（墙+窗）、
 * 成组办公家具（桌板+腿+显示器+转椅）、区域地毯、坐姿员工、会议室与休息角。
 * 20 工位网格数据绑定不变（floor-seat ↔ staff;props 兼容 PixiFloorPlan）。
 *
 * 等距坐标：tile (c,r) 中心 → sx=(c-r)*TW/2, sy=(c+r)*TH/2（TW=96 TH=48）;
 * 深度 painter's：按 (c+r) 升序、同排按 r 升序。
 */

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, type ColorSource } from "pixi.js";
import type { StaffDto } from "@rabbit/shared";
import { readThemeTokens } from "../PixiWorkstation/draw";

const FLOOR_COLS = 5;
const FLOOR_ROWS = 4;
const FLOOR_SEATS = FLOOR_COLS * FLOOR_ROWS;
/** 等距 tile 宽高（屏幕像素） */
const TW = 96;
const TH = 48;
/** 地板外扩圈（会议室/走道/休息角） */
const PAD = 2;
const GRID_COLS = FLOOR_COLS + PAD * 2;
const GRID_ROWS = FLOOR_ROWS + PAD * 2;
const WALL_H = 58;
const CANVAS_W = 980;
const CANVAS_H = 620;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.8;

export interface IsometricFloorPlanProps {
  floor: number;
  bySeat: Map<string, StaffDto>;
  dataTestId?: string;
  onSeatClick?: (seat: number, staff?: StaffDto) => void;
}

/* ───────── 等距几何原语 ───────── */

/** 网格 → 世界坐标（tile 中心） */
function iso(c: number, r: number): { x: number; y: number } {
  return { x: (c - r) * (TW / 2), y: (c + r) * (TH / 2) };
}

/** 中心 (cx,cy) 的菱形四顶点 */
function diamond(cx: number, cy: number, w: number, h: number): number[] {
  return [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy];
}

interface IsoTheme {
  accent: number;
  card: number;
  tileA: number;
  tileB: number;
  border: number;
  borderStrong: number;
  wallFace: number;
  wallTop: number;
  deskTop: number;
  deskSide: number;
  chair: number;
  chairBack: number;
  monitor: number;
  screen: number;
  carpet: number;
  carpetAlt: number;
  plant: number;
  plantDark: number;
  pot: number;
  skin: number;
  hair: number;
  sofa: number;
  sofaSide: number;
  rug: number;
  fgMuted: number;
  fgSubtle: number;
  windowSky: number;
}

function readTheme(): IsoTheme {
  const t = readThemeTokens();
  const root = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const dark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const hex = (v: string, fb: number) => {
    const raw = root?.getPropertyValue(v)?.trim();
    if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return Number.parseInt(raw.slice(1), 16);
    return fb;
  };
  // 暖木卡通风（对齐用户参照图:蜂蜜木地板/奶咖墙/厚木家具/翠绿点缀）
  return {
    accent: t.accent,
    card: hex("--rw-card", dark ? 0x111827 : 0xfffbf2),
    tileA: dark ? 0x5a4230 : 0xf0d5a8,
    tileB: dark ? 0x4f3a2a : 0xe6c48f,
    border: dark ? 0x2a2018 : 0xd9b57e,
    borderStrong: dark ? 0x3b2e22 : 0xc9a066,
    wallFace: dark ? 0x3d332a : 0xf5e9d4,
    wallTop: dark ? 0x4a3e31 : 0xe8d6b8,
    deskTop: dark ? 0xa87f4d : 0xf3c477,
    deskSide: dark ? 0x83603a : 0xd9a052,
    chair: dark ? 0x5e7d6c : 0x74b891,
    chairBack: dark ? 0x4a6556 : 0x5aa37c,
    monitor: 0x4a3b2e,
    screen: dark ? 0x8fe3c0 : 0xbef0da,
    carpet: dark ? 0x5c4a33 : 0xf7e3bd,
    carpetAlt: dark ? 0x514536 : 0xead2a4,
    plant: dark ? 0x3d8459 : 0x4caf6e,
    plantDark: dark ? 0x2f6846 : 0x3c8f57,
    pot: dark ? 0x8a5a3c : 0xc07845,
    skin: 0xffd9b3,
    hair: 0x4a3728,
    sofa: dark ? 0x4f8a68 : 0x6cbf8e,
    sofaSide: dark ? 0x3f7052 : 0x53a374,
    rug: dark ? 0x6b5b40 : 0xf2ddba,
    fgMuted: hex("--rw-fg-muted", 0x64748b),
    fgSubtle: hex("--rw-fg-subtle", 0x94a3b8),
    windowSky: dark ? 0x2a5a6e : 0xaee0f2,
  };
}

function fillPoly(g: Graphics, pts: number[], color: ColorSource, alpha = 1, stroke?: ColorSource) {
  g.poly(pts);
  g.fill({ color, alpha });
  if (stroke !== undefined) {
    g.poly(pts);
    g.stroke({ color: stroke, width: 1, alpha: 0.5 });
  }
}

/** 立方体（顶面菱形 w×d 抬升 z + 左右侧面;左面亮右面暗） */
function cube(
  g: Graphics,
  cx: number,
  cy: number,
  w: number,
  d: number,
  z: number,
  top: ColorSource,
  side: ColorSource,
  stroke?: ColorSource,
) {
  const h = d / 2;
  const ty = cy - z;
  fillPoly(g, [cx - w / 2, ty, cx, ty + h, cx, ty + h + z, cx - w / 2, ty + z], side, 1);
  fillPoly(g, [cx + w / 2, ty, cx, ty + h, cx, ty + h + z, cx + w / 2, ty + z], side, 0.78);
  fillPoly(g, diamond(cx, cy - z, w, d), top, 1, stroke);
}

/** 沿网格线立墙（有厚度条:内面+顶+外面） */
function wallSeg(
  g: Graphics,
  c0: number,
  r0: number,
  lenC: number,
  lenR: number,
  h: number,
  th: IsoTheme,
) {
  const a = iso(c0, r0);
  const b = iso(c0 + lenC, r0 + lenR);
  const a2 = iso(c0 + 0.45, r0 + 0.45);
  const b2 = iso(c0 + lenC + 0.45, r0 + lenR + 0.45);
  // 内立面
  fillPoly(g, [a.x, a.y, b.x, b.y, b.x, b.y - h, a.x, a.y - h], th.wallFace, 1, th.borderStrong);
  // 顶面
  fillPoly(g, [a.x, a.y, b.x, b.y, b2.x, b2.y, a2.x, a2.y], th.wallTop, 1, th.borderStrong);
  // 外立面（薄,更暗）
  fillPoly(g, [a2.x, a2.y, b2.x, b2.y, b2.x, b2.y - h, a2.x, a2.y - h], th.wallTop, 0.75);
}

/** 墙上窗户（蓝白格 + 窗棂） */
function windowPane(g: Graphics, c: number, r: number, th: IsoTheme, wUnits = 1.3) {
  const p = iso(c, r);
  const w = (TW / 2) * wUnits;
  const y0 = p.y - WALL_H + 10;
  const y1 = p.y - 12;
  fillPoly(
    g,
    [p.x - w, y0, p.x + w, y0, p.x + w, y1, p.x - w, y1],
    th.windowSky,
    0.95,
    th.borderStrong,
  );
  g.moveTo(p.x, y0);
  g.lineTo(p.x, y1);
  g.moveTo(p.x - w, (y0 + y1) / 2);
  g.lineTo(p.x + w, (y0 + y1) / 2);
  g.stroke({ color: th.borderStrong, width: 1, alpha: 0.85 });
}

/** 工位组：地垫+桌板+桌腿+显示器（发光屏）+转椅（occupied 时满透明度） */
function workstation(g: Graphics, cx: number, cy: number, th: IsoTheme, occupied: boolean) {
  const a = occupied ? 1 : 0.5;
  // 工位地垫
  fillPoly(g, diamond(cx, cy, TW * 0.92, TH * 0.92), th.carpet, occupied ? 0.9 : 0.3);
  // 桌板（厚立方 70×42×14）
  cube(g, cx, cy - 4, 70, 42, 14, th.deskTop, th.deskSide, th.border);
  // 桌腿
  cube(g, cx - 26, cy + 2, 8, 8, 12, th.deskSide, th.deskSide, th.border);
  cube(g, cx + 26, cy + 2, 8, 8, 12, th.deskSide, th.deskSide, th.border);
  // 显示器（薄板+屏+底座柱,置于桌右上）
  const mx = cx + 13;
  const my = cy - 17;
  const mz = 34;
  fillPoly(
    g,
    [mx - 17, my - mz, mx + 17, my - mz + 11, mx + 17, my - mz + 19, mx - 17, my - mz + 8],
    th.monitor,
    a,
  );
  fillPoly(
    g,
    [mx - 14, my - mz + 2, mx + 14, my - mz + 11, mx + 14, my - mz + 16, mx - 14, my - mz + 7],
    occupied ? th.screen : th.monitor,
    occupied ? 1 : 0.4,
  );
  cube(g, mx, my, 10, 6, 22, th.monitor, th.monitor, th.border);
  // 转椅（座垫立方 + 靠背薄板,桌左前）
  const chx = cx - 16;
  const chy = cy + 22;
  cube(g, chx, chy, 26, 18, 9, th.chair, th.chairBack, th.border);
  const bY = chy - 22;
  fillPoly(
    g,
    [chx - 13, bY, chx + 4, bY + 9, chx + 4, bY + 21, chx - 13, bY + 12],
    th.chairBack,
    a,
    th.border,
  );
  return { chx, chy };
}

/** 坐姿员工（Q 版大头:头身 2:1,肤色脸+发+衣服+呼吸点） */
function seatedPerson(g: Graphics, chx: number, chy: number, th: IsoTheme, online: boolean) {
  const a = online ? 1 : 0.6;
  const bodyY = chy + 6;
  // 身体（小,圆角,accent 绿衣服）
  g.roundRect(chx - 9, bodyY - 13, 18, 15, 6);
  g.fill({ color: th.accent, alpha: a * 0.92 });
  // 大头（肤色圆 + 头发弧 + 眼睛）
  g.circle(chx, bodyY - 22, 11);
  g.fill({ color: th.skin, alpha: a });
  g.circle(chx, bodyY - 26, 10.5);
  g.fill({ color: th.hair, alpha: a * 0.95 });
  // 眼睛（两点）
  g.circle(chx - 4, bodyY - 20, 1.4);
  g.fill({ color: 0x2d2a26, alpha: a });
  g.circle(chx + 4, bodyY - 20, 1.4);
  g.fill({ color: 0x2d2a26, alpha: a });
  // 腮红
  g.circle(chx - 7, bodyY - 16, 2);
  g.fill({ color: 0xff9d80, alpha: a * 0.5 });
  g.circle(chx + 7, bodyY - 16, 2);
  g.fill({ color: 0xff9d80, alpha: a * 0.5 });
  // 在线呼吸点
  if (online) {
    g.circle(chx + 15, bodyY - 31, 3.2);
    g.fill({ color: th.accent });
    g.circle(chx + 15, bodyY - 31, 6.5);
    g.fill({ color: th.accent, alpha: 0.22 });
  }
}

/** 会议室：大地毯+长桌+中央小绿植+围椅 */
function meetingRoom(g: Graphics, th: IsoTheme) {
  const c = iso(6, 1);
  fillPoly(g, diamond(c.x, c.y, TW * 2.5, TH * 2.5), th.carpetAlt, 0.85);
  cube(g, c.x, c.y, 130, 86, 16, th.deskTop, th.deskSide, th.border);
  cube(g, c.x - 44, c.y + 8, 10, 10, 14, th.deskSide, th.deskSide, th.border);
  cube(g, c.x + 44, c.y + 8, 10, 10, 14, th.deskSide, th.deskSide, th.border);
  cube(g, c.x, c.y - 10, 12, 9, 8, th.pot, th.pot, th.border);
  g.circle(c.x, c.y - 23, 6);
  g.fill({ color: th.plant, alpha: 0.95 });
  for (const d of [
    [-32, -36],
    [32, -36],
    [-32, 40],
    [32, 40],
  ] as const) {
    cube(g, c.x + d[0], c.y + d[1], 22, 16, 8, th.chair, th.chairBack, th.border);
  }
}

/** 休息角：暖色地毯 + L 型沙发 + 茶几 + 大绿植 */
function loungeCorner(g: Graphics, th: IsoTheme) {
  const c = iso(1, 6);
  fillPoly(g, diamond(c.x, c.y, TW * 2.2, TH * 2.2), th.rug, 0.9);
  // 沙发 L 两段
  cube(g, c.x - 24, c.y - 10, 64, 26, 15, th.sofa, th.sofaSide, th.border);
  cube(g, c.x + 28, c.y + 14, 26, 52, 15, th.sofa, th.sofaSide, th.border);
  // 沙发靠垫
  fillPoly(
    g,
    [c.x - 52, c.y - 32, c.x - 6, c.y - 32 + 10, c.x - 6, c.y - 32 + 24, c.x - 52, c.y - 32 + 14],
    th.sofaSide,
    1,
    th.border,
  );
  // 茶几
  cube(g, c.x - 4, c.y + 22, 34, 24, 11, th.deskTop, th.deskSide, th.border);
  // 大绿植
  cube(g, c.x + 44, c.y - 30, 18, 16, 16, th.pot, th.pot, th.border);
  g.circle(c.x + 44, c.y - 60, 15);
  g.fill({ color: th.plant, alpha: 0.95 });
  g.circle(c.x + 33, c.y - 48, 9);
  g.fill({ color: th.plantDark, alpha: 0.9 });
  g.circle(c.x + 55, c.y - 51, 10);
  g.fill({ color: th.plantDark, alpha: 0.85 });
  g.circle(c.x + 44, c.y - 72, 8);
  g.fill({ color: th.plant, alpha: 0.9 });
}

/** 地区文字牌 */
function areaTag(layer: Container, text: string, c: number, r: number, th: IsoTheme) {
  const label = new Text({
    text,
    style: { fontFamily: "PingFang SC, sans-serif", fontSize: 12, fill: th.fgSubtle },
  });
  label.anchor.set(0.5);
  const bg = new Graphics();
  const w = label.width + 16;
  const p = iso(c, r);
  bg.roundRect(p.x - w / 2, p.y - 11, w, 22, 5);
  bg.fill({ color: th.card, alpha: 0.95 });
  bg.stroke({ color: th.border, width: 1 });
  label.position.set(p.x, p.y);
  layer.addChild(bg);
  layer.addChild(label);
}

/* ───────── 组件 ───────── */

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
    let detach: (() => void) | null = null;

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
          `等距办公室楼层 ${floor}F：${FLOOR_SEATS} 工位、会议室与休息角`,
        );

        const world = new Container();
        const anchor = iso((GRID_COLS - 1) / 2, (GRID_ROWS - 1) / 2);
        world.x = CANVAS_W / 2 - anchor.x;
        world.y = 80;
        a.stage.addChild(world);
        a.stage.eventMode = "static";

        const bgLayer = new Container();
        const seatLayer = new Container();
        const tagLayer = new Container();
        world.addChild(bgLayer);
        world.addChild(seatLayer);
        world.addChild(tagLayer);

        const bg = new Graphics();
        bgLayer.addChild(bg);
        const seatViews = new Map<number, { holder: Container; g: Graphics; label: Text }>();

        const drawBg = () => {
          const th = readTheme();
          bg.clear();
          tagLayer.removeChildren();
          // 地板（棋盘微差瓷砖）
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              const p = iso(c, r);
              const color = (c + r) % 2 === 0 ? th.tileA : th.tileB;
              bg.poly(diamond(p.x, p.y, TW, TH));
              bg.fill({ color, alpha: 0.97 });
              bg.poly(diamond(p.x, p.y, TW, TH));
              bg.stroke({ color: th.border, width: 1, alpha: 0.38 });
            }
          }
          // 北墙（沿 row=0）+ 西墙（沿 col=0）
          wallSeg(bg, 0, 0, GRID_COLS - 0.1, 0, WALL_H, th);
          wallSeg(bg, 0, 0, 0, GRID_ROWS - 0.1, WALL_H, th);
          // 窗
          windowPane(bg, 2, 0, th);
          windowPane(bg, 5, 0, th);
          windowPane(bg, 0, 3, th, 0.85);
          // 会议室 + 休息角 + 房间牌
          meetingRoom(bg, th);
          loungeCorner(bg, th);
          areaTag(tagLayer, "会议室", 6, 2.5, th);
          areaTag(tagLayer, "开放工位区", 3, 4.4, th);
          areaTag(tagLayer, "休息角", 1, 7.4, th);
        };

        for (let r = 0; r < FLOOR_ROWS; r++) {
          for (let c = 0; c < FLOOR_COLS; c++) {
            const seatNum = r * FLOOR_COLS + c + 1;
            const holder = new Container();
            const g = new Graphics();
            const label = new Text({
              text: "",
              style: {
                fontFamily: "PingFang SC, sans-serif",
                fontSize: 11,
                fontWeight: "600",
                fill: 0x334155,
              },
            });
            label.anchor.set(0.5);
            holder.addChild(g);
            holder.addChild(label);
            const p = iso(c + PAD, r + PAD);
            holder.x = p.x;
            holder.y = p.y;
            holder.eventMode = "static";
            holder.cursor = "pointer";
            holder.hitArea = {
              contains: (x: number, y: number) =>
                Math.abs(x) < TW / 2 && y > -TH * 1.6 && y < TH * 1.6,
            } as never;
            holder.on("pointertap", () => {
              const now = Date.now();
              if (now - dispatchedRef.current < 80) return;
              dispatchedRef.current = now;
              onSeatClick?.(seatNum, bySeat.get(`${floor}-${seatNum}`));
            });
            seatLayer.addChild(holder);
            seatViews.set(seatNum, { holder, g, label });
          }
        }

        const drawSeats = () => {
          const th = readTheme();
          // painter 深度序
          const depth = (n: number) => {
            const r = Math.floor((n - 1) / FLOOR_COLS) + PAD;
            const c = ((n - 1) % FLOOR_COLS) + PAD;
            return (r + c) * 100 + r;
          };
          const ordered = [...seatViews.entries()].sort((a, b) => depth(a[0]) - depth(b[0]));
          for (const [, v] of ordered) seatLayer.addChild(v.holder);

          for (const [seatNum, v] of seatViews) {
            const staff = bySeat.get(`${floor}-${seatNum}`);
            const g = v.g;
            g.clear();
            const { chx, chy } = workstation(g, 0, 0, th, !!staff);
            if (staff) {
              seatedPerson(g, chx, chy, th, true);
              v.label.text = staff.name;
              v.label.style.fill = th.fgMuted;
              v.label.position.set(chx, chy + 42);
            } else {
              v.label.text = "";
            }
          }
        };

        drawBg();
        drawSeats();

        observer = new MutationObserver(() => {
          drawBg();
          drawSeats();
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        // 拖拽 + 缩放
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
        detach = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
      } catch (e) {
        console.error("[IsometricFloorPlan] init failed:", e);
      }
    };

    setup();
    return () => {
      destroyed = true;
      observer?.disconnect();
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
