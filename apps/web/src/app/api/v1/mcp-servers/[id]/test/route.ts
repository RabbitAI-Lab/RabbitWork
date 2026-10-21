import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { guardedFetch } from "@/server/outbound";
import { logger } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 10_000;
const BODY_TRUNCATE = 2048;

type Ctx = { params: Promise<{ id: string }> };

/** 连通性测试（TOOL-002 §2）：streamable_http/sse 经出站守卫 ping（用户配置目标类）。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const mcp = await prisma.mcpServerConfig.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!mcp) throw new DomainError(ErrCode.NOT_FOUND, "MCP 服务不存在");
    if (mcp.transport === "builtin") {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "builtin 传输无外部 endpoint 可测试");
    }

    const started = Date.now();
    let res: Awaited<ReturnType<typeof guardedFetch>>;
    try {
      res = await guardedFetch(mcp.endpoint, {
        method: "GET",
        headers: { Accept: "application/json, text/event-stream" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DomainError(ErrCode.VALIDATION_FAILED, `连通失败：${msg}`);
    }
    const raw = await res.text();
    logger.info({ userId: user.uid, mcpId: id, module: "mcp" }, "mcp connectivity test");
    return jsonOk({
      status: res.status,
      tookMs: Date.now() - started,
      bodyText: raw.slice(0, BODY_TRUNCATE),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
