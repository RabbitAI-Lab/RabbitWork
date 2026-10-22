/** 开放 API 鉴权中间件（OBS-003 §2.2;/api/open/v1/** 专用,独立于 session 链路）。 */
import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";
import { toErrorResponse } from "@/server/http";
import { hashEquals, parseBearer, pepperHashOf } from "@/server/api-key";

export interface ApiKeyContext {
  apiKeyId: string;
  orgId: string;
  /** 创建者（审计关联） */
  creatorId: string | null;
}

export async function withApiKey(
  req: Request,
  handler: (ctx: ApiKeyContext) => Promise<Response>,
): Promise<Response> {
  const token = parseBearer(req.headers.get("authorization"));
  if (!token) {
    return toErrorResponse(
      new DomainError(ErrCode.UNAUTHENTICATED, "缺少 Bearer API Key（rw_live_ 前缀）"),
    );
  }
  const pepperHash = pepperHashOf(token);
  // keyPrefix 预筛（列存 rw_live_+7 共 15 字符展示位）→ 常时比较精确匹配
  const prefixFilter = token.slice(0, 15);
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefixFilter },
    take: 10,
  });
  const matched = candidates.find((k) => hashEquals(k.pepperHash, pepperHash));
  if (!matched || matched.revokedAt) {
    void audit({ action: "key.auth_failed", detail: { reason: matched ? "revoked" : "invalid" } });
    return toErrorResponse(new DomainError(ErrCode.UNAUTHENTICATED, "API Key 无效或已吊销"));
  }
  if (matched.expiresAt && matched.expiresAt.getTime() < Date.now()) {
    void audit({ action: "key.auth_failed", detail: { reason: "expired" } });
    return toErrorResponse(new DomainError(ErrCode.UNAUTHENTICATED, "API Key 已过期"));
  }
  // lastUsedAt 异步更新（不阻塞请求）
  void prisma.apiKey
    .update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return handler({ apiKeyId: matched.id, orgId: matched.orgId, creatorId: null });
}
