import { DomainError, ErrCode, renderTemplate, toolTestRunInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { decryptJson } from "@/server/secure-headers";
import { guardedFetch } from "@/server/outbound";
import { logger } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_TRUNCATE_BYTES = 4096;
const TIMEOUT_MS = 10_000;

type Ctx = { params: Promise<{ id: string }> };

/**
 * 试运行（TOOL-001 §2.2）：URL {{占位}} 渲染 → 出站守卫 dispatcher 真实调用
 * → 状态/耗时/截断响应体。目标 URL 属用户配置目标（rules/security §3.4 第二类）。
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const tool = await prisma.toolDefinition.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!tool) throw new DomainError(ErrCode.NOT_FOUND, "工具不存在");
    const input = await parseBody(req, toolTestRunInput);

    let url: string;
    try {
      url = renderTemplate(tool.url, input.params);
    } catch (e) {
      throw new DomainError(ErrCode.VALIDATION_FAILED, e instanceof Error ? e.message : String(e));
    }

    const plainHeaders = (tool.headersJson as Record<string, string> | null) ?? {};
    const secureHeaders = tool.secureHeaders
      ? (decryptJson<Record<string, string>>(tool.secureHeaders) ?? {})
      : {};
    const headers = { ...plainHeaders, ...secureHeaders };
    const hasBody = ["POST", "PUT", "PATCH"].includes(tool.method);

    const started = Date.now();
    let res: Awaited<ReturnType<typeof guardedFetch>>;
    try {
      res = await guardedFetch(url, {
        method: tool.method,
        headers: hasBody || Object.keys(headers).length > 0 ? headers : undefined,
        body: hasBody && input.body !== undefined ? JSON.stringify(input.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      // 守卫拒绝/超时/网络错误——真实原因透出（§5.7）
      const msg = e instanceof Error ? e.message : String(e);
      throw new DomainError(ErrCode.VALIDATION_FAILED, `试运行失败：${msg}`);
    }
    const raw = await res.text();
    const truncated = raw.length > BODY_TRUNCATE_BYTES;
    logger.info({ userId: user.uid, toolId: id, module: "tool" }, "tool test run");
    return jsonOk({
      status: res.status,
      tookMs: Date.now() - started,
      truncated,
      bodyText: truncated ? raw.slice(0, BODY_TRUNCATE_BYTES) : raw,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
