/** 事件归一化单测：fixture 取自真实实例 2026-10-17 抓包（蓝图 §8 契约守护）。 */
import { describe, expect, it } from "vitest";
import { normalizeEvent, summarizeRun } from "../events";
import type { AsRawEvent } from "../types";

const delta: AsRawEvent = {
  id: 19726,
  seq: 37,
  eventType: "event_delta",
  frameworkMeta: {
    public_event: {
      type: "item.delta",
      payload: {
        run_id: "run-1",
        item_id: "item-1",
        turn_id: "turn-1",
        content: [{ text: "我是", type: "text" }],
      },
    },
  },
};

const completedNotFinal: AsRawEvent = {
  seq: 38,
  eventType: "agent.message",
  frameworkMeta: {
    public_event: {
      type: "item.completed",
      payload: {
        run_id: "run-1",
        item_id: "item-1",
        message_id: "msg-1",
        item: { id: "item-1", role: "ASSISTANT", type: "message", content: [{ text: "我是XAgent", type: "text" }] },
      },
    },
  },
};

const completedFinal: AsRawEvent = {
  seq: 39,
  eventType: "agent.message",
  frameworkMeta: {
    public_event: {
      type: "item.completed",
      payload: {
        run_id: "run-1",
        item_id: "item-1",
        message_id: "msg-1",
        final_output: true,
        item: {
          id: "item-1",
          role: "ASSISTANT",
          type: "message",
          status: "completed",
          content: [{ text: "我是XAgent，数字员工。", type: "text" }],
        },
      },
    },
  },
};

const usage: AsRawEvent = {
  seq: 40,
  eventType: "span.model_request_end",
  frameworkMeta: {
    public_event: {
      type: "usage.recorded",
      payload: {
        run_id: "run-1",
        model: "glm-5.3",
        usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
      },
    },
  },
};

const runEnded: AsRawEvent = {
  seq: 41,
  eventType: "run.ended",
  frameworkMeta: {
    public_event: { type: "run.ended", payload: { run_id: "run-1", status: "completed", reason: "MODEL_STOP" } },
  },
};

describe("normalizeEvent", () => {
  it("item.delta → delta（提取 text 分片）", () => {
    expect(normalizeEvent(delta)).toEqual([
      { type: "delta", text: "我是", _meta: { runId: "run-1", turnId: "turn-1", itemId: "item-1", seq: 37 } },
    ]);
  });

  it("item.completed 仅在 final_output 帧产出 message_completed（去重）", () => {
    expect(normalizeEvent(completedNotFinal)).toEqual([]);
    const out = normalizeEvent(completedFinal);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "message_completed", text: "我是XAgent，数字员工。", messageId: "msg-1" });
  });

  it("usage.recorded → usage；run.ended → run_ended", () => {
    expect(normalizeEvent(usage)[0]).toMatchObject({ type: "usage", model: "glm-5.3", totalTokens: 125 });
    expect(normalizeEvent(runEnded)[0]).toMatchObject({ type: "run_ended", status: "completed" });
  });

  it("非 ASSISTANT message 的 item.completed 被忽略", () => {
    const tool: AsRawEvent = {
      seq: 50,
      eventType: "agent.message",
      frameworkMeta: {
        public_event: {
          type: "item.completed",
          payload: { final_output: true, item: { id: "t", role: "ASSISTANT", type: "tool_call", content: [] } },
        },
      },
    };
    expect(normalizeEvent(tool)).toEqual([]);
  });
});

describe("summarizeRun", () => {
  it("汇总状态/文本/token/runId", () => {
    const all = [delta, completedNotFinal, completedFinal, usage, runEnded].flatMap(normalizeEvent);
    const s = summarizeRun(all);
    expect(s).toMatchObject({
      status: "SUCCEEDED",
      finalText: "我是XAgent，数字员工。",
      asMsgId: "msg-1",
      asRunId: "run-1",
      model: "glm-5.3",
      tokenIn: 100,
      tokenOut: 25,
      totalTokens: 125,
    });
  });

  it("run.ended failed → FAILED + error 语义", () => {
    const failed: AsRawEvent = {
      seq: 60,
      eventType: "run.ended",
      frameworkMeta: { public_event: { type: "run.ended", payload: { run_id: "r", status: "failed", reason: "X" } } },
    };
    const s = summarizeRun(normalizeEvent(failed));
    expect(s.status).toBe("FAILED");
  });
});
