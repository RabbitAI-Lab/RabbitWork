import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, teamUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { MEMBERS_INCLUDE, toTeamDetailDto } from "@/server/team-dto";
import { syncTeamRuntime } from "@/server/team-sync";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findTeam(id: string) {
  const team = await prisma.team.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
    include: MEMBERS_INCLUDE,
  });
  if (!team) throw new DomainError(ErrCode.NOT_FOUND, "团队不存在");
  return team;
}

/** 团队详情(含成员)。 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_TEAM:READ");
    const { id } = await ctx.params;
    return jsonOk(toTeamDetailDto(await findTeam(id)));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_TEAM:UPDATE");
    const { id } = await ctx.params;
    await findTeam(id);
    const input = await parseBody(req, teamUpdateInput);
    try {
      await prisma.team.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.goal !== undefined ? { goal: input.goal ?? null } : {}),
        },
      });
      // 改名影响上游团队标识（TEAM-001 §2.2.2）：asTeamId 已关联或已有 TL 时同步运行面
      const synced = input.name !== undefined ? await syncTeamRuntime(id) : null;
      const final = synced ?? (await findTeam(id));
      return jsonOk(toTeamDetailDto(final));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, `团队名「${input.name}」已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 软删除。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_TEAM:DELETE");
    const { id } = await ctx.params;
    await findTeam(id);
    await prisma.team.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    void audit({ actorId: user.uid, action: "team.delete", targetType: "team", targetId: id });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
