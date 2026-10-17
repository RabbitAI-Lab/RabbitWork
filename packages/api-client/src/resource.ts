/** 资源域（技能/知识库/员工绑定）API（RESOURCE-001）。 */
import { del, get, patch, post, put } from "./client";
import type { KbCreateInput, KbDto, KbUpdateInput, SkillCreateInput, SkillDto, SkillUpdateInput, StaffResourcesDto } from "@rabbit/shared";
import type { PageResult } from "./staff";

export const skillApi = {
  list: () => get<PageResult<SkillDto>>("/api/v1/skills"),
  create: (input: SkillCreateInput) => post<SkillDto>("/api/v1/skills", input),
  update: (id: string, input: SkillUpdateInput) => patch<SkillDto>(`/api/v1/skills/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/skills/${id}`),
};

export const kbApi = {
  list: () => get<PageResult<KbDto>>("/api/v1/knowledge-bases"),
  create: (input: KbCreateInput) => post<KbDto>("/api/v1/knowledge-bases", input),
  update: (id: string, input: KbUpdateInput) => patch<KbDto>(`/api/v1/knowledge-bases/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/knowledge-bases/${id}`),
};

export const staffResourceApi = {
  get: (staffId: string) => get<StaffResourcesDto>(`/api/v1/staffs/${staffId}/resources`),
  put: (staffId: string, input: { skillIds: string[]; knowledgeBaseIds: string[] }) =>
    put<{ ok: boolean }>(`/api/v1/staffs/${staffId}/resources`, input),
};
