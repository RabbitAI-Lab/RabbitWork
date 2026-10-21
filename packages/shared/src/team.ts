/** team 域 DTO（我的团队；TEAM-001 AgentScope teams 浅映射）。 */
import { z } from "zod";

export const TEAM_MEMBER_ROLES = ["LEADER", "MEMBER"] as const;

/** 运行面同步状态（TEAM-001 §2.1 状态机派生，不入库——由 asTeamId/asSyncError 推导） */
export const TEAM_SYNC_STATES = ["SYNCED", "LOCAL_ONLY", "SYNC_FAILED"] as const;

const teamBaseInput = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).optional(),
  goal: z.string().trim().max(1024).optional(),
});

export const teamCreateInput = teamBaseInput.extend({
  /** 创建时即指定 TL（已发布员工）并同步运行面；缺省不同步（TEAM-001 §2.2.1） */
  leaderEmployeeId: z.string().min(1).optional(),
  syncToRuntime: z.boolean().optional(),
});
export type TeamCreateInput = z.infer<typeof teamCreateInput>;

export const teamUpdateInput = teamBaseInput.partial();
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
  /** 运行面映射（TEAM-001）：关联 id / 最近同步时间 / 最近失败原因 / 派生状态 */
  asTeamId: z.string().nullable(),
  asSyncedAt: z.string().nullable(),
  asSyncError: z.string().nullable(),
  syncState: z.enum(TEAM_SYNC_STATES),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TeamDto = z.infer<typeof teamDto>;

export const teamDetailDto = teamDto.extend({
  members: z.array(teamMemberDto),
});
export type TeamDetailDto = z.infer<typeof teamDetailDto>;

/** agent-tasks 只读条目（TEAM-001 §4.1 R-TASK-SHAPE：上游形状未冻结，字段可空） */
export const teamTaskDto = z.object({
  id: z.string(),
  title: z.string().nullable(),
  status: z.string().nullable(),
  assignee: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type TeamTaskDto = z.infer<typeof teamTaskDto>;

export const teamTasksResultDto = z.object({
  items: z.array(teamTaskDto),
  /** true = 上游不可用，返回降级空列表（TEAM-001 §2.3） */
  degraded: z.boolean(),
});
export type TeamTasksResultDto = z.infer<typeof teamTasksResultDto>;
