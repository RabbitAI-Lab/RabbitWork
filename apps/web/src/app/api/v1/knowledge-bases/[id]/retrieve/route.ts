import type { Prisma } from "@prisma/client";
import {
  DomainError,
  ErrCode,
  kbRetrieveInput,
  parseQuery,
  type KbRetrieveHitDto,
} from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 切片级关键词检索（KNW-001 §2.2：多词 AND / ILIKE / 稳定序 / topK≤32）。
 * 中文分词局限见规格 R-TOKENIZE——向量检索随 MODEL-001（R-VECTOR）。
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const { id } = await ctx.params;
    const base = await prisma.knowledgeBase.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!base) throw new DomainError(ErrCode.NOT_FOUND, "知识库不存在");
    const input = await parseBody(req, kbRetrieveInput);

    const words = parseQuery(input.query);
    const started = Date.now();
    const where: Prisma.KnowledgeChunkWhereInput = {
      baseId: id,
      document: { status: "READY" },
      AND: words.map((w) => ({ content: { contains: w, mode: "insensitive" } })),
    };
    const [rows, total] = await Promise.all([
      prisma.knowledgeChunk.findMany({
        where,
        orderBy: [{ documentId: "asc" }, { seq: "asc" }],
        take: input.topK,
        include: { document: { select: { title: true } } },
      }),
      prisma.knowledgeChunk.count({ where }),
    ]);
    const items: KbRetrieveHitDto[] = rows.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.document.title,
      seq: r.seq,
      snippet: r.content.slice(0, 200),
    }));
    return jsonOk({ items, total, tookMs: Date.now() - started });
  } catch (e) {
    return toErrorResponse(e);
  }
}
