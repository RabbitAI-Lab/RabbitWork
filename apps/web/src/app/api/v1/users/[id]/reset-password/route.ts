import { DomainError, ErrCode, generatePassword } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission, hashPassword } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 重置密码（新密码一次性明文返回,SYS-002 §2.4;旧密码立即失效）。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission("SYSTEM_USER:UPDATE");
    const { id } = await ctx.params;
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new DomainError(ErrCode.NOT_FOUND, "用户不存在");
    const password = generatePassword();
    await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    void audit({
      actorId: actor.uid,
      action: "user.reset_password",
      targetType: "user",
      targetId: id,
    });
    return jsonOk({ password });
  } catch (e) {
    return toErrorResponse(e);
  }
}
