import { DomainError, ErrCode, kbUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toKbDto } from "@/server/resource-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findKb(id: string) {
  const row = await prisma.knowledgeBase.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "知识库不存在");
  return row;
}

/** 知识库更新/删除（软删，RESOURCE-001）。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findKb(id);
    const input = await parseBody(req, kbUpdateInput);
    const row = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      },
    });
    return jsonOk(toKbDto(row));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findKb(id);
    await prisma.$transaction([
      prisma.employeeResourceBinding.deleteMany({ where: { resourceId: id, resourceType: "KNOWLEDGE" } }),
      prisma.knowledgeBase.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
