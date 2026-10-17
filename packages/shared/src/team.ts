/** team 域 DTO(我的团队;AgentScope teams 运行时映射 S6+ 预留)。 */
import { z } from "zod";

export const TEAM_MEMBER_ROLES = ["LEADER", "MEMBER"] as const;

export const teamCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).optional(),
  goal: z.string().trim().max(1024).optional(),
});
export type TeamCreateInput = z.infer<typeof teamCreateInput>;

export const teamUpdateInput = teamCreateInput.partial();
export type TeamUpdateInput = z.infer<typeof teamUpdateInput>;

export const teamMemberAddInput = z.object({
  employeeId: z.string().min(1),
  role: z.enum(TEAM_MEMBER_ROLES).default("MEMBER"),
});
export type TeamMemberAddInput = z.infer<typeof teamMemberAddInput>;

export const teamMemberDto = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  employeeTitle: z.string(),
  employeeStatus: z.string(),
  role: z.enum(TEAM_MEMBER_ROLES),
  joinedAt: z.string(),
});
export type TeamMemberDto = z.infer<typeof teamMemberDto>;

export const teamDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  goal: z.string().nullable(),
  status: z.string(),
  memberCount: z.number(),
  leaderName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TeamDto = z.infer<typeof teamDto>;

export const teamDetailDto = teamDto.extend({
  members: z.array(teamMemberDto),
});
export type TeamDetailDto = z.infer<typeof teamDetailDto>;
