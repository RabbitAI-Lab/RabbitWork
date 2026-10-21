import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, MASKED_HEADER_PLACEHOLDER, toolUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { decryptJson } from "@/server/secure-headers";
import { encodeSecureHeaders, splitHeaders, toToolDto } from "@/server/tool-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findTool(id: string) {
  const row = await prisma.toolDefinition.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "工具不存在");
  return row;
}

/**
 * 编辑（headers 整组替换语义；敏感头值为掩码占位 = 保留旧密文值——
 * 前端回显掩码,用户不改则原样传回,不触发重加密）。
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const existing = await findTool(id);
    const input = await parseBody(req, toolUpdateInput);

    let headersJson: Record<string, string> | undefined;
    let secureHeaders: string | null | undefined;
    if (input.headers !== undefined) {
      const kept: Record<string, string> = {};
      const oldSecure = existing.secureHeaders
        ? (decryptJson<Record<string, string>>(existing.secureHeaders) ?? {})
        : {};
      for (const [k, v] of Object.entries(input.headers)) {
        if (v === MASKED_HEADER_PLACEHOLDER && oldSecure[k] !== undefined) {
          kept[k] = oldSecure[k]!; // 掩码占位=沿用旧明文（不重加密）
          delete oldSecure[k];
        } else {
          kept[k] = v;
        }
      }
      const { plain, secure } = splitHeaders(kept);
      headersJson = plain;
      secureHeaders = Object.keys(secure).length > 0 ? encodeSecureHeaders(secure) : null;
    }

    try {
      const row = await prisma.toolDefinition.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.method !== undefined ? { method: input.method } : {}),
          ...(input.url !== undefined ? { url: input.url } : {}),
          ...(headersJson !== undefined ? { headersJson } : {}),
          ...(secureHeaders !== undefined ? { secureHeaders } : {}),
        },
      });
      return jsonOk(toToolDto(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, `工具名「${input.name}」已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 软删。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findTool(id);
    await prisma.toolDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED" },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
