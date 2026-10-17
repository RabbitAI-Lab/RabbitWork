import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, pageQuery, teamCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, parseQuery, toErrorResponse } from "@/server/http";
import { MEMBERS_INCLUDE, toTeamDto } from "@/server/team-dto";

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

/** 创建团队。 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("ORG_TEAM:CREATE");
    const input = await parseBody(req, teamCreateInput);
    try {
      const team = await prisma.team.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          description: input.description ?? null,
          goal: input.goal ?? null,
          creatorId: user.uid,
        },
        include: MEMBERS_INCLUDE,
      });
      return jsonOk(toTeamDto(team), { status: 201 });
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
