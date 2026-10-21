/** mcp 域 zod round-trip（TOOL-002 §5）。 */
import { describe, expect, it } from "vitest";
import { mcpCreateInput, mcpUpdateInput } from "../mcp";

describe("mcpCreateInput（TOOL-002）", () => {
  it("合法:transport 枚举 + http(s) endpoint + config 默认空", () => {
    const r = mcpCreateInput.parse({
      name: "内部工具 MCP",
      transport: "streamable_http",
      endpoint: "https://mcp.example.com/mcp",
    });
    expect(r.config).toEqual({});
  });
  it("非法:stdio 不可选/非 http(s)/空名", () => {
    expect(
      mcpCreateInput.safeParse({ name: "x", transport: "stdio", endpoint: "https://a.com" })
        .success,
    ).toBe(false);
    expect(
      mcpCreateInput.safeParse({ name: "x", transport: "sse", endpoint: "ftp://a.com" }).success,
    ).toBe(false);
    expect(
      mcpCreateInput.safeParse({ name: "", transport: "sse", endpoint: "https://a.com" }).success,
    ).toBe(false);
  });
  it("update 部分字段", () => {
    expect(mcpUpdateInput.parse({ name: "n" }).name).toBe("n");
  });
});
