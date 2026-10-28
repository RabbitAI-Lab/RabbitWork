"use client";

/**
 * OFFICE-004 v5 · 平面办公室楼层图（canvas 全自绘，Client Component）
 * ──────────────────────────────────────────────────────────────────
 * 画法与布局以 docs/design/OFFICE-004-isometric-floor/prototype-v5.html 人工确认稿为准
 * （2026-10-28 用户决策：弃用 pixoffice 素材规避授权风险，改建筑平面图语言全自绘）。
 * 配色经 tokens.css --rw-plan-* 双值登记（亮暗自动跟随）；绿仅交互语义（在座/hover）。
 * 交互：hover 高亮、点击工位回调（菜单/对话由页面层承担）。
 */

import { useEffect, useRef } from "react";
import type { StaffDto } from "@rabbit/shared";
import { OFFICE_SEATS_PER_FLOOR } from "@rabbit/shared";

const W = 1200;
const H = 760;
const WALL = 12;
const M = 44; // 图纸外边距

/** 衣色池（姓名哈希；与员工详情 Hero 工位照同源的稳重色系） */
const TONES = ["#0f766e", "#2f6fd0", "#a85d32", "#6f7b42", "#33507a", "#b08325"] as const;

function hashName(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h;
}
const toneOf = (n: string): string => TONES[hashName(n) % TONES.length]!;

/** 12 工位：开放区三列 × 四行（俯视桌 116×76，面向北墙） */
const SEATS: Array<{ x: number; y: number; n: number }> = [];
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 3; c++) SEATS.push({ x: 590 + c * 172, y: 192 + r * 124, n: r * 3 + c + 1 });
}

export interface IsometricFloorPlanProps {
  floor: number;
  bySeat: Map<string, StaffDto>;
  dataTestId?: string;
  onSeatClick?: (seat: number, staff?: StaffDto) => void;
}

