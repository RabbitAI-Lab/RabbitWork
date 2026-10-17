/** 事件归一化：AgentScope 上游信封 → 平台 ChatEvent（纯函数，fixture 单测覆盖）。 */
import type { AsRawEvent, NormalizedEvent, RunSummary } from "./types";

type PublicEvent = NonNullable<NonNullable<AsRawEvent["frameworkMeta"]>["public_event"]>;

/** 兼容 replay 包裹（frameworkMeta.public_event）与 SSE 直发（type/payload 顶层）两种形态 */
function publicEventOf(raw: AsRawEvent): PublicEvent | null {
  const wrapped = raw.frameworkMeta?.public_event;
  if (wrapped && typeof wrapped === "object") return wrapped;
  if (raw.type) return { type: raw.type, payload: raw.payload as PublicEvent["payload"] };
  return null;
}

function joinText(content?: Array<{ text?: string; type?: string }>): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

/**
 * 单条上游事件 → 0..n 条平台事件。
 * 已知映射（实测 2026-10-17）：
 *   item.delta        → delta（流式文本）
 *   item.completed    → message_completed（仅 final_output 帧，去重非 final 重复帧）
 *   usage.recorded    → usage（token 用量）
 *   run.ended         → run_ended / error（status=failed）
 *   *.failed / *error → error
 */
export function normalizeEvent(raw: AsRawEvent): NormalizedEvent[] {
  const pe = publicEventOf(raw);
  if (!pe?.type) return [];
  const p = pe.payload ?? {};
  const meta = {
    runId: p.run_id,
    turnId: p.turn_id,
    itemId: p.item_id,
    seq: raw.seq,
  };

  switch (pe.type) {
    case "item.delta": {
      const text = joinText(p.content);
      return text ? [{ type: "delta", text, _meta: meta }] : [];
    }
    case "item.completed": {
      const item = p.item;
      if (!item || item.role !== "ASSISTANT" || item.type !== "message") return [];
      // 同一 item 会先发一次普通帧再发一次 final_output 帧，只取 final 帧对外发一次
      if (p.final_output !== true) return [];
      const text = joinText(item.content);
      return [
        {
          type: "message_completed",
          messageId: p.message_id ?? item.message_id ?? item.id ?? "",
          role: "ASSISTANT",
          text,
          _meta: meta,
        },
      ];
    }
    case "usage.recorded": {
      const u = p.usage ?? {};
      return [
        {
          type: "usage",
          model: p.model ?? "unknown",
          inputTokens: u.inputTokens ?? 0,
          outputTokens: u.outputTokens ?? 0,
          totalTokens: u.totalTokens ?? 0,
          _meta: meta,
        },
      ];
    }
    case "run.ended": {
      if (p.status === "failed") {
        return [{ type: "error", message: `运行失败（${p.reason ?? "unknown"}）`, _meta: meta }];
      }
      return [
        {
          type: "run_ended",
          status: p.status ?? "completed",
          reason: p.reason ?? null,
          _meta: meta,
        },
      ];
    }
    default: {
      if (pe.type.endsWith(".failed") || pe.type.endsWith(".error")) {
        return [{ type: "error", message: `AgentScope 事件异常：${pe.type}`, _meta: meta }];
      }
      return [];
    }
  }
}

export function normalizeEvents(raws: AsRawEvent[]): NormalizedEvent[] {
  return raws.flatMap(normalizeEvent);
}

/** 从归一化事件流提取 run_record 落库所需汇总（后者覆盖前者） */
export function summarizeRun(events: NormalizedEvent[]): RunSummary {
  const summary: RunSummary = { status: "STREAMING" };
  for (const e of events) {
    if (e.type === "delta") summary.status = "STREAMING";
    if (e.type === "usage") {
      summary.model = e.model;
      summary.tokenIn = e.inputTokens;
      summary.tokenOut = e.outputTokens;
      summary.totalTokens = e.totalTokens;
    }
    if (e.type === "message_completed") {
      summary.finalText = e.text;
      summary.asMsgId = e.messageId;
    }
    if (e.type === "run_ended") {
      summary.status = e.status === "completed" ? "SUCCEEDED" : "FAILED";
    }
    if (e.type === "interrupted") summary.status = "INTERRUPTED";
    if (e.type === "error" && summary.status === "STREAMING") {
      summary.status = "FAILED";
      summary.error = e.message;
    }
    if (e._meta?.runId) summary.asRunId = e._meta.runId;
    if (e._meta?.turnId) summary.asTurnId = e._meta.turnId;
  }
  return summary;
}
