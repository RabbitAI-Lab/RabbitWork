import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, staffUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toStaffDto } from "@/server/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 作用域内查找（防枚举：越权与不存在同返 404）。 */
async function findStaff(id: string) {
  const staff = await prisma.digitalEmployee.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!staff) throw new DomainError(ErrCode.NOT_FOUND, "员工不存在");
  return staff;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_STAFF:READ");
    const { id } = await ctx.params;
    return jsonOk(toStaffDto(await findStaff(id)));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_STAFF:UPDATE");
    const { id } = await ctx.params;
    await findStaff(id);
    const input = await parseBody(req, staffUpdateInput);
    try {
      const staff = await prisma.digitalEmployee.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.personaPrompt !== undefined ? { personaPrompt: input.personaPrompt } : {}),
          ...(input.boundary !== undefined ? { boundary: input.boundary ?? null } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl ?? null } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
        },
      });
      return jsonOk(toStaffDto(staff));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.STAFF_CODE_DUP, `工号 ${input.code} 已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 软删除（已发布员工先下线语义：PUBLISHED → OFFLINE 再软删）。软删必须释放工位——
 *  唯一索引 (org_id,desk_floor,desk_seat) 不排除软删行，不清座位会永久占用（OFFICE-004 v4 六座制下 e2e 实证）。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_STAFF:DELETE");
    const { id } = await ctx.params;
    await findStaff(id);
    await prisma.digitalEmployee.update({
      where: { id },
      data: { status: "OFFLINE", deskFloor: null, deskSeat: null, deletedAt: new Date() },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
