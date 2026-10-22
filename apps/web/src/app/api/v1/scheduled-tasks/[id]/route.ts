import { Prisma } from "@prisma/client";
import { cronInput, DomainError, ErrCode } from "@rabbit/shared";
import { z } from "zod";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateInput = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  cron: cronInput.optional(),
  employeeId: z.string().min(1).optional(),
  inputTemplate: z.string().trim().min(1).max(20000).optional(),
  enabled: z.boolean().optional(),
});

async function findTask(id: string) {
  const row = await prisma.scheduledTask.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "任务不存在");
  return row;
}

/** 编辑（含启用/停用）。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findTask(id);
    const input = await parseBody(req, updateInput);
    if (input.employeeId) {
      const ok = await prisma.digitalEmployee.findFirst({
        where: {
          id: input.employeeId,
          orgId: defaultOrgId(),
          status: "PUBLISHED",
          deletedAt: null,
        },
      });
      if (!ok) throw new DomainError(ErrCode.VALIDATION_FAILED, "员工不存在或未发布");
    }
    const row = await prisma.scheduledTask
      .update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.cron !== undefined ? { cron: input.cron } : {}),
          ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
          ...(input.inputTemplate !== undefined ? { inputTemplate: input.inputTemplate } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        },
      })
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new DomainError(ErrCode.VALIDATION_FAILED, "同名任务已存在");
        }
        throw e;
      });
    return jsonOk({
      id: row.id,
      name: row.name,
      cron: row.cron,
      employeeId: row.employeeId,
      inputTemplate: row.inputTemplate,
      enabled: row.enabled,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 软删。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findTask(id);
    await prisma.scheduledTask.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
