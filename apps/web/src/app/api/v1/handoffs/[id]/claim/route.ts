import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 认领（PENDING→HANDLING）。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_CHAT:SEND");
    const { id } = await ctx.params;
    const record = await prisma.humanHandoffRecord.findUnique({ where: { id } });
    if (!record) throw new DomainError(ErrCode.NOT_FOUND, "接管记录不存在");
    if (record.status !== "PENDING") {
      throw new DomainError(ErrCode.VALIDATION_FAILED, `当前状态 ${record.status} 不可认领`);
    }
    const row = await prisma.humanHandoffRecord.update({
      where: { id },
      data: { status: "HANDLING", handledBy: user.uid },
    });
    return jsonOk({ id: row.id, status: row.status, handledBy: row.handledBy });
  } catch (e) {
    return toErrorResponse(e);
  }
}
