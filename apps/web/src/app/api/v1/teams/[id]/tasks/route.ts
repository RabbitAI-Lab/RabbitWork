import { DomainError, ErrCode } from "@rabbit/shared";
import { getAgentScope } from "@/server/agentscope";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { toSyncErrorText } from "@/server/team-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 团队任务只读视图（TEAM-001 §2.2.5）：代理 AgentScope agent-tasks。
 * 未同步团队（LOCAL_ONLY）→ 空列表；上游失败 → 降级空列表 + degraded=true（不阻塞页面）。
 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_TEAM:READ");
    const { id } = await ctx.params;
    const team = await prisma.team.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
      select: { asTeamId: true },
    });
    if (!team) throw new DomainError(ErrCode.NOT_FOUND, "团队不存在");
    if (!team.asTeamId) {
      return jsonOk({ items: [], degraded: false });
    }
    try {
      const items = await getAgentScope().listAgentTasks(team.asTeamId);
      return jsonOk({ items, degraded: false });
    } catch (e) {
      // 上游不可用：降级空列表（页面横幅提示），失败原因不落库（读路径，TEAM-001 §2.3）
      return jsonOk({ items: [], degraded: true, error: toSyncErrorText(e) });
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
