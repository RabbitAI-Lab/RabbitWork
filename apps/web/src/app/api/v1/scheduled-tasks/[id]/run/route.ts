import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";
import { executeCronTask } from "@/server/cron-exec";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 立即执行一次（CRON-001 §1.4-C4;调度器与手动共用执行体）。 */
export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    const exists = await prisma.scheduledTask.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!exists) throw new DomainError(ErrCode.NOT_FOUND, "任务不存在");
    const result = await executeCronTask(id);
    void audit({ actorId: user.uid, action: "cron.run_now", targetType: "task", targetId: id });
    return jsonOk(result);
  } catch (e) {
    return toErrorResponse(e);
  }
}
