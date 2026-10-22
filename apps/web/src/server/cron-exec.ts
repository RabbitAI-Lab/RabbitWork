/** 定时任务执行体（CRON-001 §2.3）：sendTurn 同构链路 + run 留痕。 */
import { prisma } from "@/server/db";
import { getAgentScope } from "@/server/agentscope";
import { logger } from "@rabbit/shared";

/** 渲染 {{占位}}（日期等内置变量;未识别保留原样——模板语义宽于工具 URL 渲染）。 */
function render(tpl: string): string {
  const now = new Date();
  return tpl
    .replaceAll("{{日期}}", now.toISOString().slice(0, 10))
    .replaceAll("{{时间}}", now.toISOString().slice(11, 16));
}

/** 执行一次任务（调度到期或手动「立即执行」共用）。 */
export async function executeCronTask(taskId: string): Promise<{ runId: string; status: string }> {
  const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } });
  const staff = task
    ? await prisma.digitalEmployee.findUnique({ where: { id: task.employeeId } })
    : null;
  if (!staff) throw new Error("员工不存在");
  if (!task || task.deletedAt || !task.enabled) {
    throw new Error("任务不存在或未启用");
  }
  const run = await prisma.scheduledTaskRun.create({
    data: { taskId, status: "PENDING" },
  });
  const started = new Date();
  try {
    const agentId = staff.asAgentId;
    if (!agentId) throw new Error("员工未发布（无运行面身份）");
    // 复用/新建 origin=CRON 会话（originRef=taskId）
    let conv = await prisma.conversation.findFirst({
      where: { originRef: taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          orgId: task.orgId,
          employeeId: task.employeeId,
          userId: staff.creatorId ?? "cron",
          title: `[定时] ${task.name}`,
          origin: "CRON",
          originRef: taskId,
        },
      });
    }
    // 消息留痕（复用 OBS-003 同构最小路径）
    const last = await prisma.messageMirror.findFirst({
      where: { conversationId: conv.id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await prisma.messageMirror.create({
      data: {
        conversationId: conv.id,
        seq: (last?.seq ?? 0) + 1,
        role: "USER",
        content: render(task.inputTemplate),
      },
    });
    const provider = getAgentScope();
    const handle = conv.asChatId
      ? await provider.sendTurn(conv.asChatId, agentId, render(task.inputTemplate))
      : await (async () => {
          const created = await provider.startChat(agentId);
          return provider.sendTurn(created.chatId, agentId, render(task.inputTemplate));
        })();
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        asChatId: handle.chatId,
        asSessionId: handle.sessionId,
        asRuntimeSessionId: handle.runtimeSessionId,
        lastMessageAt: new Date(),
      },
    });
    const done = await prisma.scheduledTaskRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        startedAt: started,
        finishedAt: new Date(),
        output: { conversationId: conv.id, chatId: handle.chatId },
      },
    });
    await prisma.scheduledTask.update({
      where: { id: taskId },
      data: { lastRunAt: new Date() },
    });
    return { runId: done.id, status: "SUCCEEDED" };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await prisma.scheduledTaskRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        startedAt: started,
        finishedAt: new Date(),
        error: reason.slice(0, 512),
      },
    });
    await prisma.scheduledTask.update({
      where: { id: taskId },
      data: { lastRunAt: new Date() },
    });
    logger.warn({ module: "cron", taskId, err: reason }, "cron task failed");
    return { runId: run.id, status: "FAILED" };
  }
}
