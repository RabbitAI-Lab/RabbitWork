import { DomainError, ErrCode, apiKeyCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { generateApiKey } from "@/server/api-key";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Key 列表（OBS-003 §1.4-C2;前缀展示,永不回显明文）。 */
export async function GET() {
  try {
    await requirePermission("ORG_APIKEY:MANAGE");
    const rows = await prisma.apiKey.findMany({
      where: { orgId: defaultOrgId() },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk({
      items: rows.map((k) => ({
        id: k.id,
        name: k.name,
        scope: k.scope,
        keyPrefix: k.keyPrefix,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
      total: rows.length,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 创建 Key（明文一次性返回,pepper 摘要落库）。 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("ORG_APIKEY:MANAGE");
    const input = await parseBody(req, apiKeyCreateInput);
    const dup = await prisma.apiKey.findFirst({
      where: { orgId: defaultOrgId(), name: input.name, revokedAt: null },
    });
    if (dup) throw new DomainError(ErrCode.VALIDATION_FAILED, "同名的有效 Key 已存在");
    const generated = generateApiKey();
    const row = await prisma.apiKey.create({
      data: {
        orgId: defaultOrgId(),
        name: input.name,
        scope: "ACCOUNT",
        keyPrefix: generated.keyPrefix,
        pepperHash: generated.pepperHash,
        ...(input.expiresInDays
          ? { expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000) }
          : {}),
      },
    });
    void audit({
      actorId: user.uid,
      action: "key.create",
      targetType: "api_key",
      targetId: row.id,
    });
    return jsonOk(
      {
        id: row.id,
        name: row.name,
        scope: row.scope,
        keyPrefix: row.keyPrefix,
        lastUsedAt: null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        revokedAt: null,
        createdAt: row.createdAt.toISOString(),
        plaintext: generated.plaintext,
      },
      { status: 201 },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
