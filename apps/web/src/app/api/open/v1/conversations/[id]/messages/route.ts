import { z } from "zod";
import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { getAgentScope } from "@/server/agentscope";
import { withApiKey } from "@/server/api-key-auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const sendInput = z.object({ content: z.string().trim().min(1).max(20000) });

/** 开放 API：发消息（OBS-003 §2.3;同构 Web sendTurn 链路,同步回复首期——事件流消费由调用方轮询详情）。 */
export async function POST(req: Request, ctx: Ctx) {
  return withApiKey(req, async (kc) => {
    try {
      const { id } = await ctx.params;
      const parsed = sendInput.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        throw new DomainError(ErrCode.VALIDATION_FAILED, "content 必填（1-20000 字）");
      }
      const conv = await prisma.conversation.findFirst({
        where: { id, orgId: kc.orgId, deletedAt: null },
        include: { employee: true },
      });
      if (!conv) throw new DomainError(ErrCode.NOT_FOUND, "会话不存在");
      const staff = conv.employee;
      if (!staff.asAgentId) {
        throw new DomainError(ErrCode.VALIDATION_FAILED, "员工未发布（无运行面身份）");
      }

      const last = await prisma.messageMirror.findFirst({
        where: { conversationId: id },
        orderBy: { seq: "desc" },
        select: { seq: true },
      });
      const userMsg = await prisma.messageMirror.create({
        data: {
          conversationId: id,
          seq: (last?.seq ?? 0) + 1,
          role: "USER",
          content: parsed.data.content,
        },
      });
      const run = await prisma.runRecord.create({
        data: { conversationId: id, status: "STARTED" },
      });

      const provider = getAgentScope();
      let handle;
      if (conv.asChatId) {
        handle = await provider.sendTurn(conv.asChatId, staff.asAgentId, parsed.data.content);
      } else {
        const created = await provider.startChat(staff.asAgentId);
        handle = await provider.sendTurn(created.chatId, staff.asAgentId, parsed.data.content);
      }
      await prisma.conversation.update({
        where: { id },
        data: {
          asChatId: handle.chatId,
          asSessionId: handle.sessionId,
          asRuntimeSessionId: handle.runtimeSessionId,
          lastMessageAt: new Date(),
        },
      });
      void audit({
        actorId: kc.creatorId ?? undefined,
        action: "open.message",
        targetType: "conversation",
        targetId: id,
        detail: { apiKeyId: kc.apiKeyId },
      });
      return jsonOk(
        {
          runId: run.id,
          userMessageId: userMsg.id,
          note: "消息已投递——轮询 GET 会话详情获取后续回复",
        },
        { status: 201 },
      );
    } catch (e) {
      return toErrorResponse(e);
    }
  });
}