export function IsometricFloorPlan({
  floor,
  bySeat,
  dataTestId = "office-iso-floor-plan",
  onSeatClick,
}: IsometricFloorPlanProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const clickRef = useRef(onSeatClick);
  clickRef.current = onSeatClick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;
    let raf = 0;
    let hoverSeat = -1;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* 主题色缓存：读 tokens.css 语义变量，class 切换时失效重取（亮暗跟随） */
    const cache = new Map<string, string>();
    let themeDirty = true;
    const v = (name: string): string => {
      if (themeDirty) cache.clear();
      themeDirty = false;
      const hit = cache.get(name);
      if (hit) return hit;
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      cache.set(name, val);
      return val;
    };
    const observer = new MutationObserver(() => {
      themeDirty = true;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const roundRect = (x: number, y: number, w: number, h: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    /* ── 制图原语 ── */
    const wallRect = (x: number, y: number, w: number, h: number): void => {
      ctx.fillStyle = v("--rw-plan-wall-fill");
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = v("--rw-plan-wall");
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    };
    const windowSeg = (x1: number, y1: number, x2: number, y2: number): void => {
      ctx.strokeStyle = v("--rw-plan-glass");
      ctx.lineWidth = WALL - 4;
      ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = v("--rw-plan-wall");
      ctx.lineWidth = 1.5;
      for (const off of [-(WALL - 4) / 2, (WALL - 4) / 2]) {
        ctx.beginPath();
        if (y1 === y2) { ctx.moveTo(x1, y1 + off); ctx.lineTo(x2, y2 + off); }
        else { ctx.moveTo(x1 + off, y1); ctx.lineTo(x2 + off, y2); }
        ctx.stroke();
      }
    };
    const doorArc = (x: number, y: number, r: number, a0: number, a1: number): void => {
      ctx.strokeStyle = v("--rw-plan-wall");
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(x, y, r, a0, a1 + Math.PI / 2); ctx.stroke();
      ctx.setLineDash([]);
    };
    const desk = (x: number, y: number, w: number, h: number, label: string, name: string): void => {
      ctx.fillStyle = v("--rw-plan-shadow"); roundRect(x + 3, y + 4, w, h, 6); ctx.fill();
      ctx.fillStyle = v("--rw-plan-furniture"); roundRect(x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = v("--rw-plan-furniture-line"); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = v("--rw-plan-wall"); roundRect(x + w / 2 - 28, y + 6, 56, 8, 2); ctx.fill();
      ctx.fillStyle = v("--rw-card"); roundRect(x + w / 2 - 21, y + 19, 42, 6, 2); ctx.fill();
      ctx.textBaseline = "alphabetic";
      ctx.font = "500 10px -apple-system, PingFang SC";
      ctx.fillStyle = v("--rw-fg-subtle");
      ctx.textAlign = "left"; ctx.fillText(label, x + 8, y + h - 8);
      if (name) {
        const breath = 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 900));
        ctx.font = "600 11px -apple-system, PingFang SC";
        ctx.fillStyle = `rgba(16,185,129,${0.35 + 0.6 * breath})`;
        ctx.beginPath(); ctx.arc(x + w - ctx.measureText(name).width - 22, y + h - 11, 3.2, 0, 7); ctx.fill();
        ctx.fillStyle = v("--rw-fg");
        ctx.textAlign = "right"; ctx.fillText(name, x + w - 8, y + h - 8);
      }
      ctx.textAlign = "start";
    };
    const chairTop = (x: number, y: number, occupied: boolean, name: string): void => {
      const tone = occupied ? toneOf(name) : v("--rw-plan-floor-alt");
      ctx.fillStyle = occupied ? tone : v("--rw-plan-floor-alt");
      ctx.strokeStyle = occupied ? tone : v("--rw-plan-wall");
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(x - 20, y - 20, 40, 40, 10); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.strokeStyle = occupied ? tone : v("--rw-plan-wall");
      ctx.beginPath(); ctx.arc(x, y + 2, 17, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      if (occupied) {
        ctx.fillStyle = "#3d3229"; // 发色（固定值：暗色主题下保持深发以维持俯视辨识）
        ctx.beginPath(); ctx.arc(x, y - 1, 8, 0, 7); ctx.fill();
        ctx.fillStyle = tone; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(x, y + 4, 13, Math.PI * 1.08, Math.PI * 1.92); ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    const confTable = (x: number, y: number, scale = 1): void => {
      ctx.save();
      ctx.translate(x + 125 * scale, y + 48 * scale);
      ctx.scale(scale, scale);
      ctx.translate(-(x + 125 * scale), -(y + 48 * scale));
      ctx.fillStyle = v("--rw-plan-shadow"); roundRect(x + 3, y + 4, 250, 96, 10); ctx.fill();
      ctx.fillStyle = v("--rw-plan-furniture"); roundRect(x, y, 250, 96, 10); ctx.fill();
      ctx.strokeStyle = v("--rw-plan-furniture-line"); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = v("--rw-plan-wall"); ctx.lineWidth = 1;
      roundRect(x + 10, y + 8, 230, 80, 8); ctx.stroke();
      ctx.fillStyle = v("--rw-plan-floor-alt");
      ctx.strokeStyle = v("--rw-plan-wall"); ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          const cx = x + 45 + i * 80, cy = y + (side < 0 ? -12 : 108);
          ctx.beginPath(); ctx.roundRect(cx - 15, cy - 11, 30, 22, 7); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    };
    const plant = (x: number, y: number, r: number): void => {
      ctx.fillStyle = v("--rw-plan-leaf"); ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
      }
    };

    const staffAt = (seat: number): StaffDto | undefined => bySeat.get(`${floor}-${seat}`);

    const draw = (): void => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = v("--rw-card"); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = v("--rw-plan-floor"); ctx.fillRect(M, M, W - M * 2, H - M * 2);

      ctx.strokeStyle = v("--rw-plan-floor-alt"); ctx.lineWidth = 1;
      for (let gx = M + 60; gx < W - M; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, M); ctx.lineTo(gx, H - M); ctx.stroke(); }
      for (let gy = M + 60; gy < H - M; gy += 60) { ctx.beginPath(); ctx.moveTo(M, gy); ctx.lineTo(W - M, gy); ctx.stroke(); }

      // 外墙 + 窗
      wallRect(M, M, W - M * 2, WALL);
      windowSeg(M + 150, M + WALL / 2, M + 560, M + WALL / 2);
      windowSeg(W - M - 460, M + WALL / 2, W - M - 150, M + WALL / 2);
      wallRect(M, H - M - WALL, W - M * 2, WALL);
      windowSeg(M + 420, H - M - WALL / 2, M + 700, H - M - WALL / 2);
      wallRect(M, M, WALL, H - M * 2);
      wallRect(W - M - WALL, M, WALL, H - M * 2);
      windowSeg(W - M - WALL / 2, M + 130, W - M - WALL / 2, H - M - 240);

      // 内墙：会议室 A / B + 茶水间（左侧三段）
      wallRect(M + WALL, M + WALL, 8, H - M * 2 - WALL * 2);
      wallRect(M + WALL, 330, 340, 8);
      ctx.fillStyle = v("--rw-plan-floor"); ctx.fillRect(M + WALL + 180, 326, 56, 16);
      doorArc(M + WALL + 236, 330, 46, Math.PI, Math.PI * 1.5);
      wallRect(M + WALL, 560, 340, 8);
      ctx.fillStyle = v("--rw-plan-floor"); ctx.fillRect(M + WALL + 60, 556, 56, 16);
      doorArc(M + WALL + 116, 560, 46, Math.PI * 1.5, Math.PI);

      // 区域标注
      ctx.fillStyle = v("--rw-fg-muted"); ctx.font = "600 13px -apple-system, PingFang SC";
      ctx.fillText("会议室 A", M + WALL + 22, M + WALL + 26);
      ctx.fillText("会议室 B", M + WALL + 22, 356);
      ctx.fillText("开放工位区", 560, M + WALL + 26);
      ctx.font = "500 12px -apple-system, PingFang SC";
      ctx.fillText("茶水角", M + WALL + 64, 620);

      confTable(M + WALL + 40, M + WALL + 52);
      confTable(M + WALL + 44, 380, 0.92);

      // 茶水角吧台
      ctx.fillStyle = v("--rw-plan-shadow"); roundRect(M + WALL + 30, 640, 150, 40, 8); ctx.fill();
      ctx.fillStyle = v("--rw-plan-furniture"); roundRect(M + WALL + 26, 636, 150, 40, 8); ctx.fill();
      ctx.strokeStyle = v("--rw-plan-furniture-line"); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = v("--rw-fg-subtle"); ctx.font = "500 11px -apple-system";
      ctx.fillText("☕", M + WALL + 90, 661);
      plant(M + WALL + 260, 660, 16);

      // 12 工位
      for (const s of SEATS) {
        if (s.n > OFFICE_SEATS_PER_FLOOR) continue;
        const st = staffAt(s.n);
        desk(s.x - 58, s.y - 38, 116, 76, `${floor}F-${String(s.n).padStart(2, "0")}`, st?.name ?? "");
        chairTop(s.x, s.y + 50, Boolean(st), st?.name ?? "");
        if (hoverSeat === s.n) {
          ctx.strokeStyle = st ? v("--rw-accent") : v("--rw-fg-subtle");
          ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          roundRect(s.x - 68, s.y - 48, 136, 134, 10); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      plant(W - M - 52, M + 60, 20);
      plant(M + 60, H - M - 60, 20);

      ctx.fillStyle = v("--rw-fg-subtle"); ctx.font = "500 11px -apple-system";
      ctx.textAlign = "right";
      ctx.fillText(`${floor}F · 楼层平面`, W - M, H - 18);
      ctx.textAlign = "start";

      if (!destroyed) raf = requestAnimationFrame(draw);
    };

    const pick = (e: MouseEvent): number => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * H;
      for (const s of SEATS) {
        if (s.n > OFFICE_SEATS_PER_FLOOR) continue;
        if (Math.abs(x - s.x) < 68 && y > s.y - 48 && y < s.y + 86) return s.n;
      }
      return -1;
    };
    let lastTap = 0;
    const onClick = (e: MouseEvent): void => {
      const n = pick(e);
      if (n < 1) return;
      const now = Date.now();
      if (now - lastTap < 80) return;
      lastTap = now;
      clickRef.current?.(n, staffAt(n));
    };
    const onMove = (e: MouseEvent): void => {
      hoverSeat = pick(e);
      canvas.style.cursor = hoverSeat > 0 ? "pointer" : "default";
    };
    const onLeave = (): void => {
      hoverSeat = -1;
    };

    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `办公室楼层 ${floor}F：${OFFICE_SEATS_PER_FLOOR} 工位平面图`);
    host.appendChild(canvas);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.remove();
    };
  }, [floor, bySeat]);

  return <div ref={hostRef} data-testid={dataTestId} style={{ minHeight: H / 2, width: "100%" }} />;
}
