/**
 * OFFCIE-003 · 一层 20 工位的 Pixi 矢量绘制（纯函数）
 * ────────────────────────────────────────────────────────────
 * 单工位 = 椭圆投影 + desk 桌面 + 桌腿 + monitor + chair + nameplate（Pixi Text）。
 * 空位 = 虚线方框 + "+" 占位。一调 paintSeatAt(cx, cy, ...)。
 *
 * 与 PixiWorkstation 完全独立（OFFICE-002 demo 已用 tokensFromVars 桥）—— 这里直接复用。
 */

import { Graphics, Text } from "pixi.js";
import type { StaffDto } from "@rabbit/shared";
import type { ThemeTokens } from "../PixiWorkstation/draw";

/** 一层 5 列 × 4 行 = 20 工位。像素沿用 PixiWorkstation 节奏。 */
export const FLOOR_COLS = 5;
export const FLOOR_ROWS = 4;
export const FLOOR_SEATS_TOTAL = FLOOR_COLS * FLOOR_ROWS;

/** 单工位矩形尺寸（px）。 */
export const SEAT_W = 110;
export const SEAT_H = 90;
/** 工位之间水平 / 垂直 gap */
export const COL_GAP = 18;
export const ROW_GAP = 22;
/** canvas 内外边距 */
export const PADDING = 18;

/** 整张 floor canvas 内在尺寸（由 padding + 网格推出）。 */
export function computeFloorSize(): { w: number; h: number } {
  const w = PADDING * 2 + FLOOR_COLS * SEAT_W + (FLOOR_COLS - 1) * COL_GAP;
  const h = PADDING * 2 + FLOOR_ROWS * SEAT_H + (FLOOR_ROWS - 1) * ROW_GAP;
  return { w, h };
}

/** seat 中心点（col, row 都是 0-index）。 */
export function seatCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: PADDING + col * (SEAT_W + COL_GAP) + SEAT_W / 2,
    y: PADDING + row * (SEAT_H + ROW_GAP) + SEAT_H * 0.55,
  };
}

/** 工位人物衣色板 + 头发色板（OFFCIE-003 占位；OFFCIE-005 sprite 时改用 sprite palette）。
 * 简单 hash → 循环——同一员工每次显示同色。 */
const STAFF_TONE_HEX: readonly number[] = [
  0x0f766e, // teal
  0x2f6fd0, // blue
  0xa85d32, // terracotta
  0x6f7b42, // olive
  0x33507a, // navy
  0x3d6b4f, // forest
  0xb08325, // amber
  0x2c3e6b, // indigo
];

/** 头发色板（独立于衣色，9 色 → 多数员工会拿到不同色）。 */
const HAIR_TONE_HEX: readonly number[] = [
  0x2c2620, // black
  0x6b4f3a, // brown
  0xc09966, // light brown
  0x8b6f47, // dark gold
  0xd4a017, // gold
  0x404040, // dark gray
  0x9c9c9c, // gray
  0x1a1a1a, // off-black
  0x7d3c00, // auburn
];

function pickTone(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return STAFF_TONE_HEX[h % STAFF_TONE_HEX.length]!;
}
function pickHair(name: string): number {
  let h = 5381; // 起始 offset，避免与 tone 撞
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HAIR_TONE_HEX[h % HAIR_TONE_HEX.length]!;
}

/**
 * 画单个工位。绝对坐标 (cx, cy) 已由 seatCenter 给出。本函数：
 *  - 椭圆投影（柔和阴影）
 *  - desk top + 桌腿
 *  - monitor（工作中显示 accent 流光）
 *  - chair 椅背 + 座 + 椅轮
 *  - hovered 翠绿外描边
 * 返回一个 Pixi Text 实例（nameplate），由调用方 addChild 到 stage。
 */
