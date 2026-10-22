import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, MASKED_APIKEY_PLACEHOLDER, modelUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toModelDto } from "@/server/model-dto";
import { encryptText } from "@/server/model-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findModel(id: string) {
  const row = await prisma.modelConfig.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "模型不存在");
  return row;
}

/** 编辑（apiKey 掩码占位=沿用旧密文;改协议/地址/型号将状态重置为 UNVERIFIED）。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const existing = await findModel(id);
    const input = await parseBody(req, modelUpdateInput);
    const connChanged =
      (input.protocol !== undefined && input.protocol !== existing.protocol) ||
      (input.baseUrl !== undefined && input.baseUrl !== existing.baseUrl) ||
      (input.modelId !== undefined && input.modelId !== existing.modelId) ||
      (input.apiKey !== undefined && input.apiKey !== MASKED_APIKEY_PLACEHOLDER);
    const row = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.modelConfig.updateMany({
          where: { orgId: defaultOrgId(), isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.modelConfig.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.protocol !== undefined ? { protocol: input.protocol } : {}),
          ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
          ...(input.modelId !== undefined ? { modelId: input.modelId } : {}),
          ...(input.apiKey !== undefined && input.apiKey !== MASKED_APIKEY_PLACEHOLDER
            ? { apiKeyEnc: encryptText(input.apiKey) }
            : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(connChanged ? { status: "UNVERIFIED", lastError: null, lastVerifiedAt: null } : {}),
        },
      });
    });
    return jsonOk(toModelDto(row));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return toErrorResponse(new DomainError(ErrCode.VALIDATION_FAILED, "模型名已存在"));
    }
    return toErrorResponse(e);
  }
}

/** 软删（默认模型删除后不再有默认——用户显式重设）。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findModel(id);
    await prisma.modelConfig.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED", isDefault: false },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
