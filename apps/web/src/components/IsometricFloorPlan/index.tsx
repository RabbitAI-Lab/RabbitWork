"use client";

/**
 * OFFICE-004 v3 · PixOffice 风格办公室楼层（Pixi v8,Client Component）
 * ──────────────────────────────────────────────────────────────────
 * 画法移植自 github.com/workbzw/pixoffice（MIT,packages/scene-office）:
 * 俯视正交网格、圆角桌面+蓝色渐变屏+键盘鼠标、轮滑转椅、软阴影椭圆、
 * 占座绿点;y 轴 zIndex 深度（桌前沿分界,人坐桌后露头）。
 * 数据绑定不变（floor-seat ↔ staff;props 与旧版兼容,office 页零改动）。
 */

import { useEffect, useRef } from "react";
import { Application, Container, FillGradient, Graphics, Text } from "pixi.js";
import type { StaffDto } from "@rabbit/shared";

const FLOOR_COLS = 5;
const FLOOR_ROWS = 4;
const FLOOR_SEATS = FLOOR_COLS * FLOOR_ROWS;
const CANVAS_W = 980;
const CANVAS_H = 680;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.8;

/** PixOffice DeskEntity STYLE 同源调色（MIT 契约） */
const STYLE = {
  shadow: { color: 0x454543, alpha: 0.055 },
  deskTop: 0xfaf8f4,
  deskEdge: 0xe8e0d4,
  deskStroke: 0xd8d0c4,
  chairDark: 0x556b7d,
  chair: 0x7a8fa3,
  chairWheel: 0x3d4a56,
  monitor: 0x2e3238,
  screenTop: 0x7ec8ff,
  screenBottom: 0x4a8fd9,
  keyboard: 0xeeedea,
  keyboardStroke: 0xd0ccc4,
  mouse: 0xf5f4f1,
  occupied: 0x50b86c,
  floorTileA: 0xf7f4ee,
  floorTileB: 0xf2eee6,
  floorStroke: 0xe7e0d2,
  wall: 0xeadfce,
  wallEdge: 0xd9ccba,
  board: 0xffffff,
  boardFrame: 0xb9ab93,
  boardText: 0x343b36,
  window: 0xcfe8f7,
  plantPot: 0xc07845,
  plant: 0x4caf6e,
  plantDark: 0x3c8f57,
  skin: 0xffd9b3,
  hair: 0x4a3728,
  labelFg: 0x5b6472,
  hover: 0x10b981,
} as const;

const SEAT_Y = 45;
const DESK_OFFSET_Y = -8;
const SCALE = 1.5;

export interface IsometricFloorPlanProps {
  floor: number;
  bySeat: Map<string, StaffDto>;
  dataTestId?: string;
  onSeatClick?: (seat: number, staff?: StaffDto) => void;
}

/* ───────── PixOffice 画法移植（DeskEntity fallback 系列） ───────── */

/** 桌身（圆角桌面+显示器渐变屏+键盘鼠标）与桌前沿两段 */
function drawDesk(deskLayer: Container, frontLayer: Container): void {
  const g = new Graphics();
  g.roundRect(-46, -6, 92, 34, 10);
  g.fill(STYLE.deskTop);
  g.stroke({ color: STYLE.deskStroke, width: 1.5, alpha: 0.55 });
  g.roundRect(-22, -48, 44, 30, 6);
  g.fill(STYLE.monitor);
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: STYLE.screenTop },
      { offset: 1, color: STYLE.screenBottom },
    ],
    textureSpace: "local",
  });
  g.roundRect(-18, -44, 36, 22, 4);
  g.fill(grad);
  g.roundRect(-20, 0, 40, 8, 4);
  g.fill(STYLE.keyboard);
  g.stroke({ color: STYLE.keyboardStroke, width: 1, alpha: 0.5 });
  g.ellipse(18, 6, 5, 7);
  g.fill(STYLE.mouse);
  deskLayer.addChild(g);
  const front = new Graphics();
  front.roundRect(-44, 22, 88, 8, 4);
  front.fill(STYLE.deskEdge);
  frontLayer.addChild(front);
}

