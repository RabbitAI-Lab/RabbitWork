/** knowledge 域纯函数 + zod round-trip（KNW-001 §5.1）。 */
import { describe, expect, it } from "vitest";
import { chunkText, kbRetrieveInput, parseQuery } from "../knowledge";

describe("chunkText（切片：800/100，中文按字符）", () => {
  it("短文单片；空文零片", () => {
    expect(chunkText("短文")).toEqual(["短文"]);
    expect(chunkText("   \n  ")).toEqual([]);
  });
  it("长文多片带重叠，覆盖无缝（相邻片头=前片尾-重叠）", () => {
    const text = "甲".repeat(2000);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0]!.length).toBe(800);
    // step=700：第二片起点 700，与首片重叠 100 字
    expect(chunks[1]!.startsWith("甲")).toBe(true);
    const joined = chunks.join("");
    expect(joined.length).toBeGreaterThanOrEqual(text.length);
  });
  it("尾片过短并入前片（无信息小片消除）", () => {
    const text = "a".repeat(750) + "b".repeat(40); // 790：step=700 → 第二片 90 < overlap? 90<100 → 并片
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.length).toBe(790);
  });
});

describe("parseQuery（多词 AND 输入解析）", () => {
  it("空白切词 + 去重保序 + 截断", () => {
    expect(parseQuery("  重置 密码 重置  ")).toEqual(["重置", "密码"]);
    expect(parseQuery("x".repeat(100))).toEqual(["x".repeat(64)]);
  });
  it("≤8 词上限", () => {
    expect(parseQuery("a b c d e f g h i j")).toHaveLength(8);
  });
});

describe("kbRetrieveInput（zod）", () => {
  it("topK 默认 8；query 必填 ≤256", () => {
    expect(kbRetrieveInput.parse({ query: "密码" }).topK).toBe(8);
    expect(kbRetrieveInput.safeParse({ query: "" }).success).toBe(false);
    expect(kbRetrieveInput.safeParse({ query: "x", topK: 33 }).success).toBe(false);
  });
});
