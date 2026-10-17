import { normalizeEvent, summarizeRun, type NormalizedEvent, type RunSummary } from "@rabbit/agentscope";
import type { AsRawEvent, ChatEvent } from "@rabbit/agentscope";
import { DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { toErrorResponse } from "@/server/http";
import { getAgentScope } from "@/server/agentscope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 700;
const RUN_TIMEOUT_MS = 180_000;

/**
 * CHAT-001 事件流（SSE）：服务端订阅 AgentScope 事件（浏览器零直连），
 * 归一化为平台信封后透传，并异步落 run_records / message_mirrors / usage_dailies。
 *
 * 消费策略：replay 端点轮询（seq 游标去重）而非长连上游 SSE——重连语义简单且
 * 对上游形态差异（mock/real）完全一致；当前 run 的历史事件在连接建立时补发。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ORG_CHAT:READ");
    const { id } = await ctx.params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.uid, deletedAt: null },
      include: { employee: true },
    });
    if (!conversation) throw new DomainError(ErrCode.NOT_FOUND, "会话不存在");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const send = (event: ChatEvent) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            closed = true; // 客户端已断开，后续轮询退出
          }
        };
        const close = () => {
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              /* 已关闭 */
            }
          }
        };

        try {
          const run = await prisma.runRecord.findFirst({
            where: { conversationId: id },
            orderBy: { startedAt: "desc" },
          });
          send({ type: "run_started", runId: run?.id ?? "", at: new Date().toISOString() });

          if (!conversation.asChatId || !conversation.asSessionId) {
            send({ type: "done" });
            close();
            return;
          }
          const provider = getAgentScope();

          // ── 基线：拉全量回放，锁定当前 run，补发其历史事件（断线重连场景） ──
          const initial = await provider.fetchEvents(conversation.asSessionId, conversation.asChatId);
          let lastSeq = initial.reduce((m, e) => Math.max(m, e.seq ?? 0), -1);
          let currentRunId = run?.asRunId ?? lastRunIdOf(initial);
          const acc: NormalizedEvent[] = [];
          for (const raw of initial) {
            if (!currentRunId || runIdOf(raw) === currentRunId) acc.push(...normalizeEvent(raw));
          }
          for (const e of acc) send(publicOf(e));
          if (acc.length > 0) await persist(id, conversation.employeeId, conversation.orgId, summarizeRun(acc), acc, run?.id);

          // ── 轮询直至当前 run 终态 ──
          const deadline = Date.now() + RUN_TIMEOUT_MS;
          let ticks = 0;
          while (Date.now() < deadline && !closed) {
            await sleep(POLL_INTERVAL_MS);
            ticks++;
            if (ticks % 25 === 0) controller.enqueue(encoder.encode(": keepalive\n\n")); // 注释心跳

            const runNow = run
              ? await prisma.runRecord.findUnique({ where: { id: run.id } })
              : null;
            if (runNow && (runNow.status === "INTERRUPTED" || runNow.status === "FAILED")) {
              send({ type: runNow.status === "INTERRUPTED" ? "interrupted" : "error", ...(runNow.status === "INTERRUPTED" ? {} : { message: runNow.error ?? "运行失败" }) } as ChatEvent);
              send({ type: "done" });
              close();
              return;
            }

            const raws = await provider.fetchEvents(conversation.asSessionId, conversation.asChatId);
            const fresh = raws.filter((e) => (e.seq ?? 0) > lastSeq);
            lastSeq = raws.reduce((m, e) => Math.max(m, e.seq ?? 0), lastSeq);
            const evts = fresh
              .flatMap(normalizeEvent)
              .filter((e) => !currentRunId || !e._meta?.runId || e._meta.runId === currentRunId);
            if (evts.length === 0) continue;
            if (!currentRunId && evts.some((e) => e._meta?.runId)) {
              currentRunId = evts.find((e) => e._meta?.runId)?._meta?.runId;
            }
            for (const e of evts) send(publicOf(e));
            acc.push(...evts);
            const summary = summarizeRun(acc);
            await persist(id, conversation.employeeId, conversation.orgId, summary, acc, run?.id);
            if (summary.status !== "STREAMING") {
              send({ type: "done" });
              close();
              return;
            }
          }
          send({ type: "error", message: "运行超时" });
          send({ type: "done" });
          close();
        } catch (e) {
          send({ type: "error", message: e instanceof Error ? e.message : String(e) });
          send({ type: "done" });
          close();
        }
      },
      cancel() {
        /* 客户端断开：轮询循环由 closed 标记在下一 tick 退出（此处无法置位，由 close() 兜底） */
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

// ───── 内部工具 ─────

function publicOf(e: NormalizedEvent): ChatEvent {
  const { _meta, ...rest } = e;
  void _meta;
  return rest as ChatEvent;
}

function runIdOf(raw: AsRawEvent): string | undefined {
  return raw.frameworkMeta?.public_event?.payload?.run_id;
}

function lastRunIdOf(raws: AsRawEvent[]): string | undefined {
  for (let i = raws.length - 1; i >= 0; i--) {
    const rid = runIdOf(raws[i]!);
    if (rid) return rid;
  }
  return undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 留痕落库：run_record 状态/token、assistant 消息镜像（asMsgId 幂等）、用量日聚合。 */
async function persist(
  conversationId: string,
  employeeId: string,
  orgId: string,
  summary: RunSummary,
  _acc: NormalizedEvent[],
  runId?: string,
) {
  void _acc;
  if (runId) {
    const terminal = summary.status === "SUCCEEDED" || summary.status === "FAILED" || summary.status === "INTERRUPTED";
    const run = await prisma.runRecord.findUnique({ where: { id: runId } });
    if (run && run.status !== "INTERRUPTED") {
      await prisma.runRecord.update({
        where: { id: runId },
        data: {
          status: summary.status,
          ...(summary.asRunId ? { asRunId: summary.asRunId } : {}),
          ...(summary.asTurnId ? { asTurnId: summary.asTurnId } : {}),
          ...(summary.tokenIn != null ? { tokenIn: summary.tokenIn } : {}),
          ...(summary.tokenOut != null ? { tokenOut: summary.tokenOut } : {}),
          ...(summary.error ? { error: summary.error } : {}),
          ...(terminal ? { finishedAt: new Date() } : {}),
          ...(terminal && run.startedAt
            ? { durationMs: Date.now() - new Date(run.startedAt).getTime() }
            : {}),
        },
      });
    }
  }

  if (summary.finalText) {
    if (summary.asMsgId) {
      const dup = await prisma.messageMirror.findFirst({ where: { asMsgId: summary.asMsgId } });
      if (dup) {
        // 断线重连补发场景已落库
        return;
      }
    }
    const last = await prisma.messageMirror.findFirst({
      where: { conversationId },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await prisma.messageMirror.create({
      data: {
        conversationId,
        seq: (last?.seq ?? 0) + 1,
        role: "ASSISTANT",
        content: summary.finalText,
        asMsgId: summary.asMsgId,
        ...(summary.totalTokens != null
          ? {
              tokenUsage: {
                model: summary.model,
                input: summary.tokenIn,
                output: summary.tokenOut,
                total: summary.totalTokens,
              },
            }
          : {}),
      },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: "IDLE" },
    });
    // 用量日聚合（终态时记一次 run）
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    await prisma.usageDaily.upsert({
      where: { employeeId_day: { employeeId, day } },
      create: {
        orgId,
        employeeId,
        day,
        runs: 1,
        messages: 2,
        tokenIn: summary.tokenIn ?? 0,
        tokenOut: summary.tokenOut ?? 0,
      },
      update: {
        runs: { increment: 1 },
        messages: { increment: 2 },
        tokenIn: { increment: summary.tokenIn ?? 0 },
        tokenOut: { increment: summary.tokenOut ?? 0 },
      },
    });
  }
}
