/** 域模型 → DTO 映射（响应只暴露契约字段）。 */
import type { Conversation, DigitalEmployee, MessageMirror, RunRecord } from "@prisma/client";
import type { ConversationDto, MessageDto, StaffDto } from "@rabbit/shared";

type StaffWithCount = DigitalEmployee & { _count?: { conversations: number } };

export function toStaffDto(s: DigitalEmployee): StaffDto {
  return {
    id: s.id,
    orgId: s.orgId,
    code: s.code,
    name: s.name,
    title: s.title,
    personaPrompt: s.personaPrompt,
    boundary: s.boundary,
    avatarUrl: s.avatarUrl,
    status: s.status as StaffDto["status"],
    visibility: s.visibility as StaffDto["visibility"],
    asAgentId: s.asAgentId,
    asAgentKey: s.asAgentKey,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    deskFloor: s.deskFloor,
    deskSeat: s.deskSeat,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toConversationDto(
  c: Conversation,
  employee: Pick<DigitalEmployee, "name">,
): ConversationDto {
  return {
    id: c.id,
    employeeId: c.employeeId,
    employeeName: employee.name,
    title: c.title,
    status: c.status as ConversationDto["status"],
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

/** m.feedback 由调用方 include（OBS-001：会话详情带反馈态；unique 约束下至多 1 条） */
export function toMessageDto(
  m: MessageMirror & { feedback?: Array<{ rating: string; comment: string | null }> },
): MessageDto {
  const fb = m.feedback?.[0];
  return {
    id: m.id,
    seq: m.seq,
    role: m.role as MessageDto["role"],
    content: m.content,
    tokenUsage: m.tokenUsage ?? null,
    feedback: fb ? { rating: fb.rating as "UP" | "DOWN", comment: fb.comment } : null,
    createdAt: m.createdAt.toISOString(),
  };
}

export type { StaffWithCount };
