import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 员工详情数据统计:会话数 / 运行统计 / token 用量 / 最近活跃。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("ORG_STAFF:READ");
    const { id } = await ctx.params;
    const staff = await prisma.digitalEmployee.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!staff) throw new DomainError(ErrCode.NOT_FOUND, "员工不存在");

    const [conversationCount, runAgg, runTotal, lastActive] = await Promise.all([
      prisma.conversation.count({ where: { employeeId: id, deletedAt: null } }),
      prisma.runRecord.groupBy({
        by: ["status"],
        where: { conversation: { employeeId: id } },
        _count: { _all: true },
        _sum: { tokenIn: true, tokenOut: true },
      }),
      prisma.runRecord.count({ where: { conversation: { employeeId: id } } }),
      prisma.conversation.findFirst({
        where: { employeeId: id, deletedAt: null },
        orderBy: { lastMessageAt: "desc" },
        select: { lastMessageAt: true },
      }),
    ]);

    let succeeded = 0;
    let failed = 0;
    let interrupted = 0;
    let tokenIn = 0;
    let tokenOut = 0;
    for (const g of runAgg) {
      const count = g._count._all;
      if (g.status === "SUCCEEDED") succeeded = count;
      if (g.status === "FAILED") failed = count;
      if (g.status === "INTERRUPTED") interrupted = count;
      tokenIn += g._sum.tokenIn ?? 0;
      tokenOut += g._sum.tokenOut ?? 0;
    }

    return jsonOk({
      conversationCount,
      runTotal,
      runSucceeded: succeeded,
      runFailed: failed,
      runInterrupted: interrupted,
      tokenIn,
      tokenOut,
      lastActiveAt: lastActive?.lastMessageAt?.toISOString() ?? null,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
