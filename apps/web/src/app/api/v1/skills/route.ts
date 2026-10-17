import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, skillCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toSkillDto } from "@/server/resource-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 技能库列表（组织内共享）+ 创建（RESOURCE-001）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.skillDefinition.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk({ items: rows.map(toSkillDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, skillCreateInput);
    try {
      const row = await prisma.skillDefinition.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          description: input.description ?? null,
          kind: input.kind,
          promptTemplate: input.promptTemplate ?? null,
        },
      });
      return jsonOk(toSkillDto(row), { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.STAFF_CODE_DUP, `技能「${input.name}」已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
