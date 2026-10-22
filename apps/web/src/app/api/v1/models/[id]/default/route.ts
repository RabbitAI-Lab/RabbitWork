import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { toModelDto } from "@/server/model-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 设为默认（org 内互斥,MODEL-001 §2.3）。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const exists = await prisma.modelConfig.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!exists) throw new DomainError(ErrCode.NOT_FOUND, "模型不存在");
    const row = await prisma.$transaction(async (tx) => {
      await tx.modelConfig.updateMany({
        where: { orgId: defaultOrgId(), isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      return tx.modelConfig.update({ where: { id }, data: { isDefault: true } });
    });
    return jsonOk(toModelDto(row));
  } catch (e) {
    return toErrorResponse(e);
  }
}
