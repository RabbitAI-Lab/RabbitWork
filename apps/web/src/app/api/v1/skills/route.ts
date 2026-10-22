import { Prisma } from "@prisma/client";
import {
  DomainError,
  ErrCode,
  skillCreateInput,
  sopGraph as sopGraphSchema,
  validateSopGraph,
} from "@rabbit/shared";
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
    const raw = await parseBody(req, skillCreateInput);
    const input = raw as typeof raw & { sopGraph?: unknown };
    if (input.kind === "SOP") {
      const parsed = sopGraphSchema.safeParse(input.sopGraph ?? {});
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
      const row = await prisma.skillDefinition.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          description: input.description ?? null,
          kind: input.kind,
          promptTemplate: input.promptTemplate ?? null,
          ...("sopGraph" in input && input.sopGraph !== undefined
            ? // Prisma Json 输入边界断言（rules/typescript §3.2）
              { sopGraph: input.sopGraph as Prisma.InputJsonValue }
            : {}),
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
