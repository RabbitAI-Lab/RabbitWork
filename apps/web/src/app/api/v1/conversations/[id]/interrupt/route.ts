import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { getAgentScope } from "@/server/agentscope";

export const runtime = "nodejs";

/** CHAT-001 打断：透传 AgentScope interrupt；上游不支持时仅平台侧置 INTERRUPTED。 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ORG_CHAT:SEND");
    const { id } = await ctx.params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.uid, deletedAt: null },
    });
    if (!conversation?.asRuntimeSessionId) return jsonOk({ ok: false, detail: "无可打断的运行" });

    const upstreamOk = await getAgentScope().interrupt(conversation.asRuntimeSessionId);
    await prisma.runRecord.updateMany({
      where: { conversationId: id, status: { in: ["STARTED", "STREAMING"] } },
      data: { status: "INTERRUPTED", finishedAt: new Date() },
    });
    return jsonOk({ ok: true, upstream: upstreamOk });
  } catch (e) {
    return toErrorResponse(e);
  }
}
