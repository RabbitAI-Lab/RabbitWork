import { ErrCode, fail, ok } from "@rabbit/shared";
import { logger } from "@rabbit/shared/logger";
import { prisma } from "@/server/db";
import { getRedis } from "@/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * readiness（rules/observability §5）：逐项检查已配置的依赖（DB 恒检；Redis 配置了才检）。
 * 部署编排与 CI 启动等待均以本端点 200 为准。
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (e) {
    checks.database = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  const redis = getRedis();
  if (redis) {
    try {
      checks.redis = { ok: (await redis.ping()) === "PONG" };
    } catch (e) {
      checks.redis = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  if (!allOk) {
    logger.warn({ checks }, "readiness failed");
    return Response.json(fail(ErrCode.DEGRADED, "依赖组件不可用"), { status: 503 });
  }
  return Response.json(ok({ checks }));
}
