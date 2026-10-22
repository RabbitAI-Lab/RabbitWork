import { DomainError, ErrCode, pageQuery } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseQuery, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 运行历史（CRON-001 §3 行展开）。 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const { id } = await ctx.params;
    const task = await prisma.scheduledTask.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!task) throw new DomainError(ErrCode.NOT_FOUND, "任务不存在");
    const { page, pageSize } = parseQuery(req, pageQuery);
    const [rows, total] = await prisma.$transaction([
      prisma.scheduledTaskRun.findMany({
        where: { taskId: id },
        orderBy: { startedAt: "desc" as never },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scheduledTaskRun.count({ where: { taskId: id } }),
    ]);
    return jsonOk({
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt?.toISOString() ?? null,
        finishedAt: r.finishedAt?.toISOString() ?? null,
        error: r.error,
      })),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
