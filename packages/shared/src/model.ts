/** model 域 zod + 验证请求构造纯函数（MODEL-001;上游实证无模型端点→本地协议化配置）。 */
import { z } from "zod";

export const MODEL_PROTOCOLS = ["openai_chat_completions", "anthropic", "gemini"] as const;
export type ModelProtocol = (typeof MODEL_PROTOCOLS)[number];

/** 验证状态机（MODEL-001 §2.2）：同步验证,VERIFYING 为瞬时态（首期不落库停留） */
export const MODEL_STATUSES = ["UNVERIFIED", "VERIFYING", "VERIFIED", "FAILED"] as const;

/** apiKey 掩码占位：详情回显值;编辑回传该占位 = 沿用旧密文（同 TOOL-001 掩码契约） */
export const MASKED_APIKEY_PLACEHOLDER = "••••••••";

export const modelCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  protocol: z.enum(MODEL_PROTOCOLS),
  baseUrl: z
    .string()
    .trim()
    .url()
    .max(512)
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
      message: "仅支持 http(s) baseUrl",
    }),
  modelId: z.string().trim().min(1).max(128),
  apiKey: z.string().trim().min(1).max(512),
  isDefault: z.boolean().optional(),
});
export type ModelCreateInput = z.infer<typeof modelCreateInput>;

export const modelUpdateInput = modelCreateInput.partial();
export type ModelUpdateInput = z.infer<typeof modelUpdateInput>;

export const modelDto = z.object({
  id: z.string(),
  name: z.string(),
  protocol: z.enum(MODEL_PROTOCOLS),
  baseUrl: z.string(),
  modelId: z.string(),
  /** 恒掩码,永不回显明文 */
  apiKey: z.string(),
  status: z.enum(MODEL_STATUSES),
  isDefault: z.boolean(),
  lastError: z.string().nullable(),
  lastVerifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ModelDto = z.infer<typeof modelDto>;

export const modelVerifyResultDto = z.object({
  status: z.enum(["VERIFIED", "FAILED"]),
  tookMs: z.number(),
  replySnippet: z.string().nullable(),
  error: z.string().nullable(),
});
export type ModelVerifyResultDto = z.infer<typeof modelVerifyResultDto>;

/**
 * 按协议构造最小验证 chat 请求（MODEL-001 §2.2;纯函数,单测锚点）。
 * 目标：1 token 内的最小对话,max_tokens=1。
 */
export function buildVerifyRequest(
  protocol: ModelProtocol,
  baseUrl: string,
  modelId: string,
  apiKey: string,
): { url: string; method: "POST"; headers: Record<string, string>; body: string } {
  const trimSlash = baseUrl.replace(/\/+$/u, "");
  if (protocol === "openai_chat_completions") {
    return {
      url: `${trimSlash}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    };
  }
  if (protocol === "anthropic") {
    return {
      url: `${trimSlash}/v1/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    };
  }
  return {
    url: `${trimSlash}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  };
}
