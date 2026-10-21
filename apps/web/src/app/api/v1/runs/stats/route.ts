import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { deriveRunStats, RUN_STATUSES, type RunStatsDto } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 最小看板（OBS-001 §2.2 口径；聚合走 groupBy/aggregate，禁拼 SQL）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RUN:READ");
    const orgScope = { conversation: { orgId: defaultOrgId() } };
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [today, byStatusRaw, agg] = await Promise.all([
      prisma.runRecord.count({ where: { ...orgScope, startedAt: { gte: todayStart } } }),
      prisma.runRecord.groupBy({
        by: ["status"],
        where: { ...orgScope, startedAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
      prisma.runRecord.aggregate({
        where: {
          ...orgScope,
          startedAt: { gte: weekAgo },
          status: "SUCCEEDED",
          durationMs: { not: null },
        },
        _avg: { durationMs: true },
        _sum: { tokenIn: true, tokenOut: true },
      }),
    ]);

    const byStatus7d: Partial<Record<(typeof RUN_STATUSES)[number], number>> = {};
    for (const g of byStatusRaw)
      byStatus7d[g.status as (typeof RUN_STATUSES)[number]] = g._count._all;
    const stats: RunStatsDto = deriveRunStats({
      today,
      byStatus7d,
      avgDurationMs7d: agg._avg.durationMs != null ? Math.round(agg._avg.durationMs) : null,
      tokens7d: (agg._sum.tokenIn ?? 0) + (agg._sum.tokenOut ?? 0),
    });
    return jsonOk(stats);
  } catch (e) {
    return toErrorResponse(e);
  }
}
