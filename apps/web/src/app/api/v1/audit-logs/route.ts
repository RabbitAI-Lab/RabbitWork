import { DomainError, ErrCode, pageQuery } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { jsonOk, parseQuery, toErrorResponse } from "@/server/http";
import type { AuditLogDto } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 审计日志列表（OBS-002 §2.3：仅 ADMIN——审计敏感面不适用 MEMBER :READ 白名单）。 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      throw new DomainError(ErrCode.FORBIDDEN, "审计日志仅管理员可查看");
    }
    const { page, pageSize } = parseQuery(req, pageQuery);
    const [rows, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          actorId: true,
          action: true,
          targetType: true,
          targetId: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count(),
    ]);
    const items: AuditLogDto[] = rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      createdAt: r.createdAt.toISOString(),
    }));
    return jsonOk({ items, total, page, pageSize });
  } catch (e) {
    return toErrorResponse(e);
  }
}
