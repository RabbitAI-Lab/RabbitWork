import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, kbCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toKbDto } from "@/server/resource-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 知识库列表 + 创建（RESOURCE-001）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.knowledgeBase.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk({ items: rows.map(toKbDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, kbCreateInput);
    const row = await prisma.knowledgeBase.create({
      data: {
        orgId: defaultOrgId(),
        name: input.name,
        description: input.description ?? null,
      },
    });
    return jsonOk(toKbDto(row), { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
