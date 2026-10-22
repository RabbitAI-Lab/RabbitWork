import { z } from "zod";
import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { withApiKey } from "@/server/api-key-auth";
import { jsonOk } from "@/server/http";
import { toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createInput = z.object({
  staffId: z.string().min(1),
  title: z.string().trim().max(256).optional(),
});

/** 开放 API：创建会话（OBS-003 §2.3;与 Web 同构 domain 路径）。 */
export async function POST(req: Request) {
  return withApiKey(req, async (ctx) => {
    const parsed = createInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return toErrorResponse(new DomainError(ErrCode.VALIDATION_FAILED, "入参校验失败"));
    }
    const staff = await prisma.digitalEmployee.findFirst({
      where: {
        id: parsed.data.staffId,
        orgId: ctx.orgId,
        deletedAt: null,
        status: "PUBLISHED",
      },
    });
    if (!staff) {
      return toErrorResponse(new DomainError(ErrCode.NOT_FOUND, "员工不存在或未发布"));
    }
    const conv = await prisma.conversation.create({
      data: {
        orgId: ctx.orgId,
        employeeId: staff.id,
        userId: ctx.creatorId ?? staff.creatorId ?? "api",
        title: parsed.data.title ?? `与 ${staff.name} 的对话`,
        origin: "API",
        originRef: ctx.apiKeyId,
      },
    });
    return jsonOk(
      {
        id: conv.id,
        title: conv.title,
        employeeId: conv.employeeId,
        origin: conv.origin,
        createdAt: conv.createdAt.toISOString(),
      },
      { status: 201 },
    );
  });
}
