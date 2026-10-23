import { DomainError, ErrCode, userUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findUser(id: string) {
  const u = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!u) throw new DomainError(ErrCode.NOT_FOUND, "用户不存在");
  return u;
}

/** 编辑（角色/状态/姓名;不能改自己角色与状态——防锁死,SYS-002 §2.2/2.3）。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission("SYSTEM_USER:UPDATE");
    const { id } = await ctx.params;
    const target = await findUser(id);
    const input = await parseBody(req, userUpdateInput);
    if (target.id === actor.uid && (input.role !== undefined || input.status !== undefined)) {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "不能修改自己的角色或状态（防锁死）");
    }
    const row = await prisma.user.update({
      where: { id },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
    });
    if (input.role !== undefined && input.role !== target.role) {
      void audit({
        actorId: actor.uid,
        action: "user.role_change",
        targetType: "user",
        targetId: id,
        detail: { from: target.role, to: input.role },
      });
    }
    if (input.status === "DISABLED") {
      void audit({ actorId: actor.uid, action: "user.disable", targetType: "user", targetId: id });
    }
    return jsonOk({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role === "ADMIN" ? "ADMIN" : "MEMBER",
      status: row.status === "DISABLED" ? "DISABLED" : "ACTIVE",
      createdAt: row.createdAt.toISOString(),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 软删（不能删自己）。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission("SYSTEM_USER:DELETE");
    const { id } = await ctx.params;
    if (id === actor.uid) {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "不能删除自己");
    }
    await findUser(id);
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED" },
    });
    void audit({
      actorId: actor.uid,
      action: "user.soft_delete",
      targetType: "user",
      targetId: id,
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
