import { DomainError, ErrCode, staffResourcesPutInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toKbDto, toSkillDto } from "@/server/resource-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findStaff(id: string) {
  const staff = await prisma.digitalEmployee.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!staff) throw new DomainError(ErrCode.NOT_FOUND, "员工不存在");
  return staff;
}

/** 员工已绑定资源（RESOURCE-001：技能 + 知识库）。 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_STAFF:READ");
    const { id } = await ctx.params;
    await findStaff(id);
    const bindings = await prisma.employeeResourceBinding.findMany({
      where: { employeeId: id, enabled: true },
      select: { resourceType: true, resourceId: true },
    });
    const skillIds = bindings.filter((b) => b.resourceType === "SKILL").map((b) => b.resourceId);
    const kbIds = bindings.filter((b) => b.resourceType === "KNOWLEDGE").map((b) => b.resourceId);
    const [skills, kbs] = await Promise.all([
      skillIds.length
        ? prisma.skillDefinition.findMany({ where: { id: { in: skillIds }, deletedAt: null } })
        : Promise.resolve([]),
      kbIds.length
        ? prisma.knowledgeBase.findMany({ where: { id: { in: kbIds }, deletedAt: null } })
        : Promise.resolve([]),
    ]);
    return jsonOk({ skills: skills.map(toSkillDto), knowledgeBases: kbs.map(toKbDto) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 绑定全量差分写（RESOURCE-001）：事务内查差集增删，禁止无条件全量重写（rules/database §4.3）。 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findStaff(id);
    const input = await parseBody(req, staffResourcesPutInput);

    // 校验目标资源存在且属于本组织（防跨组织引用）
    const orgId = defaultOrgId();
    const [skills, kbs] = await Promise.all([
      input.skillIds.length
        ? prisma.skillDefinition.findMany({ where: { id: { in: input.skillIds }, orgId, deletedAt: null }, select: { id: true } })
        : Promise.resolve([] as Array<{ id: string }>),
      input.knowledgeBaseIds.length
        ? prisma.knowledgeBase.findMany({ where: { id: { in: input.knowledgeBaseIds }, orgId, deletedAt: null }, select: { id: true } })
        : Promise.resolve([] as Array<{ id: string }>),
    ]);
    if (skills.length !== input.skillIds.length || kbs.length !== input.knowledgeBaseIds.length) {
      throw new DomainError(ErrCode.VALIDATION_FAILED, "包含不存在或不可用的资源");
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.employeeResourceBinding.findMany({
        where: { employeeId: id },
        select: { id: true, resourceType: true, resourceId: true },
      });
      const existingKeys = new Set(existing.map((b) => `${b.resourceType}:${b.resourceId}`));
      const wanted = new Set<string>([
        ...input.skillIds.map((rid) => `SKILL:${rid}`),
        ...input.knowledgeBaseIds.map((rid) => `KNOWLEDGE:${rid}`),
      ]);
      const toDelete = existing.filter((b) => !wanted.has(`${b.resourceType}:${b.resourceId}`)).map((b) => b.id);
      const toCreate = [...wanted].filter((key) => !existingKeys.has(key)).map((key) => {
        const [resourceType, resourceId] = key.split(":") as ["SKILL" | "KNOWLEDGE", string];
        return { employeeId: id, resourceType, resourceId };
      });
      if (toDelete.length) await tx.employeeResourceBinding.deleteMany({ where: { id: { in: toDelete } } });
      if (toCreate.length) await tx.employeeResourceBinding.createMany({ data: toCreate });
    });

    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
