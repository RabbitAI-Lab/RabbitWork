import { DomainError, ErrCode, teamMemberAddInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { MEMBERS_INCLUDE, toTeamDetailDto } from "@/server/team-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 添加成员(LEADER 唯一:再设 LEADER 时原队长自动转为 MEMBER)。 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_TEAM:UPDATE");
    const { id } = await ctx.params;
    const team = await prisma.team.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!team) throw new DomainError(ErrCode.NOT_FOUND, "团队不存在");
    const input = await parseBody(req, teamMemberAddInput);

    const employee = await prisma.digitalEmployee.findFirst({
      where: { id: input.employeeId, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!employee) throw new DomainError(ErrCode.NOT_FOUND, "数字员工不存在");
    if (employee.status !== "PUBLISHED") {
      throw new DomainError(ErrCode.STAFF_NOT_PUBLISHED, "仅已发布员工可入队");
    }

    await prisma.$transaction(async (tx) => {
      if (input.role === "LEADER") {
        await tx.teamMember.updateMany({
          where: { teamId: id, role: "LEADER" },
          data: { role: "MEMBER" },
        });
      }
      await tx.teamMember.upsert({
        where: { teamId_employeeId: { teamId: id, employeeId: input.employeeId } },
        update: { role: input.role },
        create: { teamId: id, employeeId: input.employeeId, role: input.role },
      });
    });

    const updated = await prisma.team.findUnique({ where: { id }, include: MEMBERS_INCLUDE });
    return jsonOk(toTeamDetailDto(updated!));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 移除成员(?employeeId=)。 */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_TEAM:UPDATE");
    const { id } = await ctx.params;
    const employeeId = new URL(req.url).searchParams.get("employeeId");
    if (!employeeId) throw new DomainError(ErrCode.VALIDATION_FAILED, "缺少 employeeId");
    await prisma.teamMember.deleteMany({ where: { teamId: id, employeeId } });
    const updated = await prisma.team.findUnique({ where: { id }, include: MEMBERS_INCLUDE });
    if (!updated) throw new DomainError(ErrCode.NOT_FOUND, "团队不存在");
    return jsonOk(toTeamDetailDto(updated));
  } catch (e) {
    return toErrorResponse(e);
  }
}
