import { DomainError, ErrCode, deskAssignInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toStaffDto } from "@/server/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 工位分配/切换（OFFICE-001）：目标被占返回 409；同位幂等。 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_STAFF:UPDATE");
    const { id } = await ctx.params;
    const orgId = defaultOrgId();
    const input = await parseBody(req, deskAssignInput);

    const staff = await prisma.digitalEmployee.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!staff) throw new DomainError(ErrCode.NOT_FOUND, "员工不存在");

    // 工位占用检查（唯一约束兜底并发，此处给友好 409）
    const occupied = await prisma.digitalEmployee.findFirst({
      where: { orgId, deskFloor: input.floor, deskSeat: input.seat, deletedAt: null, NOT: { id } },
      select: { name: true },
    });
    if (occupied) {
      throw new DomainError(ErrCode.STAFF_STATE_INVALID, `${input.floor}F-${String(input.seat).padStart(2, "0")} 已被 ${occupied.name} 占用`);
    }

    const updated = await prisma.digitalEmployee.update({
      where: { id },
      data: { deskFloor: input.floor, deskSeat: input.seat },
    });
    return jsonOk(toStaffDto(updated));
  } catch (e) {
    return toErrorResponse(e);
  }
}
