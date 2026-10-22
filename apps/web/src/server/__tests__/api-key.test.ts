/** API Key 纯函数单测（OBS-003 §5）。 */
import { describe, expect, it } from "vitest";
import { generateApiKey, hashEquals, parseBearer, pepperHashOf, APIKEY_PREFIX } from "../api-key";

describe("generateApiKey（OBS-003 §2.1）", () => {
  it("rw_live_ 前缀 + base64url 随机段 + 摘要确定性", () => {
    const k = generateApiKey();
    expect(k.plaintext.startsWith(APIKEY_PREFIX)).toBe(true);
    expect(k.plaintext.length).toBeGreaterThanOrEqual(40);
    expect(k.keyPrefix).toBe(k.plaintext.slice(0, APIKEY_PREFIX.length + 7));
    expect(k.pepperHash).toBe(pepperHashOf(k.plaintext));
    // 两次生成不同
    expect(generateApiKey().plaintext).not.toBe(k.plaintext);
  });
  it("同 key 摘要一致;异 key 摘要异;比较常时等价", () => {
    const h = pepperHashOf("rw_live_abc");
    expect(pepperHashOf("rw_live_abc")).toBe(h);
    expect(pepperHashOf("rw_live_abd")).not.toBe(h);
    expect(hashEquals(h, h)).toBe(true);
    expect(hashEquals(h, pepperHashOf("rw_live_abd"))).toBe(false);
  });
});

describe("parseBearer（OBS-003 §2.2）", () => {
  it("合法 Bearer 解析;缺头/非 Bearer/非 rw_live_ 前缀/空段拒绝", () => {
    expect(parseBearer("Bearer rw_live_xxx")).toBe("rw_live_xxx");
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Basic rw_live_x")).toBeNull();
    expect(parseBearer("Bearer sk-xxx")).toBeNull();
    expect(parseBearer(`Bearer ${APIKEY_PREFIX}`)).toBeNull();
  });
});
