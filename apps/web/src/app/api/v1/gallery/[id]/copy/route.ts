import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 复制到我的员工（STAFF-003 §2:深拷贝 PRIVATE DRAFT,原件不动）。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_STAFF:CREATE");
    const { id } = await ctx.params;
    const src = await prisma.digitalEmployee.findFirst({
      where: { id, orgId: defaultOrgId(), visibility: "GALLERY", deletedAt: null },
    });
    if (!src) throw new DomainError(ErrCode.NOT_FOUND, "广场员工不存在");
    // 工号自动生成（与 POST /staffs 同口径）
    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    let code = `STAFF-${day}-COPY`;
    for (let i = 0; i < 5; i++) {
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const candidate = `STAFF-${day}-${suffix}`;
      const dup = await prisma.digitalEmployee.findFirst({
        where: { orgId: defaultOrgId(), code: candidate },
      });
      if (!dup) {
        code = candidate;
        break;
      }
    }
    const copy = await prisma.digitalEmployee.create({
      data: {
        orgId: src.orgId,
        code,
        name: `${src.name}-副本`,
        title: src.title,
        personaPrompt: src.personaPrompt,
        boundary: src.boundary,
        avatarUrl: src.avatarUrl,
        visibility: "PRIVATE",
        creatorId: user.uid,
      },
    });
    void audit({
      actorId: user.uid,
      action: "staff.copy",
      targetType: "digital_employee",
      targetId: src.id,
      detail: { copyId: copy.id },
    });
    return jsonOk(
      {
        id: copy.id,
        code: copy.code,
        name: copy.name,
        title: copy.title,
        visibility: copy.visibility,
        status: copy.status,
      },
      { status: 201 },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
