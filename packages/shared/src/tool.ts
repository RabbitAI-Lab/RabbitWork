/** tool 域 zod（TOOL-001 HTTP 工具定义与试运行；纯本地口径——上游实证无端点）。 */
import { z } from "zod";

export const TOOL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** 敏感头键关键字（命中即加密列存储,rules/security §4.2） */
export const TOOL_SENSITIVE_HEADER_KEYS = ["authorization", "apikey", "token", "secret"] as const;

/** 敏感头掩码占位：详情回显值;编辑回传该占位 = 沿用旧值不重加密（TOOL-001 §2.1） */
export const MASKED_HEADER_PLACEHOLDER = "••••••••";

const headerValue = z.string().trim().min(1).max(2048);

export const toolCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).optional(),
  method: z.enum(TOOL_METHODS).default("GET"),
  url: z
    .string()
    .trim()
    .url()
    .max(512)
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
      message: "仅支持 http(s) URL",
    }),
  headers: z.record(z.string().trim().min(1).max(128), headerValue).default({}),
});
export type ToolCreateInput = z.infer<typeof toolCreateInput>;

export const toolUpdateInput = toolCreateInput.partial();
export type ToolUpdateInput = z.infer<typeof toolUpdateInput>;

export const toolDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  method: z.enum(TOOL_METHODS),
  url: z.string(),
  /** 敏感头值永不回显——固定掩码占位 */
  headers: z.record(z.string(), z.string()),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ToolDto = z.infer<typeof toolDto>;

export const toolTestRunInput = z.object({
  /** 渲染 URL {{占位}} 与（POST/PUT/PATCH 时）请求体 */
  params: z.record(z.string().min(1), z.unknown()).default({}),
  body: z.unknown().optional(),
});
export type ToolTestRunInput = z.infer<typeof toolTestRunInput>;

export const toolTestRunResultDto = z.object({
  status: z.number(),
  tookMs: z.number(),
  truncated: z.boolean(),
  bodyText: z.string(),
});
export type ToolTestRunResultDto = z.infer<typeof toolTestRunResultDto>;

/** URL {{占位}} 渲染（TOOL-001 §2.2；未识别占位符报错——rules/engine §4.3 同口径） */
export function renderTemplate(tpl: string, params: Record<string, unknown>): string {
  return tpl.replace(/\{\{([^}]+)\}\}/gu, (_, rawKey) => {
    const key = String(rawKey).trim();
    if (!(key in params)) {
      throw new Error(`未识别的占位符 {{${key}}}（请在中提供该参数）`);
    }
    return encodeURIComponent(String(params[key]));
  });
}

export function isSensitiveHeader(key: string): boolean {
  // 连字符归一（X-Api-Key → xapikey）——命中关键字即视为敏感
  const lower = key.toLowerCase().replace(/-/gu, "");
  return TOOL_SENSITIVE_HEADER_KEYS.some((k) => lower.includes(k));
}
