/** Next 官方启动钩子（CRON-001 §4）：进程就绪后拉起定时任务调度器。 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("@/server/scheduler");
  startScheduler();
}
