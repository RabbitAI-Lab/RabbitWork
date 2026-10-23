import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, generatePassword, userCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { hashPassword } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDto(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role === "ADMIN" ? "ADMIN" : "MEMBER",
    status: u.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    createdAt: u.createdAt.toISOString(),
  };
}

/** 用户列表（SYS-002 §1.4-C1;MEMBER 经 :READ 白名单只读可见）。 */
export async function GET() {
  try {
    await requirePermission("SYSTEM_USER:READ");
    const rows = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk({ items: rows.map(toDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 创建用户（初始密码一次性明文返回,SYS-002 §2.1）。 */
export async function POST(req: Request) {
  try {
    const actor = await requirePermission("SYSTEM_USER:CREATE");
    const input = await parseBody(req, userCreateInput);
    const password = input.password ?? generatePassword();
    try {
      const row = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          passwordHash: hashPassword(password),
        },
      });
      void audit({
        actorId: actor.uid,
        action: "user.create",
        targetType: "user",
        targetId: row.id,
        detail: { role: input.role },
      });
      return jsonOk({ ...toDto(row), password }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, `邮箱 ${input.email} 已被使用`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
