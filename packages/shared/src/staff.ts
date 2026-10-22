/** staff/chat 域 DTO 与状态常量（zod 契约，门禁 4：请求响应 schema 单一来源）。 */
import { z } from "zod";

// ───── 状态机（varchar + 应用层 zod，rules/database §4） ─────

export const STAFF_STATUSES = ["DRAFT", "PUBLISHED", "OFFLINE"] as const;
export const STAFF_VISIBILITIES = ["PRIVATE", "ORG", "GALLERY"] as const;
export const CONVERSATION_STATUSES = ["ACTIVE", "IDLE", "TERMINATED", "HANDOFF"] as const;
export const RUN_STATUSES = ["STARTED", "STREAMING", "SUCCEEDED", "FAILED", "INTERRUPTED"] as const;

// ───── staff DTO ─────

export const staffCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(128),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "工号仅允许字母数字下划线连字符")
    .optional(),
  personaPrompt: z.string().trim().min(1).max(20000),
  boundary: z.string().trim().max(20000).optional(),
  avatarUrl: z.string().url().max(512).optional(),
  visibility: z.enum(STAFF_VISIBILITIES).default("PRIVATE"),
});
export type StaffCreateInput = z.infer<typeof staffCreateInput>;

export const staffUpdateInput = staffCreateInput.partial();
export type StaffUpdateInput = z.infer<typeof staffUpdateInput>;

export const staffDto = z.object({
  id: z.string(),
  orgId: z.string(),
  code: z.string(),
  name: z.string(),
  title: z.string(),
  personaPrompt: z.string(),
  boundary: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.enum(STAFF_STATUSES),
  visibility: z.enum(STAFF_VISIBILITIES),
  asAgentId: z.string().nullable(),
  asAgentKey: z.string().nullable(),
  publishedAt: z.string().nullable(),
  deskFloor: z.number().int().nullable(),
  deskSeat: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StaffDto = z.infer<typeof staffDto>;

/** 办公室楼层/工位常量（OFFICE-001：每层 20 工位，默认 3 层） */
export const OFFICE_FLOOR_COUNT = 3;
export const OFFICE_SEATS_PER_FLOOR = 20;

/** 工位分配/切换（OFFICE-001） */
export const deskAssignInput = z.object({
  floor: z.number().int().min(1).max(9),
  seat: z.number().int().min(1).max(OFFICE_SEATS_PER_FLOOR),
});
export type DeskAssignInput = z.infer<typeof deskAssignInput>;

// ───── conversation / chat DTO ─────

export const conversationCreateInput = z.object({ title: z.string().trim().max(256).optional() });
export type ConversationCreateInput = z.infer<typeof conversationCreateInput>;

export const messageSendInput = z.object({
  content: z.string().trim().min(1).max(32000),
});
export type MessageSendInput = z.infer<typeof messageSendInput>;

export const conversationDto = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  title: z.string(),
  status: z.enum(CONVERSATION_STATUSES),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ConversationDto = z.infer<typeof conversationDto>;

export const messageDto = z.object({
  id: z.string(),
  seq: z.number(),
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  content: z.string(),
  tokenUsage: z.unknown().nullable(),
  /** OBS-001：本条消息的反馈（无反馈为 null；用户消息恒 null） */
  feedback: z.object({ rating: z.enum(["UP", "DOWN"]), comment: z.string().nullable() }).nullable(),
  createdAt: z.string(),
});
export type MessageDto = z.infer<typeof messageDto>;

// ───── SSE 平台事件信封（BFF 归一化后发给浏览器） ─────

export const chatEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run_started"), runId: z.string(), at: z.string() }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("message_completed"),
    messageId: z.string(),
    role: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("usage"),
    model: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }),
  z.object({ type: z.literal("run_ended"), status: z.string(), reason: z.string().nullable() }),
  z.object({ type: z.literal("interrupted") }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type ChatEvent = z.infer<typeof chatEvent>;

// ───── auth DTO ─────

export const loginInput = z.object({
  email: z.string().trim().email().max(256),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginInput>;

export const meDto = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["ADMIN", "MEMBER"]),
});
export type MeDto = z.infer<typeof meDto>;

// ───── 分页（api-conventions §5） ─────

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuery>;

export function pageEnvelope<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize };
}

// ───── HITL 人工接管（CHAT-003） ─────

export const handoffCreateInput = z.object({
  reason: z.string().trim().min(1).max(512),
});
export type HandoffCreateInput = z.infer<typeof handoffCreateInput>;

export const handoffResolveInput = z.object({
  conclusion: z.string().trim().max(1024).optional(),
});
export type HandoffResolveInput = z.infer<typeof handoffResolveInput>;

export const HANDOFF_STATUSES = ["PENDING", "HANDLING", "RESOLVED"] as const;

export const handoffDto = z.object({
  id: z.string(),
  conversationId: z.string(),
  conversationTitle: z.string(),
  status: z.enum(HANDOFF_STATUSES),
  initiatedBy: z.string().nullable(),
  handledBy: z.string().nullable(),
  reason: z.string().nullable(),
  conclusion: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type HandoffDto = z.infer<typeof handoffDto>;
