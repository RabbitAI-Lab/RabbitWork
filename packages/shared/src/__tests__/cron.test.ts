/** cron 纯函数矩阵（CRON-001 §5）。 */
import { describe, expect, it } from "vitest";
import { cronInput, describeCron, nextRunAt, parseCron } from "../cron";

describe("parseCron（CRON-001 §2.1）", () => {
  it("合法:*/列表/区间/步进;周日 7 归一 0", () => {
    expect(parseCron("* * * * *")).not.toBeNull();
    expect(parseCron("0 9 * * *")).not.toBeNull();
    expect(parseCron("0,30 9-18 * * 1-5")).not.toBeNull();
    expect(parseCron("*/15 * * * *")).not.toBeNull();
    const sun = parseCron("* * * * 7");
    expect(sun?.fields[4]!.has(0)).toBe(true);
  });
  it("非法:字段数/越界/坏语法/空集", () => {
    expect(parseCron("* * * *")).toBeNull();
    expect(parseCron("60 * * * *")).toBeNull();
    expect(parseCron("* 24 * * *")).toBeNull();
    expect(parseCron("5-1 * * * *")).toBeNull();
    expect(parseCron("a * * * *")).toBeNull();
    expect(parseCron("*/0 * * * *")).toBeNull();
  });
});

describe("nextRunAt（分钟粒度扫描）", () => {
  it("每天 09:00——当天 08:59 后命中当天 09:00;09:00 后命中次日", () => {
    const a = nextRunAt("0 9 * * *", new Date("2026-10-23T08:59:30"));
    expect(a?.toISOString()).toBe(new Date("2026-10-23T09:00:00").toISOString());
    const b = nextRunAt("0 9 * * *", new Date("2026-10-23T09:00:00"));
    expect(b?.getDate()).toBe(24);
  });
  it("每周一 09:00——周五后跳到下周一", () => {
    const r = nextRunAt("0 9 * * 1", new Date("2026-10-23T10:00:00")); // 周五
    expect(r?.getDay()).toBe(1);
  });
  it("2 月 30 日无命中 → null", () => {
    expect(nextRunAt("0 0 30 2 *", new Date("2026-01-01T00:00:00"))).toBeNull();
  });
});

describe("describeCron + cronInput zod", () => {
  it("常见模式摘要", () => {
    expect(describeCron("* * * * *")).toBe("每分钟");
    expect(describeCron("0 9 * * *")).toBe("每天 09:00");
    expect(describeCron("0 9 * * 1-5")).toBe("每个工作日 09:00");
    expect(describeCron("*/15 * * * *")).toBe("每 15 分钟");
    expect(describeCron("5 4 * * 3")).toBe("5 4 * * 3");
  });
  it("zod:合法通过;段数/字符/越界拒绝", () => {
    expect(cronInput.parse("0 9 * * *")).toBe("0 9 * * *");
    expect(cronInput.safeParse("* * *").success).toBe(false);
    expect(cronInput.safeParse("0 9 * * x").success).toBe(false);
    expect(cronInput.safeParse("99 * * * *").success).toBe(false);
  });
});
