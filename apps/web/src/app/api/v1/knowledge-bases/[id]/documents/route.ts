import {
  chunkText,
  DomainError,
  ErrCode,
  KB_FILE_EXTENSIONS,
  KB_FILE_LIMIT_BYTES,
} from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import type { KbDocumentDto } from "@rabbit/shared";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function toDocDto(
  row: {
    id: string;
    baseId: string;
    title: string;
    status: string;
    error: string | null;
    createdAt: Date;
  },
  chunkCount: number,
): KbDocumentDto {
  return {
    id: row.id,
    baseId: row.baseId,
    title: row.title,
    status: row.status as KbDocumentDto["status"],
    chunkCount,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 文档列表（含切片数）。 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const { id } = await ctx.params;
    const base = await prisma.knowledgeBase.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!base) throw new DomainError(ErrCode.NOT_FOUND, "知识库不存在");
    const [docs, counts] = await Promise.all([
      prisma.knowledgeDocument.findMany({
        where: { baseId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.knowledgeChunk.groupBy({
        by: ["documentId"],
        where: { baseId: id },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.documentId, c._count._all]));
    return jsonOk({
      items: docs.map((d) => toDocDto(d, countMap.get(d.id) ?? 0)),
      total: docs.length,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/**
 * 上传摄取（KNW-001 §2.1 同步流水线）：multipart file → 校验（类型/大小/UTF-8）
 * → 切片入库 → READY；任一步失败 doc(FAILED+error) 并 422 透出真实原因。
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const base = await prisma.knowledgeBase.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!base) throw new DomainError(ErrCode.NOT_FOUND, "知识库不存在");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "缺少 file 字段（multipart）");
    }
    const lower = file.name.toLowerCase();
    if (!KB_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      throw new DomainError(
        ErrCode.VALIDATION_FAILED,
        `仅支持 ${KB_FILE_EXTENSIONS.join("/")} 文件`,
      );
    }
    if (file.size > KB_FILE_LIMIT_BYTES) {
      throw new DomainError(
        ErrCode.VALIDATION_FAILED,
        `文件超过 ${KB_FILE_LIMIT_BYTES / 1024 / 1024}MB 上限`,
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "文件编码非 UTF-8（仅支持 UTF-8）");
    }

    const doc = await prisma.knowledgeDocument.create({
      data: { baseId: id, title: file.name, status: "INGESTING" },
    });
    try {
      const chunks = chunkText(text);
      const data = chunks.map((content, i) => ({
        documentId: doc.id,
        baseId: id,
        seq: i,
        content,
      }));
      // 分批 ≤1000（rules/database §5.5）
      for (let i = 0; i < data.length; i += 1000) {
        await prisma.knowledgeChunk.createMany({ data: data.slice(i, i + 1000) });
      }
      const ready = await prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: "READY" },
      });
      await prisma.knowledgeIngestJob.create({
        data: {
          baseId: id,
          documentId: doc.id,
          status: "SUCCEEDED",
          progress: chunks.length,
        },
      });
      void audit({
        actorId: user.uid,
        action: "kb.upload",
        targetType: "kb_document",
        targetId: doc.id,
        detail: { title: file.name, chunks: chunks.length },
      });
      return jsonOk(toDocDto(ready, chunks.length), { status: 201 });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      await prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: "FAILED", error: reason.slice(0, 512) },
      });
      await prisma.knowledgeIngestJob.create({
        data: { baseId: id, documentId: doc.id, status: "FAILED", error: reason.slice(0, 512) },
      });
      throw new DomainError(ErrCode.VALIDATION_FAILED, `摄取失败：${reason.slice(0, 200)}`);
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
