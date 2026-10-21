/** mcp 域 zod（TOOL-002 MCP 服务器配置管理；纯本地口径——上游实证无端点）。 */
import { z } from "zod";

/** stdio 登记（表列注释保留）但不可选——web 单机不拉子进程,运行时随引擎（规格 §2） */
export const MCP_TRANSPORTS = ["streamable_http", "sse", "builtin"] as const;

export const mcpCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  transport: z.enum(MCP_TRANSPORTS),
  endpoint: z
    .string()
    .trim()
    .url()
    .max(512)
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
      message: "仅支持 http(s) endpoint",
    }),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type McpCreateInput = z.infer<typeof mcpCreateInput>;

export const mcpUpdateInput = mcpCreateInput.partial();
export type McpUpdateInput = z.infer<typeof mcpUpdateInput>;

export const mcpDto = z.object({
  id: z.string(),
  name: z.string(),
  transport: z.enum(MCP_TRANSPORTS),
  endpoint: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type McpDto = z.infer<typeof mcpDto>;

export const mcpTestResultDto = z.object({
  status: z.number(),
  tookMs: z.number(),
  bodyText: z.string(),
});
export type McpTestResultDto = z.infer<typeof mcpTestResultDto>;
