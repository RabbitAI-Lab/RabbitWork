import { DomainError, ErrCode, extractChannelText } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { getAgentScope } from "@/server/agentscope";
import { jsonOk, toErrorResponse } from "@/server/http";
import { channelHashEquals, channelTokenHashOf } from "@/server/channel-token";
import { logger } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/**
 * IM webhook 接收（CHNL-001 §2.2:token 鉴权（无 session,/api/open 分支）→
 * 消息归一 → 复用/新建会话（origin=CHANNEL,originRef=chnl:{id}:{extUserId}）→ sendTurn 同构投递。
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const channels = await prisma.channelConfig.findMany({
      where: { deletedAt: null, enabled: true },
      take: 200,
    });
    const hash = channelTokenHashOf(token);
    const channel = channels.find((c) => channelHashEquals(c.tokenHash, hash));
    if (!channel) throw new DomainError(ErrCode.NOT_FOUND, "渠道 token 无效或渠道已停用");

    const body: unknown = await req.json().catch(() => null);
    const extracted = extractChannelText(body);
    if (!extracted) {
      throw new DomainError(
        ErrCode.VALIDATION_FAILED,
        "未识别的消息形态（支持 text 字段 / 钉钉 text.content / 飞书 event.message.content）",
      );
    }

    const staff = await prisma.digitalEmployee.findFirst({
      where: { id: channel.employeeId, deletedAt: null, status: "PUBLISHED" },
    });
    if (!staff?.asAgentId) throw new DomainError(ErrCode.VALIDATION_FAILED, "绑定员工未发布");
    const agentId = staff.asAgentId;

    // 复用/新建会话（同一外部用户同一渠道一个会话）
    const originRef = `chnl:${channel.id}:${extracted.extUserId ?? "anonymous"}`;
    let conv = await prisma.conversation.findFirst({
      where: { originRef, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          orgId: channel.orgId,
          employeeId: channel.employeeId,
          userId: staff.creatorId ?? "channel",
          title: `[${channel.name}] ${extracted.extUserId ?? "匿名用户"}`,
          origin: "CHANNEL",
          originRef,
        },
      });
    }

    const last = await prisma.messageMirror.findFirst({
      where: { conversationId: conv.id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await prisma.messageMirror.create({
      data: {
        conversationId: conv.id,
        seq: (last?.seq ?? 0) + 1,
        role: "USER",
        content: extracted.text,
      },
    });

    // sendTurn 同构投递（回复经 Web 会话查看——出站推送 R-OUTBOUND）
    const provider = getAgentScope();
    const handle = conv.asChatId
      ? await provider.sendTurn(conv.asChatId, agentId, extracted.text)
      : await (async () => {
          const created = await provider.startChat(agentId);
          return provider.sendTurn(created.chatId, agentId, extracted.text);
        })();
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        asChatId: handle.chatId,
        asSessionId: handle.sessionId,
        asRuntimeSessionId: handle.runtimeSessionId,
        lastMessageAt: new Date(),
      },
    });
    await prisma.channelConfig.update({
      where: { id: channel.id },
      data: { lastMessageAt: new Date() },
    });
    logger.info({ module: "chnl", channelId: channel.id }, "channel message received");
    return jsonOk(
      { conversationId: conv.id, note: "消息已投递——回复经平台会话查看" },
      { status: 201 },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
