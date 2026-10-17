/** team 域 DTO 映射与成员查询 include(路由共用)。 */
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
