/** TEAM-001 运行面同步编排：解析 TL → ensureTeam → 回写映射列。
 *  上游失败不抛出（本地为主数据，TEAM-001 §2.2），失败原因落 asSyncError 由前端横幅透出。 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { getAgentScope } from "@/server/agentscope";
import { MEMBERS_INCLUDE, toSyncErrorText } from "@/server/team-dto";

type TeamRow = Prisma.TeamGetPayload<{ include: typeof MEMBERS_INCLUDE }>;

/**
 * 同步指定团队到 AgentScope 运行面（建/改归一 ensureTeam；同名冲突回写在 Provider 内处理）。
 * 无 TL 或 TL 无运行面身份（asAgentId 空）→ 不动上游，原样返回（LOCAL_ONLY）。
 */
export async function syncTeamRuntime(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { include: { employee: true } } },
  });
  if (!team || team.deletedAt) return null;
  const leaderAgentId =
    team.members.find((m) => m.role === "LEADER")?.employee.asAgentId ?? null;
  if (!leaderAgentId) return team;

  try {
    const r = await getAgentScope().ensureTeam({
      name: team.name,
      leaderAgentId,
      asTeamId: team.asTeamId,
    });
    return await prisma.team.update({
      where: { id: teamId },
      data: { asTeamId: r.teamId, asSyncedAt: new Date(), asSyncError: null },
      include: MEMBERS_INCLUDE,
    });
  } catch (e) {
    return await prisma.team.update({
      where: { id: teamId },
      data: { asSyncError: toSyncErrorText(e) },
      include: MEMBERS_INCLUDE,
    });
  }
}
