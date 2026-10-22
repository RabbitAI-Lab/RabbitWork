import { DomainError, ErrCode, sopRunInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { runSop } from "@/server/sop-run";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 运行 SOP（SKILL-002 §1.4-C3;同步执行至完成或人工暂停）。 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const skill = await prisma.skillDefinition.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null, kind: "SOP" },
    });
    if (!skill) throw new DomainError(ErrCode.NOT_FOUND, "SOP 技能不存在");
    const input = await parseBody(req, sopRunInput);
    try {
      const result = await runSop({
        skillId: id,
        employeeId: input.employeeId,
        variables: input.variables,
      });
      void audit({
        actorId: user.uid,
        action: "sop.run",
        targetType: "skill",
        targetId: id,
        detail: { status: result.status, steps: result.steps.length },
      });
      return jsonOk(result, { status: 201 });
    } catch (e) {
      throw new DomainError(ErrCode.VALIDATION_FAILED, e instanceof Error ? e.message : String(e));
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
