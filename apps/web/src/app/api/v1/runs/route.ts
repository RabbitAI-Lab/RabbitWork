import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseQuery, toErrorResponse } from "@/server/http";
import { runListQuery, type RunDto } from "@rabbit/shared";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 运行留痕列表（OBS-001 §1.4-C4/C6）：状态过滤 + 分页信封，最新在前。 */
export async function GET(req: Request) {
  try {
    await requirePermission("ORG_RUN:READ");
    const { page, pageSize, status } = parseQuery(req, runListQuery);
    const where: Prisma.RunRecordWhereInput = {
      conversation: { orgId: defaultOrgId() },
      ...(status ? { status } : {}),
    };
    const [rows, total, statusCounts] = await Promise.all([
      prisma.runRecord.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { conversation: { include: { employee: { select: { name: true } } } } },
      }),
      prisma.runRecord.count({ where }),
      prisma.runRecord.groupBy({
        by: ["status"],
        where: { conversation: { orgId: defaultOrgId() } },
        _count: { _all: true },
      }),
    ]);
    const counts: Record<string, number> = { total };
    for (const g of statusCounts) counts[g.status] = g._count._all;
    const items: RunDto[] = rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      conversationTitle: r.conversation.title,
      employeeName: r.conversation.employee.name,
      status: r.status as RunDto["status"],
      durationMs: r.durationMs,
      tokenIn: r.tokenIn,
      tokenOut: r.tokenOut,
      error: r.error,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));
    return jsonOk({ items, counts, total, page, pageSize });
  } catch (e) {
    return toErrorResponse(e);
  }
}
