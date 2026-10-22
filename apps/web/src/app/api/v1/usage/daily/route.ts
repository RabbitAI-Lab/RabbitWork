import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseQuery, toErrorResponse } from "@/server/http";
import { usageQuery, type UsageDayDto, type UsageTopEmployeeDto } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 用量日聚合（OBS-002 §2.1 读取面：按天 + Top 员工,Prisma groupBy）。 */
export async function GET(req: Request) {
  try {
    await requirePermission("ORG_RUN:READ");
    const { days } = parseQuery(req, usageQuery);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const where = { orgId: defaultOrgId(), day: { gte: since } };

    const [byDayRaw, byEmployeeRaw] = await Promise.all([
      prisma.usageDaily.groupBy({
        by: ["day"],
        where,
        _sum: { runs: true, tokenIn: true, tokenOut: true },
        orderBy: { day: "asc" },
      }),
      prisma.usageDaily.groupBy({
        by: ["employeeId"],
        where,
        _sum: { runs: true, tokenIn: true, tokenOut: true },
        orderBy: { _sum: { tokenIn: "desc" } },
        take: 5,
      }),
    ]);
    const days2: UsageDayDto[] = byDayRaw.map((d) => ({
      day: d.day.toISOString().slice(0, 10),
      runs: d._sum.runs ?? 0,
      tokenIn: d._sum.tokenIn ?? 0,
      tokenOut: d._sum.tokenOut ?? 0,
    }));
    const empIds = byEmployeeRaw.map((e) => e.employeeId);
    const employees = empIds.length
      ? await prisma.digitalEmployee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(employees.map((e) => [e.id, e.name]));
    const topEmployees: UsageTopEmployeeDto[] = byEmployeeRaw.map((e) => ({
      employeeId: e.employeeId,
      employeeName: nameMap.get(e.employeeId) ?? "已删除员工",
      runs: e._sum.runs ?? 0,
      tokenTotal: (e._sum.tokenIn ?? 0) + (e._sum.tokenOut ?? 0),
    }));
    return jsonOk({ days: days2, topEmployees });
  } catch (e) {
    return toErrorResponse(e);
  }
}
