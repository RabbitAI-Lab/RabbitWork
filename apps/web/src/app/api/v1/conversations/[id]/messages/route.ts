import { DomainError, ErrCode, messageSendInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toMessageDto } from "@/server/dto";
import { getAgentScope } from "@/server/agentscope";

export const runtime = "nodejs";

/**
 * CHAT-001 发送消息：用户消息落镜像 → AgentScope chat/turn 派发 → 建运行留痕。
 * SSE 事件流由 GET /api/v1/conversations/{id}/events 消费并归一化转发。
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ORG_CHAT:SEND");
    const { id } = await ctx.params;
    const { content } = await parseBody(req, messageSendInput);

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.uid, deletedAt: null },
      include: { employee: true },
    });
    if (!conversation) throw new DomainError(ErrCode.NOT_FOUND, "会话不存在");
    const staff = conversation.employee;
    if (staff.status !== "PUBLISHED" || !staff.asAgentId) {
      throw new DomainError(ErrCode.STAFF_NOT_PUBLISHED, "员工未发布");
    }

    // 同会话并发运行限制（对齐 AgentScope 同 session 并发 409 语义）
    const activeRun = await prisma.runRecord.findFirst({
      where: { conversationId: id, status: { in: ["STARTED", "STREAMING"] } },
    });
    if (activeRun) throw new DomainError(ErrCode.RUN_CONFLICT, "当前会话有正在进行的回复，请稍候或先打断");

    // 用户消息镜像（seq 单调递增）
    const last = await prisma.messageMirror.findFirst({
      where: { conversationId: id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const userMessage = await prisma.messageMirror.create({
      data: { conversationId: id, seq: (last?.seq ?? 0) + 1, role: "USER", content },
    });

    // AgentScope 派发：先建空 chat（携带消息创建的 chat 不产生事件流——2026-10-17 实测），
    // 后续统一走 sendTurn（turn 响应含 eventStreamUrl/eventsUrl）
    const provider = getAgentScope();
    let handle;
    if (conversation.asChatId) {
      handle = await provider.sendTurn(conversation.asChatId, staff.asAgentId, content);
    } else {
      const created = await provider.startChat(staff.asAgentId);
      handle = await provider.sendTurn(created.chatId, staff.asAgentId, content);
    }

    const [run] = await prisma.$transaction([
      prisma.runRecord.create({ data: { conversationId: id, status: "STARTED" } }),
      prisma.conversation.update({
        where: { id },
        data: {
          asChatId: handle.chatId,
          asSessionId: handle.sessionId,
          asRuntimeSessionId: handle.runtimeSessionId,
          lastMessageAt: new Date(),
          status: "ACTIVE",
          title: shouldRetitle(conversation.title, content) ? retitle(staff.name, content) : conversation.title,
        },
      }),
    ]);

    return jsonOk({ runId: run.id, userMessage: toMessageDto(userMessage) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 默认标题且这是首轮 → 用首条消息生成标题 */
function shouldRetitle(currentTitle: string, _content: string): boolean {
  void _content;
  return /^与 .+ 的对话$/.test(currentTitle);
}

function retitle(staffName: string, content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 24 ? `${staffName}·${flat.slice(0, 24)}…` : `${staffName}·${flat}`;
}
