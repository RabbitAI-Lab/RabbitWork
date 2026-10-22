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

// ───── 用量日聚合（GET /api/v1/usage/daily,OBS-002） ─────

export const usageQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});
export type UsageQuery = z.infer<typeof usageQuery>;

export const usageDayDto = z.object({
  day: z.string(),
  runs: z.number(),
  tokenIn: z.number(),
  tokenOut: z.number(),
});
export type UsageDayDto = z.infer<typeof usageDayDto>;

export const usageTopEmployeeDto = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  runs: z.number(),
  tokenTotal: z.number(),
});
export type UsageTopEmployeeDto = z.infer<typeof usageTopEmployeeDto>;

export const usageSummaryDto = z.object({
  days: z.array(usageDayDto),
  topEmployees: z.array(usageTopEmployeeDto),
});
export type UsageSummaryDto = z.infer<typeof usageSummaryDto>;

// ───── 审计日志（GET /api/v1/audit-logs,仅 ADMIN） ─────

export const auditLogDto = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditLogDto = z.infer<typeof auditLogDto>;

// ───── API Key（OBS-003,rw_live_ 三级密钥首期 ACCOUNT） ─────

export const APIKEY_SCOPES = ["ACCOUNT", "STAFF", "CLIENT"] as const;

export const apiKeyCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateInput>;

export const apiKeyDto = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(APIKEY_SCOPES),
  keyPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ApiKeyDto = z.infer<typeof apiKeyDto>;

/** 创建响应：明文仅此一次返回 */
export const apiKeyCreatedDto = apiKeyDto.extend({ plaintext: z.string() });
export type ApiKeyCreatedDto = z.infer<typeof apiKeyCreatedDto>;
