import { describe, expect, it } from "vitest";
import { estimateTokens, formatTokenCount, formatUsageLine, appendStreaming } from "../../utils";

describe("estimateTokens", () => {
  it("in = ceil(chars / 4), 至少 1", () => {
    expect(estimateTokens("").input).toBe(1);
    expect(estimateTokens("").output).toBe(38); // 1*6 + 32
    expect(estimateTokens("a".repeat(4)).input).toBe(1);
    expect(estimateTokens("a".repeat(5)).input).toBe(2);
    expect(estimateTokens("a".repeat(40)).input).toBe(10);
  });
  it("out 与 in 同步按公式", () => {
    expect(estimateTokens("hello").input).toBe(2); // 5 chars → ceil(1.25)=2
    expect(estimateTokens("hello").output).toBe(2 * 6 + 32); // 44
  });
  it("undefined / null 输入 → 0 字符", () => {
    expect(estimateTokens(undefined as never).input).toBe(1);
    expect(estimateTokens(undefined as never).output).toBe(38);
  });
});

describe("formatTokenCount", () => {
  it("< 1000 走纯数字", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(732)).toBe("732");
  });
  it("≥ 1000 走 K（保留 1 位小数）", () => {
    expect(formatTokenCount(1000)).toBe("1.0K");
    expect(formatTokenCount(1234)).toBe("1.2K");
    expect(formatTokenCount(8000)).toBe("8.0K");
  });
});

describe("formatUsageLine", () => {
  it("usage=undefined/null → 空字符串（不做猜测 fallback）", () => {
    expect(formatUsageLine("foo", null)).toBe("");
    expect(formatUsageLine("foo", undefined)).toBe("");
  });
  it("usage 与 model 都给 → 'foo · 输入 142 / 输出 318 tokens'", () => {
    const u = { model: "foo", input: 142, output: 318, total: 460 };
    expect(formatUsageLine("foo", u)).toBe("foo · 输入 142 / 输出 318 tokens");
  });
  it("usage 缺 model 时优先取 usage.model", () => {
    expect(formatUsageLine(undefined, { model: "x", input: 1, output: 2, total: 3 })).toBe(
      "x · 输入 1 / 输出 2 tokens",
    );
  });
  it("输入/输出为空 → 用 - 占位（不显示 0/0）", () => {
    expect(formatUsageLine("m", { input: undefined, output: undefined, total: 0 })).toBe(
      "m · 输入 - / 输出 - tokens",
    );
  });
});

describe("appendStreaming 折叠", () => {
  it("第一次 append：返回 [new]（prev 为空时长度=1）", () => {
    const out = appendStreaming([], "hello", "mid-1");
    expect(out).toHaveLength(1);
  });
  it("重复 messageId 不重复 append（去重，prev 保持不变）", () => {
    const seed = appendStreaming([], "first", "mid-1");
    const out = appendStreaming(seed as never, "second", "mid-1");
    expect(out).toEqual([]); // 返回 [] 表示「无 append 发生」
  });
  it("不同 messageId 都保留（累加 prev + new）", () => {
    const seed = appendStreaming([], "a", "mid-1");
    const out = appendStreaming(seed as never, "b", "mid-2");
    expect(out).toHaveLength(2); // 累加：mid-1 + mid-2
  });
});
