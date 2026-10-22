/** 资源域（技能/知识库）DTO 与绑定契约（zod，门禁 4：单一来源）。
 *  对应模型 SkillDefinition / KnowledgeBase / EmployeeResourceBinding（schema 已一次建齐）。 */
import { z } from "zod";

export const RESOURCE_TYPES = ["SKILL", "KNOWLEDGE"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const SKILL_KINDS = ["PROMPT", "SOP"] as const;
export const KB_STATUSES = ["ACTIVE", "DISABLED"] as const;

// ───── 技能（SkillDefinition）─────

export const skillCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).optional(),
  kind: z.enum(SKILL_KINDS).default("PROMPT"),
  promptTemplate: z.string().trim().max(20000).optional(),
  /** SOP 图（SKILL-002;kind=SOP 时必填,结构校验在路由经 sopGraphSchema） */
  sopGraph: z.unknown().optional(),
});
export type SkillCreateInput = z.infer<typeof skillCreateInput>;

export const skillUpdateInput = skillCreateInput.partial();
export type SkillUpdateInput = z.infer<typeof skillUpdateInput>;

export const skillDto = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  kind: z.enum(SKILL_KINDS),
  sopGraph: z.unknown().nullable(),
  promptTemplate: z.string().nullable(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SkillDto = z.infer<typeof skillDto>;

// ───── 知识库（KnowledgeBase）─────

export const kbCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).optional(),
});
export type KbCreateInput = z.infer<typeof kbCreateInput>;

export const kbUpdateInput = kbCreateInput.partial();
export type KbUpdateInput = z.infer<typeof kbUpdateInput>;

export const kbDto = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(KB_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  documentCount: z.number(),
  chunkCount: z.number(),
});
export type KbDto = z.infer<typeof kbDto>;

// ───── 员工资源绑定（EmployeeResourceBinding）─────

export const staffResourcesPutInput = z.object({
  skillIds: z.array(z.string()).max(200),
  knowledgeBaseIds: z.array(z.string()).max(200),
});
export type StaffResourcesPutInput = z.infer<typeof staffResourcesPutInput>;

export const staffResourcesDto = z.object({
  skills: z.array(skillDto),
  knowledgeBases: z.array(kbDto),
});
export type StaffResourcesDto = z.infer<typeof staffResourcesDto>;
