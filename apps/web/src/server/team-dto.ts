/** team 域 DTO 映射与成员查询 include(路由共用)；TEAM-001 运行面同步态派生。 */
import { Prisma } from "@prisma/client";
import type { TeamDetailDto, TeamDto, TeamMemberDto } from "@rabbit/shared";

export const MEMBERS_INCLUDE = {
  members: {
    include: { employee: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }] as const,
  },
} satisfies Prisma.TeamInclude;

type TeamWithMembers = Prisma.TeamGetPayload<{ include: typeof MEMBERS_INCLUDE }>;

function toMemberDto(m: TeamWithMembers["members"][number]): TeamMemberDto {
  return {
    employeeId: m.employeeId,
    employeeName: m.employee.name,
    employeeTitle: m.employee.title,
    employeeStatus: m.employee.status,
    role: m.role as "LEADER" | "MEMBER",
    joinedAt: m.createdAt.toISOString(),
  };
}

/** 同步状态派生（TEAM-001 §2.1 状态机；纯函数供单测）。
 *  asSyncError 仅在「尝试过且失败」时存在（成功即清空）→ 有错误即 SYNC_FAILED；
 *  无错误无 asTeamId = 从未推送（LOCAL_ONLY）。 */
export function deriveSyncState(team: {
  asTeamId: string | null;
  asSyncError: string | null;
}): "SYNCED" | "LOCAL_ONLY" | "SYNC_FAILED" {
  if (team.asSyncError) return "SYNC_FAILED";
  if (!team.asTeamId) return "LOCAL_ONLY";
  return "SYNCED";
}

/** 同步失败原因归一（AgentScopeError → 截断 512 落库；不含凭据——client 层已截断 body） */
export function toSyncErrorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : e instanceof Object ? JSON.stringify(e) : String(e);
  return raw.slice(0, 512);
}

export function toTeamDto(team: TeamWithMembers): TeamDto {
  const members = team.members.map(toMemberDto);
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    goal: team.goal,
    status: team.status,
    memberCount: members.length,
    leaderName: members.find((m) => m.role === "LEADER")?.employeeName ?? null,
    asTeamId: team.asTeamId,
    asSyncedAt: team.asSyncedAt?.toISOString() ?? null,
    asSyncError: team.asSyncError,
    syncState: deriveSyncState(team),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

export function toTeamDetailDto(team: TeamWithMembers): TeamDetailDto {
  const members = team.members.map(toMemberDto);
  return {
    ...toTeamDto(team),
    members,
  };
}
