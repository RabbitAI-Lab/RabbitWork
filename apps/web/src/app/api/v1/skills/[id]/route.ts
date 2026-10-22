import { Prisma } from "@prisma/client";
import {
  DomainError,
  ErrCode,
  skillUpdateInput,
  sopGraph as sopGraphSchema,
  validateSopGraph,
} from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toSkillDto } from "@/server/resource-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findSkill(id: string) {
  const row = await prisma.skillDefinition.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "技能不存在");
  return row;
}

/** 技能更新/删除（软删，RESOURCE-001）。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findSkill(id);
    const raw = await parseBody(req, skillUpdateInput);
    const input = raw as typeof raw & { sopGraph?: unknown };
    if (input.sopGraph !== undefined) {
      const parsed = sopGraphSchema.safeParse(input.sopGraph);
      if (!parsed.success) {
        throw new DomainError(
          ErrCode.VALIDATION_FAILED,
          `sopGraph 非法：${parsed.error.issues[0]?.message ?? ""}`,
        );
      }
      const errs = validateSopGraph(parsed.data);
      if (errs.length > 0)
        throw new DomainError(ErrCode.VALIDATION_FAILED, `SOP 图非法：${errs[0]}`);
      input.sopGraph = parsed.data;
    }
    try {
      const row = await prisma.skillDefinition.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.promptTemplate !== undefined
            ? { promptTemplate: input.promptTemplate ?? null }
            : {}),
          ...(input.sopGraph !== undefined
            ? { sopGraph: input.sopGraph as Prisma.InputJsonValue }
            : {}),
          version: { increment: 1 },
        },
      });
      return jsonOk(toSkillDto(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.STAFF_CODE_DUP, "技能名已存在");
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findSkill(id);
    await prisma.$transaction([
      prisma.employeeResourceBinding.deleteMany({
        where: { resourceId: id, resourceType: "SKILL" },
      }),
      prisma.skillDefinition.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
