import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 广场列表（STAFF-003 §2:GALLERY+PUBLISHED;被复制次数经 audit 聚合）。 */
export async function GET() {
  try {
    await requirePermission("ORG_STAFF:READ");
    const orgId = defaultOrgId();
    const rows = await prisma.digitalEmployee.findMany({
      where: { orgId, visibility: "GALLERY", status: "PUBLISHED", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        title: true,
        personaPrompt: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    const copies = await prisma.auditLog.findMany({
      where: { action: "staff.copy", targetType: "digital_employee" },
      select: { targetId: true },
    });
    const countMap = new Map<string, number>();
    for (const c of copies) {
      if (!c.targetId) continue;
      countMap.set(c.targetId, (countMap.get(c.targetId) ?? 0) + 1);
    }
    return jsonOk({
      items: rows.map((r) => ({
        ...r,
        personaSummary: r.personaPrompt.slice(0, 80),
        personaPrompt: undefined,
        copyCount: countMap.get(r.id) ?? 0,
        createdAt: r.createdAt.toISOString(),
      })),
      total: rows.length,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
