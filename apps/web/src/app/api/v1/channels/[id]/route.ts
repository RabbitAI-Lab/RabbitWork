import { Prisma } from "@prisma/client";
import { channelUpdateInput, DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findChannel(id: string) {
  const row = await prisma.channelConfig.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "渠道不存在");
  return row;
}

/** 编辑（含启停）。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findChannel(id);
    const input = await parseBody(req, channelUpdateInput);
    const row = await prisma.channelConfig
      .update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.platform !== undefined ? { platform: input.platform } : {}),
          ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        },
      })
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new DomainError(ErrCode.VALIDATION_FAILED, "同名渠道已存在");
        }
        throw e;
      });
    return jsonOk({
      id: row.id,
      name: row.name,
      platform: row.platform,
      employeeId: row.employeeId,
      enabled: row.enabled,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 软删。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findChannel(id);
    await prisma.channelConfig.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
