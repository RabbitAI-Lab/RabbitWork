import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 吊销（revokedAt 落库,Key 立即失效）。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_APIKEY:MANAGE");
    const { id } = await ctx.params;
    const row = await prisma.apiKey.findFirst({ where: { id, orgId: defaultOrgId() } });
    if (!row) throw new DomainError(ErrCode.NOT_FOUND, "Key 不存在");
    if (row.revokedAt) return jsonOk({ ok: true });
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    void audit({ actorId: user.uid, action: "key.revoke", targetType: "api_key", targetId: id });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
