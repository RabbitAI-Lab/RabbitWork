import { DomainError, ErrCode, handoffCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 转人工（CHAT-003 §2）：记录 PENDING + 会话 HANDOFF + 系统消息留痕。 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_CHAT:SEND");
    const { id } = await ctx.params;
    const conv = await prisma.conversation.findFirst({
      where: { id, userId: user.uid, deletedAt: null },
    });
    if (!conv) throw new DomainError(ErrCode.NOT_FOUND, "会话不存在");
    if (conv.status === "HANDOFF") {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "该会话已有人工接管处理中");
    }
    const open = await prisma.humanHandoffRecord.findFirst({
      where: { conversationId: id, status: { not: "RESOLVED" } },
    });
    if (open) throw new DomainError(ErrCode.VALIDATION_FAILED, "该会话存在未解决的接管记录");
    const input = await parseBody(req, handoffCreateInput);
    const record = await prisma.humanHandoffRecord.create({
      data: { conversationId: id, status: "PENDING", initiatedBy: user.uid, reason: input.reason },
    });
    await prisma.conversation.update({ where: { id }, data: { status: "HANDOFF" } });
    const last = await prisma.messageMirror.findFirst({
      where: { conversationId: id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await prisma.messageMirror.create({
      data: {
        conversationId: id,
        seq: (last?.seq ?? 0) + 1,
        role: "SYSTEM",
        content: `已转人工处理：${input.reason}`,
      },
    });
    void audit({
      actorId: user.uid,
      action: "handoff.create",
      targetType: "conversation",
      targetId: id,
    });
    return jsonOk(
      {
        id: record.id,
        conversationId: record.conversationId,
        conversationTitle: conv.title,
        status: "PENDING",
        initiatedBy: record.initiatedBy,
        handledBy: null,
        reason: record.reason,
        conclusion: null,
        createdAt: record.createdAt.toISOString(),
        resolvedAt: null,
      },
      { status: 201 },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
