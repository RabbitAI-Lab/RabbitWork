/** 审计日志（OBS-002 §2.2）：只插入（rules/database §8.2）;fire-and-forget,失败仅告警不阻塞主流程。 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { logger } from "@rabbit/shared";

export interface AuditInput {
  actorId?: string | null;
  action: string; // domain.verb（如 team.create / auth.login_failed）
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        // Prisma Json 输入边界断言（rules/typescript §3.2）
        detailJson: input.detail as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    logger.warn({ action: input.action, err: String(e) }, "audit write failed");
  }
}
