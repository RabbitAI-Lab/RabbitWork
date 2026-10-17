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
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toKbDto(row: KnowledgeBase): KbDto {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    status: row.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
