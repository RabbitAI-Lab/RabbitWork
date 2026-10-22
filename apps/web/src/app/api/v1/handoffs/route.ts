import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { HANDOFF_STATUSES } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const queryInput = z.object({
  status: z.enum(HANDOFF_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** 接管工作台列表（CHAT-003 §1.4-C3）。 */
export async function GET(req: Request) {
  try {
    await requirePermission("ORG_CHAT:READ");
    const url = new URL(req.url);
    const parsed = queryInput.parse({
      status: url.searchParams.get("status") ?? undefined,
      page: url.searchParams.get("page") ?? 1,
      pageSize: url.searchParams.get("pageSize") ?? 20,
    });
    const where = {
      ...(parsed.status ? { status: parsed.status } : { status: { not: "RESOLVED" as const } }),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.humanHandoffRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
      }),
      prisma.humanHandoffRecord.count({ where }),
    ]);
    const convIds = [...new Set(rows.map((r) => r.conversationId))];
    const convs = convIds.length
      ? await prisma.conversation.findMany({
          where: { id: { in: convIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleMap = new Map(convs.map((c) => [c.id, c.title]));
    return jsonOk({
      items: rows.map((r) => ({
        id: r.id,
        conversationId: r.conversationId,
        conversationTitle: titleMap.get(r.conversationId) ?? "已删除会话",
        status: r.status,
        initiatedBy: r.initiatedBy,
        handledBy: r.handledBy,
        reason: r.reason,
        conclusion: (r as { conclusion?: string | null }).conclusion ?? null,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
