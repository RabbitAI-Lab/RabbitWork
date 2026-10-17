import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { toConversationDto, toMessageDto } from "@/server/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CHAT-001：会话详情（含消息镜像；全文以 AgentScope 为准，本表为展示镜像）。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ORG_CHAT:READ");
    const { id } = await ctx.params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.uid, deletedAt: null },
      include: { employee: true },
    });
    if (!conversation) throw new DomainError(ErrCode.NOT_FOUND, "会话不存在");
    const messages = await prisma.messageMirror.findMany({
      where: { conversationId: id },
      orderBy: { seq: "asc" },
      take: 200,
    });
    return jsonOk({
      conversation: toConversationDto(conversation, conversation.employee),
      employee: {
        id: conversation.employee.id,
        name: conversation.employee.name,
        title: conversation.employee.title,
        avatarUrl: conversation.employee.avatarUrl,
      },
      messages: messages.map(toMessageDto),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
