import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, pageQuery, teamCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, parseQuery, toErrorResponse } from "@/server/http";
import { MEMBERS_INCLUDE, toTeamDto } from "@/server/team-dto";
import { syncTeamRuntime } from "@/server/team-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 我的团队:列表(含成员数与队长)。 */
export async function GET(req: Request) {
  try {
    await requirePermission("ORG_TEAM:READ");
    const { page, pageSize } = parseQuery(req, pageQuery);
    const where: Prisma.TeamWhereInput = { orgId: defaultOrgId(), deletedAt: null };
    const [rows, total] = await prisma.$transaction([
      prisma.team.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: MEMBERS_INCLUDE,
      }),
      prisma.team.count({ where }),
    ]);
    return jsonOk({ items: rows.map(toTeamDto), total, page, pageSize });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 创建团队（TEAM-001 §2.2.1：可选随建指定 TL 并同步 AgentScope 运行面）。 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("ORG_TEAM:CREATE");
    const input = await parseBody(req, teamCreateInput);
    // TL 预校验：必须存在且已发布（与入队口径一致）
    let leader: { id: string; asAgentId: string | null } | null = null;
    if (input.leaderEmployeeId) {
      const employee = await prisma.digitalEmployee.findFirst({
        where: { id: input.leaderEmployeeId, orgId: defaultOrgId(), deletedAt: null },
        select: { id: true, asAgentId: true, status: true },
      });
      if (!employee || employee.status !== "PUBLISHED") {
        throw new DomainError(ErrCode.STAFF_NOT_PUBLISHED, "项目领导必须是已发布数字员工");
      }
      leader = employee;
    }
    try {
      const team = await prisma.team.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          description: input.description ?? null,
          goal: input.goal ?? null,
          creatorId: user.uid,
          ...(leader ? { members: { create: { employeeId: leader.id, role: "LEADER" } } } : {}),
        },
        include: MEMBERS_INCLUDE,
      });
      // 同步运行面（默认开）：上游失败不阻塞创建，落 asSyncError（TEAM-001 §2.2.1）
      const final = (input.syncToRuntime ?? true) && leader ? await syncTeamRuntime(team.id) : team;
      return jsonOk(toTeamDto(final ?? team), { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, `团队名「${input.name}」已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
