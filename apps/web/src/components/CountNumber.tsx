"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 统计数字滚动（DS v2.1 L3 编排揭示）：进入视口触发一次 count-up（900ms cubic-out）。
 * 只用于统计卡/仪表数据；表单值禁用（MASTER §2 工程红线）。
 * 数据异步到达时（0 → N）自动重置并重放。
 */
export function CountNumber({ target, durationMs = 900 }: { target: number; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const startedFor = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      startedFor.current = null;
      return;
    }
    if (startedFor.current === target) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || startedFor.current === target) return;
        startedFor.current = target;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - t0) / durationMs, 1);
          setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  );
}
