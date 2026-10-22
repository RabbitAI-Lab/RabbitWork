import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { withApiKey } from "@/server/api-key-auth";
import { jsonOk, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 开放 API：会话详情（OBS-003;API origin 会话全量可见）。 */
export async function GET(req: Request, ctx: Ctx) {
  return withApiKey(req, async (kc) => {
    try {
      const { id } = await ctx.params;
      const conv = await prisma.conversation.findFirst({
        where: { id, orgId: kc.orgId, deletedAt: null },
      });
      if (!conv) throw new DomainError(ErrCode.NOT_FOUND, "会话不存在");
      return jsonOk({
        id: conv.id,
        title: conv.title,
        employeeId: conv.employeeId,
        origin: conv.origin,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
        createdAt: conv.createdAt.toISOString(),
      });
    } catch (e) {
      return toErrorResponse(e);
    }
  });
}
