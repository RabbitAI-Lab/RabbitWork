/** model 域 zod round-trip + 验证请求构造矩阵（MODEL-001 §5）。 */
import { describe, expect, it } from "vitest";
import { buildVerifyRequest, modelCreateInput, modelUpdateInput } from "../model";

describe("modelCreateInput", () => {
  it("合法:协议白名单 + http(s) + 必填齐全", () => {
    const r = modelCreateInput.parse({
      name: "主力",
      protocol: "openai_chat_completions",
      baseUrl: "https://api.openai.com/v1",
      modelId: "gpt-4o-mini",
      apiKey: "sk-x",
    });
    expect(r.isDefault).toBeUndefined();
  });
  it("非法:协议白名单外/baseUrl 非 http(s)/apiKey 空", () => {
    const base = { name: "x", baseUrl: "https://a.com", modelId: "m", apiKey: "k" };
    expect(modelCreateInput.safeParse({ ...base, protocol: "llama" }).success).toBe(false);
    expect(
      modelCreateInput.safeParse({ ...base, protocol: "gemini", baseUrl: "ftp://a" }).success,
    ).toBe(false);
    expect(modelCreateInput.safeParse({ ...base, protocol: "gemini", apiKey: "" }).success).toBe(
      false,
    );
  });
  it("update 部分字段", () => {
    expect(modelUpdateInput.parse({ modelId: "n" }).modelId).toBe("n");
  });
});

describe("buildVerifyRequest（三协议构造矩阵）", () => {
  it("openai_chat_completions:/chat/completions + Bearer + max_tokens=1", () => {
    const r = buildVerifyRequest(
      "openai_chat_completions",
      "https://api.openai.com/v1",
      "gpt-4o-mini",
      "sk-x",
    );
    expect(r.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(r.headers.Authorization).toBe("Bearer sk-x");
    expect(r.body).toContain('"max_tokens":1');
  });
  it("anthropic:/v1/messages + x-api-key + version 头", () => {
    const r = buildVerifyRequest(
      "anthropic",
      "https://api.anthropic.com",
      "claude-sonnet-5-5",
      "sk-x",
    );
    expect(r.url).toBe("https://api.anthropic.com/v1/messages");
    expect(r.headers["x-api-key"]).toBe("sk-x");
    expect(r.headers["anthropic-version"]).toBe("2023-06-01");
    expect(r.body).toContain('"max_tokens":1');
  });
  it("gemini:generateContent + x-goog-api-key + maxOutputTokens=1", () => {
    const r = buildVerifyRequest(
      "gemini",
      "https://generativelanguage.googleapis.com",
      "gemini-2.0-flash",
      "sk-x",
    );
    expect(r.url).toContain("/v1beta/models/gemini-2.0-flash:generateContent");
    expect(r.headers["x-goog-api-key"]).toBe("sk-x");
    expect(r.body).toContain('"maxOutputTokens":1');
  });
  it("baseUrl 尾斜杠归一", () => {
    const r = buildVerifyRequest("openai_chat_completions", "https://a.com/v1///", "m", "k");
    expect(r.url).toBe("https://a.com/v1/chat/completions");
  });
});
