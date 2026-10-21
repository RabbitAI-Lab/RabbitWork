import { DomainError, ErrCode, feedbackInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ mirrorId: string }> };

/**
 * 消息反馈 upsert（OBS-001 §2.1 状态机）：rating=null 撤销（删行）；👍/👎 互斥切换（同键覆盖）。
 * 仅本会话所属人的 ASSISTANT 消息可反馈。
 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_CHAT:SEND");
    const { mirrorId } = await ctx.params;
    const input = await parseBody(req, feedbackInput);

    const mirror = await prisma.messageMirror.findUnique({
      where: { id: mirrorId },
      include: { conversation: { select: { userId: true } } },
    });
    if (!mirror || mirror.conversation.userId !== user.uid) {
      throw new DomainError(ErrCode.NOT_FOUND, "消息不存在");
    }
    if (mirror.role !== "ASSISTANT") {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "仅员工消息可反馈");
    }

    if (input.rating === null) {
      await prisma.messageFeedback.deleteMany({ where: { messageMirrorId: mirrorId } });
      return jsonOk({ messageMirrorId: mirrorId, rating: null, comment: null });
    }
    const row = await prisma.messageFeedback.upsert({
      where: { messageMirrorId: mirrorId },
      // UP 提交评语忽略（规格 §2.1：评语仅 DOWN 有意义）
      update: {
        rating: input.rating,
        comment: input.rating === "DOWN" ? (input.comment ?? null) : null,
      },
      create: {
        messageMirrorId: mirrorId,
        rating: input.rating,
        comment: input.rating === "DOWN" ? (input.comment ?? null) : null,
      },
    });
    return jsonOk({
      messageMirrorId: row.messageMirrorId,
      rating: row.rating as "UP" | "DOWN",
      comment: row.comment,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
