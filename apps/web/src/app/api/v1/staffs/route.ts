import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, pageQuery, staffCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, parseQuery, toErrorResponse } from "@/server/http";
import { toStaffDto } from "@/server/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** STAFF-001：员工列表（分页信封）。 */
export async function GET(req: Request) {
  try {
    await requirePermission("ORG_STAFF:READ");
    const { page, pageSize } = parseQuery(req, pageQuery);
    const where: Prisma.DigitalEmployeeWhereInput = { orgId: defaultOrgId(), deletedAt: null };
    const [items, total] = await prisma.$transaction([
      prisma.digitalEmployee.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.digitalEmployee.count({ where }),
    ]);
    return jsonOk({ items: items.map(toStaffDto), total, page, pageSize });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** STAFF-001：创建员工（DRAFT，发布另走 /publish）。 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("ORG_STAFF:CREATE");
    const input = await parseBody(req, staffCreateInput);
    const orgId = defaultOrgId();
    const code = input.code ?? (await nextCode());
    try {
      const staff = await prisma.digitalEmployee.create({
        data: {
          orgId,
          code,
          name: input.name,
          title: input.title,
          personaPrompt: input.personaPrompt,
          boundary: input.boundary ?? null,
          avatarUrl: input.avatarUrl ?? null,
          visibility: input.visibility,
          creatorId: user.uid,
        },
      });
      return jsonOk(toStaffDto(staff), { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.STAFF_CODE_DUP, `工号 ${code} 已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 工号自动生成：STAFF-YYYYMMDD-XXXX（冲突时重试） */
async function nextCode(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `STAFF-${day}-${suffix}`;
    const dup = await prisma.digitalEmployee.findFirst({ where: { orgId: defaultOrgId(), code } });
    if (!dup) return code;
  }
  throw new DomainError(ErrCode.INTERNAL, "工号生成失败，请手动指定");
}
