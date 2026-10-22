/** 资源域 DTO 映射（Prisma → API DTO）。 */
import type { KnowledgeBase, SkillDefinition } from "@prisma/client";
import type { KbDto, SkillDto } from "@rabbit/shared";

export function toSkillDto(row: SkillDefinition): SkillDto {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    kind: row.kind === "SOP" ? "SOP" : "PROMPT",
    promptTemplate: row.promptTemplate,
    sopGraph: (row as { sopGraph?: unknown }).sopGraph ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** counts 由调用方经 groupBy 提供（KNW-001 列表统计；缺省 0/0——单条详情场景） */
export function toKbDto(
  row: KnowledgeBase,
  counts: { documentCount?: number; chunkCount?: number } = {},
): KbDto {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    status: row.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    documentCount: counts.documentCount ?? 0,
    chunkCount: counts.chunkCount ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
