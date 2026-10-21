import { DomainError, ErrCode } from "@rabbit/shared";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { toTeamDetailDto } from "@/server/team-dto";
import { syncTeamRuntime } from "@/server/team-sync";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 手动同步/重试（TEAM-001 §2.2.4）：asTeamId 空 → 上游建队；非空 → 更新。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_TEAM:UPDATE");
    const { id } = await ctx.params;
    const exists = await prisma.team.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new DomainError(ErrCode.NOT_FOUND, "团队不存在");
    const team = await syncTeamRuntime(id);
    return jsonOk(toTeamDetailDto(team!));
  } catch (e) {
    return toErrorResponse(e);
  }
}
