import { describe, expect, it } from "vitest";
import { readThemeTokens, tokensFromVars } from "../draw";

/** OFFCIE-002-VT-01：tokens 桥（无 DOM / 单元测试环境安全）。 */
describe("readThemeTokens", () => {
  it("返回对象必须有全部 token 字段（无 DOM 时走 fallback）", () => {
    const t = readThemeTokens();
    for (const k of [
      "deskTop",
      "deskEdge",
      "chair",
      "chairBack",
      "monitor",
      "labelFg",
      "accent",
      "bgAlpha",
    ]) {
      expect(t).toHaveProperty(k);
    }
  });

  it("每个颜色都是 24-bit RGB 整数（含 0）", () => {
    const t = readThemeTokens();
    for (const v of Object.values(t)) {
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffff);
    }
  });

  it("bgAlpha = 0：演示卡用容器卡片底色透出，不画背景矩形", () => {
    expect(readThemeTokens().bgAlpha).toBe(0);
  });
});

describe("tokensFromVars（纯函数·核心桥）", () => {
  it("空对象走默认 fallback", () => {
    const t = tokensFromVars({});
    expect(t.deskTop).toBe(0x64748b);
    expect(t.accent).toBe(0x10b981);
    expect(t.bgAlpha).toBe(0);
  });

  it("传 #RRGGBB 字符串能解析为整数", () => {
    const t = tokensFromVars({
      "--rw-fg-muted": "#aabbcc",
      "--rw-accent": "#34d399",
    });
    expect(t.deskTop).toBe(0xaabbcc);
    expect(t.accent).toBe(0x34d399);
  });

  it("非法字符串（无 #）→ fallback，不抛", () => {
    const t = tokensFromVars({ "--rw-fg-muted": "rgb(0,0,0)" });
    // 解析失败回退到 0x64748b
    expect(t.deskTop).toBe(0x64748b);
  });

  it("空字符串/缺失键 → fallback", () => {
    const t = tokensFromVars({ "--rw-fg": "" });
    expect(t.labelFg).toBe(0x0f172a);
  });
});
