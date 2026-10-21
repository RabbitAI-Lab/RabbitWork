/** obs 域 schema round-trip + 看板口径纯函数（OBS-001 §5.1；rules/testing §4.2）。 */
import { describe, expect, it } from "vitest";
import { deriveRunStats, feedbackInput, runListQuery, runStatsDto } from "../obs";

describe("feedbackInput（OBS-001 §2.1 状态机入参）", () => {
  it("合法:UP/DOWN/null + 可选评语", () => {
    expect(feedbackInput.parse({ rating: "UP" }).rating).toBe("UP");
    expect(feedbackInput.parse({ rating: "DOWN", comment: "太笼统" }).comment).toBe("太笼统");
    expect(feedbackInput.parse({ rating: null }).rating).toBeNull();
  });
  it("非法:rating 缺失/未知值、评语超长", () => {
    expect(feedbackInput.safeParse({}).success).toBe(false);
    expect(feedbackInput.safeParse({ rating: "GOOD" }).success).toBe(false);
    expect(feedbackInput.safeParse({ rating: "DOWN", comment: "x".repeat(1025) }).success).toBe(
      false,
    );
  });
});

describe("runListQuery（状态白名单 + 分页）", () => {
  it("合法:状态枚举可选", () => {
    expect(runListQuery.parse({ page: 1, pageSize: 20 }).status).toBeUndefined();
    expect(runListQuery.parse({ page: 1, pageSize: 20, status: "FAILED" }).status).toBe("FAILED");
  });
  it("非法:状态透传任意字符串被拒（rules/security §2.2 白名单）", () => {
    expect(runListQuery.safeParse({ page: 1, pageSize: 20, status: "ALL" }).success).toBe(false);
  });
});

describe("deriveRunStats（OBS-001 §2.2 看板口径）", () => {
  it("终态样本:成功率=SUCCEEDED/(总-进行中),一位小数", () => {
    const r = deriveRunStats({
      today: 3,
      byStatus7d: { SUCCEEDED: 9, FAILED: 1, STARTED: 2, STREAMING: 1 },
      avgDurationMs7d: 3400,
      tokens7d: 123456,
    });
    expect(r.successRate7d).toBe(90); // 9/10
    expect(r.todayCount).toBe(3);
    expect(runStatsDto.safeParse(r).success).toBe(true);
  });
  it("无终态样本:成功率 null(不显示 0%)+ 时长 null 透传", () => {
    const r = deriveRunStats({
      today: 0,
      byStatus7d: { STARTED: 1 },
      avgDurationMs7d: null,
      tokens7d: 0,
    });
    expect(r.successRate7d).toBeNull();
    expect(r.avgDurationMs7d).toBeNull();
  });
  it("全成功 100%", () => {
    const r = deriveRunStats({
      today: 1,
      byStatus7d: { SUCCEEDED: 3 },
      avgDurationMs7d: 800,
      tokens7d: 10,
    });
    expect(r.successRate7d).toBe(100);
  });
});
