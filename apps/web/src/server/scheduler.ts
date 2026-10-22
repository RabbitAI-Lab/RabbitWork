/**
 * 定时任务调度器（CRON-001 §2.2）：60s 扫描 + 防重入,随 web 进程单实例。
 * BullMQ 迁移口径登记 R-SCHEDULER;globalThis 挂载（Next dev 分包,同 prisma 先例）。
 */
import { prisma } from "@/server/db";
import { nextRunAt } from "@rabbit/shared";
import { logger } from "@rabbit/shared";
import { executeCronTask } from "@/server/cron-exec";

const SCAN_INTERVAL_MS = 60_000;

interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null;
  inflight: Set<string>;
}

const g = globalThis as unknown as { __rwCronScheduler?: SchedulerState };

export function startScheduler(): void {
  const state = (g.__rwCronScheduler ??= { timer: null, inflight: new Set() });
  if (state.timer) return;
  state.timer = setInterval(() => void scan(state), SCAN_INTERVAL_MS);
  logger.info({ module: "cron" }, "scheduler started (60s scan)");
}

async function scan(state: SchedulerState): Promise<void> {
  try {
    const now = new Date();
    const tasks = await prisma.scheduledTask.findMany({
      where: { enabled: true, deletedAt: null },
      take: 200,
    });
    for (const t of tasks) {
      if (state.inflight.has(t.id)) continue;
      const due = nextRunAt(t.cron, t.lastRunAt ?? t.createdAt);
      if (due && due.getTime() <= now.getTime()) {
        state.inflight.add(t.id);
        void executeCronTask(t.id)
          .catch(() => {})
          .finally(() => state.inflight.delete(t.id));
      }
    }
  } catch (e) {
    logger.warn({ module: "cron", err: String(e) }, "scheduler scan failed");
  }
}

export function schedulerInflightCount(): number {
  return g.__rwCronScheduler?.inflight.size ?? 0;
}
