/** knowledge 域 zod + 切片/检索纯函数（KNW-001；蓝图 S3，§9-R3 关键词降级口径）。 */
import { z } from "zod";

// ───── 文档（摄取状态机：PENDING → INGESTING → READY | FAILED） ─────

export const KB_DOC_STATUSES = ["PENDING", "INGESTING", "READY", "FAILED"] as const;
export const KB_FILE_LIMIT_BYTES = 2 * 1024 * 1024; // ≤2MB（同步摄取上限，规格 §2.4 R-CONCURRENCY）
export const KB_FILE_EXTENSIONS = [".md", ".txt"] as const;

export const kbDocumentDto = z.object({
  id: z.string(),
  baseId: z.string(),
  title: z.string(),
  status: z.enum(KB_DOC_STATUSES),
  chunkCount: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type KbDocumentDto = z.infer<typeof kbDocumentDto>;

// ───── 检索（多词 AND，ILIKE 切片级） ─────

export const kbRetrieveInput = z.object({
  query: z.string().trim().min(1).max(256),
  topK: z.number().int().min(1).max(32).default(8),
});
export type KbRetrieveInput = z.infer<typeof kbRetrieveInput>;

export const kbRetrieveHitDto = z.object({
  documentId: z.string(),
  documentTitle: z.string(),
  seq: z.number(),
  snippet: z.string(),
});
export type KbRetrieveHitDto = z.infer<typeof kbRetrieveHitDto>;

export const kbRetrieveResultDto = z.object({
  items: z.array(kbRetrieveHitDto),
  total: z.number(),
  tookMs: z.number(),
});
export type KbRetrieveResultDto = z.infer<typeof kbRetrieveResultDto>;

// ───── 员工绑定 ─────

export const kbBindingsInput = z.object({
  kbIds: z.array(z.string().min(1)).max(32),
});
export type KbBindingsInput = z.infer<typeof kbBindingsInput>;

// ───── 纯函数（单测锚点，规格 §4.2） ─────

/**
 * 按字符切片（中文友好；无语义切分——关键词检索不依赖语义边界）。
 * 尾片短于 overlap 时并入前片，避免无信息小片。
 */
export function chunkText(text: string, opts: { size?: number; overlap?: number } = {}): string[] {
  const size = opts.size ?? 800;
  const overlap = opts.overlap ?? 100;
  const step = Math.max(1, size - overlap);
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length === 0) return [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += step) {
    chunks.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1]!;
    if (last.length < overlap) {
      chunks.splice(chunks.length - 2, 2, chunks[chunks.length - 2]! + last);
    }
  }
  return chunks;
}

/** 检索词解析：空白切词、去重保序、≤8 词、每词截断 64（规格 §2.2）。 */
export function parseQuery(query: string): string[] {
  const seen = new Set<string>();
  for (const raw of query.split(/\s+/u)) {
    const w = raw.slice(0, 64);
    if (w.length > 0 && !seen.has(w)) seen.add(w);
    if (seen.size >= 8) break;
  }
  return [...seen];
}
