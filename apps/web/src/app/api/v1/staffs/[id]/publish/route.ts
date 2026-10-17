import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { toStaffDto } from "@/server/dto";
import { getAgentScope } from "@/server/agentscope";

export const runtime = "nodejs";

/**
 * STAFF-001 发布：装配清单编译 → 注册/复用 AgentScope agent → 版本快照落库。
 * AgentScope 侧新建 agent 可能停在 provisioning（实例需控制台完成运行时配置），
 * 适配层配置了 AGENTSCOPE_FALLBACK_AGENT_ID 时自动回退（蓝图 §2.3 降级路径）。
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("ORG_STAFF:PUBLISH");
    const { id } = await ctx.params;
    const staff = await prisma.digitalEmployee.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!staff) throw new DomainError(ErrCode.NOT_FOUND, "员工不存在");
    if (staff.status === "OFFLINE" && staff.deletedAt) {
      throw new DomainError(ErrCode.STAFF_STATE_INVALID, "已删除员工不可发布");
    }

    const agentKey = staff.asAgentKey ?? `staff-${staff.code}`;
    const result = await getAgentScope().ensureAgent({
      agentKey,
      displayName: staff.name,
      description: `${staff.title}｜${staff.personaPrompt.slice(0, 180)}`,
    });

    const promptCompiled = compilePrompt(
      staff.name,
      staff.title,
      staff.personaPrompt,
      staff.boundary,
    );
    const lastVersion = await prisma.employeeVersion.findFirst({
      where: { employeeId: staff.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (lastVersion?.version ?? 0) + 1;

    const [updated] = await prisma.$transaction([
      prisma.digitalEmployee.update({
        where: { id: staff.id },
        data: {
          status: "PUBLISHED",
          asAgentId: result.agentId,
          asNamespace: result.namespace,
          asAgentKey: agentKey,
          publishedAt: new Date(),
        },
      }),
      prisma.employeeVersion.create({
        data: {
          employeeId: staff.id,
          version,
          promptCompiled,
          assemblyJson: {
            agentKey,
            asAgentId: result.agentId,
            agentStatus: result.agentStatus,
            usedFallback: result.usedFallback,
            personaPrompt: staff.personaPrompt,
            boundary: staff.boundary,
            visibility: staff.visibility,
          },
        },
      }),
    ]);
    return jsonOk({
      ...toStaffDto(updated),
      agentStatus: result.agentStatus,
      usedFallback: result.usedFallback,
      version,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

function compilePrompt(
  name: string,
  title: string,
  persona: string,
  boundary: string | null,
): string {
  const lines = [`你是${name}，一名${title}数字员工。`, "", "# 人设", persona];
  if (boundary) lines.push("", "# 职责边界", boundary);
  return lines.join("\n");
}