/** 轮滑转椅（靠背+座垫+五轮底座） */
function drawChair(layer: Container): void {
  const g = new Graphics();
  const baseY = 64;
  g.ellipse(0, baseY, 30, 11);
  g.fill(STYLE.chairDark);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.circle(Math.cos(a) * 24, baseY + Math.sin(a) * 6, 3.5);
    g.fill(STYLE.chairWheel);
  }
  g.roundRect(-24, 40, 48, 18, 14);
  g.fill(STYLE.chair);
  g.roundRect(-22, 30, 44, 14, 8);
  g.fill(STYLE.chair);
  g.position.set(0, SEAT_Y - 36);
  layer.addChild(g);
}

/** 桌后露头（发+脸+在线呼吸点,坐姿人主要被桌面遮挡——PixOffice 同语义） */
function drawHead(parent: Container): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 9);
  g.fill(STYLE.skin);
  g.circle(0, -3, 8.6);
  g.fill(STYLE.hair);
  g.circle(13, -8, 3);
  g.fill({ color: STYLE.occupied, alpha: 0.95 });
  g.circle(13, -8, 6);
  g.fill({ color: STYLE.occupied, alpha: 0.2 });
  parent.addChild(g);
  return g;
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
          `办公室楼层 ${floor}F：${FLOOR_SEATS} 工位（PixOffice 风格俯视）`,
        );

        const world = new Container();
        world.sortableChildren = true;
        a.stage.addChild(world);
        a.stage.eventMode = "static";

        /* ── 房间（地板/墙/白板/窗/绿植,zIndex 最低） ── */
        const drawRoom = () => {
          const old = world.getChildByName("room");
          if (old) old.destroy({ children: true });
          const room = new Container();
          room.name = "room";
          room.zIndex = 0;
          const g = new Graphics();
          const TILE = 44;
          const cols = Math.ceil((CANVAS_W - 40) / TILE);
          const rows = Math.ceil((CANVAS_H - 150) / TILE);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const color = (c + r) % 2 === 0 ? STYLE.floorTileA : STYLE.floorTileB;
              g.rect(20 + c * TILE, 130 + r * TILE, TILE, TILE);
              g.fill({ color, alpha: 0.95 });
              g.stroke({ color: STYLE.floorStroke, width: 1, alpha: 0.5 });
            }
          }
          g.roundRect(20, 46, CANVAS_W - 40, 84, 10);
          g.fill(STYLE.wall);
          g.rect(20, 122, CANVAS_W - 40, 8);
          g.fill(STYLE.wallEdge);
          g.roundRect(0, 46, 20, CANVAS_H - 60, 8);
          g.fill(STYLE.wall);
          g.roundRect(CANVAS_W / 2 - 170, 58, 340, 58, 6);
          g.fill(STYLE.board);
          g.stroke({ color: STYLE.boardFrame, width: 4 });
          for (const wx of [110, CANVAS_W - 110]) {
            g.roundRect(wx - 60, 56, 120, 46, 8);
            g.fill({ color: STYLE.window, alpha: 0.95 });
            g.stroke({ color: STYLE.boardFrame, width: 3 });
            g.moveTo(wx, 56);
            g.lineTo(wx, 102);
            g.moveTo(wx - 60, 79);
            g.lineTo(wx + 60, 79);
            g.stroke({ color: STYLE.boardFrame, width: 2, alpha: 0.7 });
          }
          for (const px of [58, CANVAS_W - 44]) {
            g.roundRect(px - 11, 150, 22, 20, 4);
            g.fill(STYLE.plantPot);
            g.circle(px, 142, 14);
            g.fill({ color: STYLE.plant, alpha: 0.95 });
            g.circle(px - 9, 150, 8);
            g.fill({ color: STYLE.plantDark, alpha: 0.9 });
            g.circle(px + 9, 148, 9);
            g.fill({ color: STYLE.plantDark, alpha: 0.85 });
          }
          room.addChild(g);
          const boardTitle = new Text({
            text: `项目推进 · ${floor}F`,
            style: {
              fontFamily: "PingFang SC, sans-serif",
              fontSize: 17,
              fontWeight: "700",
              fill: STYLE.boardText,
            },
          });
          boardTitle.anchor.set(0.5);
          boardTitle.position.set(CANVAS_W / 2, 88);
          room.addChild(boardTitle);
          world.addChild(room);
        };
        drawRoom();

        /* ── 工位（阴影/桌身/椅/前沿/占座点/露头/名牌 + hover） ── */
        const seatViews = new Map<
          number,
          { indicator: Graphics; head: Graphics; label: Text; hover: Graphics }
        >();
        const layout = (seatNum: number): { x: number; y: number } => {
          const row = Math.floor((seatNum - 1) / FLOOR_COLS);
          const col = (seatNum - 1) % FLOOR_COLS;
          return { x: 130 + col * 186, y: 235 + row * 88 };
        };

        for (let seatNum = 1; seatNum <= FLOOR_SEATS; seatNum++) {
          const p = layout(seatNum);
          const root = new Container();
          root.sortableChildren = true;
          root.position.set(p.x, p.y);
          root.eventMode = "static";
          root.cursor = "pointer";

          const shadowG = new Graphics();
          const deskLayer = new Container();
          const chairLayer = new Container();
          const frontLayer = new Container();
          const indicator = new Graphics();
          const hover = new Graphics();
          const headWrap = new Container();
          const head = drawHead(headWrap);

          shadowG.ellipse(0, SEAT_Y + 27, 25, 6);
          shadowG.fill(STYLE.shadow);
          drawDesk(deskLayer, frontLayer);
          drawChair(chairLayer);

          for (const part of [
            shadowG,
            deskLayer,
            chairLayer,
            frontLayer,
            indicator,
            hover,
            headWrap,
          ]) {
            part.position.set(0, DESK_OFFSET_Y);
            part.scale.set(SCALE);
            root.addChild(part);
          }
          headWrap.position.set(0, DESK_OFFSET_Y - 34 * 0 + -52);

          const label = new Text({
            text: "",
            style: {
              fontFamily: "PingFang SC, sans-serif",
              fontSize: 11,
              fontWeight: "600",
              fill: STYLE.labelFg,
            },
          });
          label.anchor.set(0.5);
          label.position.set(0, 92);
          root.addChild(label);

          shadowG.zIndex = p.y - 0.6;
          frontLayer.zIndex = p.y + 20;
          chairLayer.zIndex = p.y + 21;
          headWrap.zIndex = p.y + 21.5;
          deskLayer.zIndex = p.y + 22;
          indicator.zIndex = p.y + 23;
          label.zIndex = p.y + 24;
          hover.zIndex = p.y + 25;

          root.hitArea = {
            contains: (x: number, y: number) => Math.abs(x) < 82 && y > -86 && y < 82,
          } as never;

          root.on("pointertap", () => {
            const now = Date.now();
            if (now - dispatchedRef.current < 80) return;
            dispatchedRef.current = now;
            onSeatClick?.(seatNum, bySeat.get(`${floor}-${seatNum}`));
          });
          root.on("pointerenter", () => {
            const staff = bySeat.get(`${floor}-${seatNum}`);
            hover.clear();
            hover.roundRect(-80, -80, 160, 164, 12);
            hover.stroke({ color: STYLE.hover, width: 2, alpha: staff ? 0.7 : 0.35 });
          });
          root.on("pointerleave", () => hover.clear());

          world.addChild(root);
          seatViews.set(seatNum, { indicator, head, label, hover });
        }

        const drawSeats = () => {
          for (const [seatNum, v] of seatViews) {
            const staff = bySeat.get(`${floor}-${seatNum}`);
            v.indicator.clear();
            if (staff) {
              v.indicator.circle(0, SEAT_Y - 4, 5.5);
              v.indicator.fill({ color: STYLE.occupied, alpha: 0.85 });
              v.indicator.stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 });
            }
            v.head.visible = !!staff;
            v.label.text = staff?.name ?? "";
          }
        };
        drawSeats();

        observer = new MutationObserver(() => {
          drawRoom();
          drawSeats();
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        /* ── 拖拽 + 缩放 ── */
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
        console.error("[PixOfficeScene] init failed:", e);
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
          console.warn("[PixOfficeScene] destroy ignored:", e);
        }
      }
    };
  }, [floor, bySeat, onSeatClick]);

  return (
    <div ref={hostRef} data-testid={dataTestId} style={{ minHeight: CANVAS_H, width: "100%" }} />
  );
}
