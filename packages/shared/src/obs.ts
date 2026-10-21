/** obs 域 DTO（OBS-001：消息反馈 + 运行留痕 + 最小看板；蓝图 S2 欠账回补）。 */
import { z } from "zod";
import { pageQuery, RUN_STATUSES } from "./staff";

// ───── 权限点（rbac 登记） ─────
// ORG_RUN:READ 见 permissions.ts（MEMBER 只读天然放行）

// ───── 消息反馈（PUT /api/v1/messages/{mirrorId}/feedback） ─────

export const FEEDBACK_RATINGS = ["UP", "DOWN"] as const;

/** rating=null 即撤销（删行）；comment 仅 DOWN 可填（UP 提交时忽略） */
export const feedbackInput = z.object({
  rating: z.enum(FEEDBACK_RATINGS).nullable(),
  comment: z.string().trim().max(1024).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackInput>;

export const feedbackDto = z.object({
  messageMirrorId: z.string(),
  rating: z.enum(FEEDBACK_RATINGS).nullable(),
  comment: z.string().nullable(),
});
export type FeedbackDto = z.infer<typeof feedbackDto>;

// ───── 运行留痕（GET /api/v1/runs；RUN_STATUSES 复用 staff 域 chat 侧定义） ─────

export const runListQuery = pageQuery.extend({
  status: z.enum(RUN_STATUSES).optional(),
});
export type RunListQuery = z.infer<typeof runListQuery>;

export const runDto = z.object({
  id: z.string(),
  conversationId: z.string(),
  conversationTitle: z.string(),
  employeeName: z.string(),
  status: z.enum(RUN_STATUSES),
  durationMs: z.number().nullable(),
  tokenIn: z.number().nullable(),
  tokenOut: z.number().nullable(),
  error: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type RunDto = z.infer<typeof runDto>;

// ───── 看板（GET /api/v1/runs/stats；口径见规格 §2.2） ─────

export const runStatsDto = z.object({
  todayCount: z.number(),
  /** SUCCEEDED / (总 - 进行中)；无终态样本时为 null（不显示 0%） */
  successRate7d: z.number().nullable(),
  avgDurationMs7d: z.number().nullable(),
  tokens7d: z.number(),
});
export type RunStatsDto = z.infer<typeof runStatsDto>;

/**
 * 看板口径纯函数（OBS-001 §2.2；供路由与单测共用）。
 * 进行中 = STARTED/STREAMING（不计成功率与平均时长）。
 */
export function deriveRunStats(counts: {
  today: number;
  byStatus7d: Partial<Record<(typeof RUN_STATUSES)[number], number>>;
  avgDurationMs7d: number | null;
  tokens7d: number;
}): RunStatsDto {
  const total = Object.values(counts.byStatus7d).reduce((a, b) => a + (b ?? 0), 0);
  const inFlight = (counts.byStatus7d.STARTED ?? 0) + (counts.byStatus7d.STREAMING ?? 0);
  const finished = total - inFlight;
  return {
    todayCount: counts.today,
    successRate7d:
      finished > 0 ? Math.round(((counts.byStatus7d.SUCCEEDED ?? 0) / finished) * 1000) / 10 : null,
    avgDurationMs7d: counts.avgDurationMs7d,
    tokens7d: counts.tokens7d,
  };
}
