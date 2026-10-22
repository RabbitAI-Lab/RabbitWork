import {
  DomainError,
  ErrCode,
  buildVerifyRequest,
  type ModelVerifyResultDto,
} from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { decryptText } from "@/server/model-secret";
import { guardedFetch } from "@/server/outbound";
import { logger } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;

type Ctx = { params: Promise<{ id: string }> };

/**
 * 一键验证（MODEL-001 §2.2）：按协议构造最小 chat → 经出站守卫真调 →
 * VERIFIED（耗时+回复摘要）/ FAILED（HTTP 非 2xx 或网络错误,原因透出）。
 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const m = await prisma.modelConfig.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!m) throw new DomainError(ErrCode.NOT_FOUND, "模型不存在");
    const apiKey = decryptText(m.apiKeyEnc);
    if (!apiKey) {
      throw new DomainError(ErrCode.INTERNAL, "凭据解密失败（密钥轮换?）——请重新编辑保存 apiKey");
    }

    const req = buildVerifyRequest(
      m.protocol as "openai_chat_completions",
      m.baseUrl,
      m.modelId,
      apiKey,
    );
    const started = Date.now();
    let result: ModelVerifyResultDto;
    try {
      const res = await guardedFetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) {
        result = {
          status: "VERIFIED",
          tookMs: Date.now() - started,
          replySnippet: text.slice(0, 200) || null,
          error: null,
        };
        await prisma.modelConfig.update({
          where: { id },
          data: { status: "VERIFIED", lastError: null, lastVerifiedAt: new Date() },
        });
      } else {
        const reason = `HTTP ${res.status}：${text.slice(0, 200)}`;
        result = {
          status: "FAILED",
          tookMs: Date.now() - started,
          replySnippet: null,
          error: reason,
        };
        await prisma.modelConfig.update({
          where: { id },
          data: { status: "FAILED", lastError: reason.slice(0, 512) },
        });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      result = {
        status: "FAILED",
        tookMs: Date.now() - started,
        replySnippet: null,
        error: reason,
      };
      await prisma.modelConfig.update({
        where: { id },
        data: { status: "FAILED", lastError: reason.slice(0, 512) },
      });
    }
    logger.info({ userId: user.uid, modelId: id, module: "model" }, "model verify");
    return jsonOk(result);
  } catch (e) {
    return toErrorResponse(e);
  }
}
