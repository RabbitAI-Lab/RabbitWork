import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; docId: string }> };

/** 删除文档（切片级联）。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id, docId } = await ctx.params;
    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: docId, baseId: id, base: { orgId: defaultOrgId(), deletedAt: null } },
    });
    if (!doc) throw new DomainError(ErrCode.NOT_FOUND, "文档不存在");
    await prisma.knowledgeDocument.delete({ where: { id: docId } });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
