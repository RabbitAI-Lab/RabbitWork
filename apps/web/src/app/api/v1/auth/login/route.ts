import { loginInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { issueSessionCookie, verifyPassword } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";
import { DomainError, ErrCode } from "@rabbit/shared";

export const runtime = "nodejs";

/** SYS-001：登录（email + 密码 → 会话 cookie）。 */
export async function POST(req: Request) {
  try {
    const { email, password } = await parseBody(req, loginInput);
    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.deletedAt ||
      user.status !== "ACTIVE" ||
      !verifyPassword(password, user.passwordHash)
    ) {
      void audit({ action: "auth.login_failed", targetType: "email", targetId: email });
      throw new DomainError(ErrCode.UNAUTHENTICATED, "邮箱或密码错误");
    }
    await issueSessionCookie({
      uid: user.id,
      role: user.role as "ADMIN" | "MEMBER",
      name: user.name,
    });
    void audit({ actorId: user.id, action: "auth.login", targetType: "user", targetId: user.id });
    return jsonOk({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    return toErrorResponse(e);
  }
}
