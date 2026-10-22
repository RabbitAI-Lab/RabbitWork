import { DomainError, ErrCode, handoffResolveInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 解决（→RESOLVED + 会话恢复 ACTIVE + 系统消息留痕;未认领直接解决时自动补 handledBy）。 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_CHAT:SEND");
    const { id } = await ctx.params;
    const record = await prisma.humanHandoffRecord.findUnique({ where: { id } });
    if (!record) throw new DomainError(ErrCode.NOT_FOUND, "接管记录不存在");
    if (record.status === "RESOLVED") {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "该记录已解决");
    }
    const input = await parseBody(req, handoffResolveInput);
    const row = await prisma.humanHandoffRecord.update({
      where: { id },
      data: {
        status: "RESOLVED",
        handledBy: record.handledBy ?? user.uid,
        resolvedAt: new Date(),
        ...(input.conclusion !== undefined ? { conclusion: input.conclusion } : {}),
      },
    });
    await prisma.conversation.update({
      where: { id: record.conversationId },
      data: { status: "ACTIVE" },
    });
    const last = await prisma.messageMirror.findFirst({
      where: { conversationId: record.conversationId },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await prisma.messageMirror.create({
      data: {
        conversationId: record.conversationId,
        seq: (last?.seq ?? 0) + 1,
        role: "SYSTEM",
        content: input.conclusion ? `人工接管已解决：${input.conclusion}` : "人工接管已解决",
      },
    });
    void audit({
      actorId: user.uid,
      action: "handoff.resolve",
      targetType: "handoff",
      targetId: id,
    });
    return jsonOk({ id: row.id, status: row.status, resolvedAt: row.resolvedAt?.toISOString() });
  } catch (e) {
    return toErrorResponse(e);
  }
}