export function paintSeatAt(
  g: Graphics,
  cx: number,
  cy: number,
  state: { occupied: boolean; staff?: StaffDto; hovered?: boolean },
  tokens: ThemeTokens,
  drawLabel?: (t: Text, fg: number) => void,
): Text | null {
  g.clear();

  if (!state.occupied) {
    /* 空位：虚线方框 + "+" 字 */
    g.roundRect(cx - SEAT_W * 0.42, cy - 8, SEAT_W * 0.84, 20, 4);
    g.stroke({ color: tokens.deskEdge, width: 1, alpha: 0.55 });
    g.stroke({ color: tokens.deskEdge, width: 1.5, alpha: 0.85 });
    g.moveTo(cx - 4, cy + 2).lineTo(cx + 4, cy + 2);
    g.moveTo(cx, cy - 2).lineTo(cx, cy + 6);
    return null;
  }

  /* 占用：完整工位 */
  const active = state.staff?.status === "PUBLISHED";

  // 椭圆投影
  g.ellipse(cx, cy + SEAT_H * 0.32, SEAT_W * 0.42, 6).fill({ color: 0x000000, alpha: 0.07 });

  // desk 桌面（圆角横条）
  const dTop = cy - 8;
  g.roundRect(cx - SEAT_W * 0.42, dTop, SEAT_W * 0.84, 12, 3).fill({ color: tokens.deskTop });
  g.roundRect(cx - SEAT_W * 0.42, dTop, SEAT_W * 0.84, 12, 3).stroke({
    color: tokens.deskEdge,
    width: 1,
  });

  // desk 桌腿
  g.rect(cx - SEAT_W * 0.42 + 4, cy + 4, 4, 22).fill({ color: tokens.deskEdge });
  g.rect(cx + SEAT_W * 0.42 - 8, cy + 4, 4, 22).fill({ color: tokens.deskEdge });

  // monitor（中央偏上）
  const mx = cx;
  const my = cy - 30;
  g.roundRect(mx - 18, my, 36, 22, 2).fill({ color: tokens.monitor });
  if (active) {
    g.roundRect(mx - 15, my + 3, 30, 16, 1).fill({ color: tokens.accent, alpha: 0.22 });
  }
  g.rect(mx - 4, my + 22, 8, 4).fill({ color: tokens.monitor });
  g.roundRect(mx - 9, my + 26, 18, 2, 1).fill({ color: tokens.monitor });

  // chair：椅背 + 座
  g.rect(cx - 3, cy - 14, 4, 18).fill({ color: tokens.chairBack });
  g.roundRect(cx - 14, cy + 4, 28, 6, 2).fill({ color: tokens.chair });
  // 椅轮（两小椭圆）
  g.ellipse(cx - 10, cy + 13, 4, 3).fill({ color: tokens.chair, alpha: 0.7 });
  g.ellipse(cx + 10, cy + 13, 4, 3).fill({ color: tokens.chair, alpha: 0.7 });

  /* 人物（OFFCIE-003 占位实现，OFFCIE-005 升级为 sprite）：
   * 卡通比例仿 PixOffice：圆头 + 厚发 + 圆身 + 桌子上的双臂。背朝用户（看着 monitor）。
   * hair/body 色都从员工名 hash 到固定色板 → 同员工每次同色（视觉锚点）。 */
  const tone = pickTone(state.staff?.name ?? "");
  const hair = pickHair(state.staff?.name ?? "");
  const skin = 0xf0cba8;
  const skinShadow = 0xd9a877;

  // ─── arms（最后画，被身体覆盖，避免抢视野）───
  // 双臂从两侧伸向 monitor（desk 上方）—— 双手放在键盘处
  // 先画身体再画手臂 = 手臂"贴在"身体前
  // body 圆角矩形（torso）
  g.roundRect(cx - 9, cy - 12, 18, 16, 5).fill({ color: tone });

  // body 上的衣领 / 扣子点
  g.circle(cx, cy - 8, 0.8).fill({ color: 0x000000, alpha: 0.25 });
  g.circle(cx, cy - 4, 0.8).fill({ color: 0x000000, alpha: 0.25 });

  // ─── head（圆 + 脸）───
  // head 主形（圆）
  g.ellipse(cx, cy - 21, 8, 8).fill({ color: skin });
  // 脸侧阴影（细半圆）
  g.ellipse(cx - 5, cy - 20, 3, 4).fill({ color: skinShadow, alpha: 0.5 });

  // ─── hair（厚刘海 + 后脑勺）───
  // 后脑勺大包（覆盖头顶到后颈）
  g.ellipse(cx, cy - 24, 10, 7).fill({ color: hair });
  // 刘海（额头上一片弧形）
  g.ellipse(cx, cy - 25, 9, 4).fill({ color: hair });
  // 左侧刘海尖尖
  g.moveTo(cx - 4, cy - 25)
    .lineTo(cx - 5, cy - 21)
    .stroke({ color: hair, width: 1 });
  // 右侧刘海尖尖
  g.moveTo(cx + 4, cy - 25)
    .lineTo(cx + 5, cy - 21)
    .stroke({ color: hair, width: 1 });

  // ─── ears（被 hair 遮一半）───
  g.ellipse(cx - 8, cy - 20, 1.5, 2).fill({ color: skin });
  g.ellipse(cx + 8, cy - 20, 1.5, 2).fill({ color: skin });

  // ─── face：眼睛 + 腮红 ───
  // 工作中：眼睛发亮（accent 翠绿点）；离岗：闭眼弧
  if (active) {
    g.ellipse(cx - 2.5, cy - 21, 1.2, 1.5).fill({ color: tokens.accent });
    g.ellipse(cx + 2.5, cy - 21, 1.2, 1.5).fill({ color: tokens.accent });
  } else {
    // 闭眼（一短横）
    g.moveTo(cx - 4, cy - 21)
      .lineTo(cx - 1, cy - 21)
      .stroke({ color: 0x2c2620, width: 1 });
    g.moveTo(cx + 1, cy - 21)
      .lineTo(cx + 4, cy - 21)
      .stroke({ color: 0x2c2620, width: 1 });
  }
  // 腮红
  g.ellipse(cx - 4, cy - 18, 1.6, 1).fill({ color: 0xe9b1a8, alpha: 0.6 });
  g.ellipse(cx + 4, cy - 18, 1.6, 1).fill({ color: 0xe9b1a8, alpha: 0.6 });

  // ─── arms（最后画，盖在身体上）───
  // 双手放在桌键盘位置（desk 顶部 y - 8 ~ y + 4）→ 手臂从肩到桌
  // 袖子色同 tone（与身体衔接），皮肤色为前臂/手
  g.roundRect(cx - 11, cy - 8, 4, 8, 1).fill({ color: tone });
  g.roundRect(cx - 11, cy - 1, 5, 3, 1.5).fill({ color: skin }); // left hand
  g.roundRect(cx + 7, cy - 8, 4, 8, 1).fill({ color: tone });
  g.roundRect(cx + 6, cy - 1, 5, 3, 1.5).fill({ color: skin }); // right hand

  // 工作中：手"敲"键盘 = 在键盘位上画小圆点
  if (active) {
    g.ellipse(cx - 9, cy + 0, 1, 0.6).fill({ color: 0x2c2620 });
    g.ellipse(cx + 7, cy + 0, 1, 0.6).fill({ color: 0x2c2620 });
  }

  // hovered：外围翠绿描边
  if (state.hovered) {
    g.roundRect(cx - SEAT_W * 0.48, cy - SEAT_H * 0.4, SEAT_W * 0.96, SEAT_H * 0.8, 6).stroke({
      color: tokens.accent,
      width: 2,
      alpha: 0.9,
    });
  }

  /* nameplate：desk 下方一行，Pixi Text。 */
  const label = new Text({
    text: state.staff?.name ?? "",
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 12,
      fontWeight: "600",
      fill: tokens.labelFg,
    },
  });
  label.anchor.set(0.5, 0);
  label.x = cx;
  label.y = cy + 18;
  if (drawLabel) drawLabel(label, tokens.labelFg);
  return label;
}
