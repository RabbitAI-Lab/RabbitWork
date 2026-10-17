import { Prisma } from "@prisma/client";
import { pageQuery } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, parseQuery, toErrorResponse } from "@/server/http";
import { toConversationDto } from "@/server/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CHAT-001：当前用户会话列表。 */
export async function GET(req: Request) {
  try {
    const user = await requirePermission("ORG_CHAT:READ");
    const { page, pageSize } = parseQuery(req, pageQuery);
    const where: Prisma.ConversationWhereInput = {
      userId: user.uid,
      deletedAt: null,
      ...(employeeIdParam(req) ? { employeeId: employeeIdParam(req)! } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { employee: true },
      }),
      prisma.conversation.count({ where }),
    ]);
    return jsonOk({
      items: rows.map((c) => toConversationDto(c, c.employee)),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

function employeeIdParam(req: Request): string | null {
  return new URL(req.url).searchParams.get("employeeId");
}
