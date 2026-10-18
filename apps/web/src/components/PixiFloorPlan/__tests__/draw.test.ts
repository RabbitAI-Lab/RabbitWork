import { describe, expect, it } from "vitest";
import {
  computeFloorSize,
  seatCenter,
  FLOOR_COLS,
  FLOOR_ROWS,
  FLOOR_SEATS_TOTAL,
  PADDING,
  SEAT_W,
  SEAT_H,
  COL_GAP,
  ROW_GAP,
} from "../draw";

describe("computeFloorSize", () => {
  it("应为 5×4 = 20 工位的固定 grid 出正确尺寸", () => {
    const { w, h } = computeFloorSize();
    const expW = PADDING * 2 + FLOOR_COLS * SEAT_W + (FLOOR_COLS - 1) * COL_GAP;
    const expH = PADDING * 2 + FLOOR_ROWS * SEAT_H + (FLOOR_ROWS - 1) * ROW_GAP;
    expect(w).toBe(expW);
    expect(h).toBe(expH);
    expect(FLOOR_SEATS_TOTAL).toBe(20);
  });
});

describe("seatCenter", () => {
  it("(0,0) 工位中心约在 (PADDING + SEAT_W/2, PADDING + SEAT_H*0.55)", () => {
    const { x, y } = seatCenter(0, 0);
    expect(x).toBeCloseTo(PADDING + SEAT_W / 2, 6);
    expect(y).toBeCloseTo(PADDING + SEAT_H * 0.55, 6);
  });

  it("右下角工位中心约在右下角", () => {
    const { x, y } = seatCenter(FLOOR_COLS - 1, FLOOR_ROWS - 1);
    const { w, h } = computeFloorSize();
    // (col, row) 中心不会超过 canvas 边界
    expect(x).toBeLessThanOrEqual(w);
    expect(y).toBeLessThanOrEqual(h);
  });

  it("同行相邻工位的水平距离 = SEAT_W + COL_GAP", () => {
    const a = seatCenter(0, 0);
    const b = seatCenter(1, 0);
    expect(b.x - a.x).toBeCloseTo(SEAT_W + COL_GAP, 6);
  });
});
