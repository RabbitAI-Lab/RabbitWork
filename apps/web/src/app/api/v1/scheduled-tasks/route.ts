import { Prisma } from "@prisma/client";
import { cronInput, DomainError, ErrCode } from "@rabbit/shared";
import { z } from "zod";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createInput = z.object({
  name: z.string().trim().min(1).max(128),
  cron: cronInput,
  employeeId: z.string().min(1),
  inputTemplate: z.string().trim().min(1).max(20000),
  enabled: z.boolean().optional(),
});

/** 任务列表（CRON-001 §1.4-C1）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.scheduledTask.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk({ items: rows.map(toDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

function toDto(r: {
  id: string;
  name: string;
  cron: string;
  employeeId: string;
  inputTemplate: string;
  enabled: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    name: r.name,
    cron: r.cron,
    employeeId: r.employeeId,
    inputTemplate: r.inputTemplate,
    enabled: r.enabled,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** 创建任务。 */
export async function POST(req: Request) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, createInput);
    const staff = await prisma.digitalEmployee.findFirst({
      where: { id: input.employeeId, orgId: defaultOrgId(), deletedAt: null, status: "PUBLISHED" },
    });
    if (!staff) throw new DomainError(ErrCode.VALIDATION_FAILED, "员工不存在或未发布");
    try {
      const row = await prisma.scheduledTask.create({
        data: {
          orgId: defaultOrgId(),
          employeeId: input.employeeId,
          name: input.name,
          cron: input.cron,
          inputTemplate: input.inputTemplate,
          enabled: input.enabled ?? true,
        },
      });
      return jsonOk(toDto(row), { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, "同名任务已存在");
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
