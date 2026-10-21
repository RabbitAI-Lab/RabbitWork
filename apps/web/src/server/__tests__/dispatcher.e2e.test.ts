/** guardedFetch 行为级验证（TOOL-001：前置解析守卫快速拒绝私网）。放行路径由 e2e 栈验证。 */
import { describe, expect, it } from "vitest";
import { guardedFetch } from "../outbound";

describe("guardedFetch 守卫行为", () => {
  it("私网字面 IP → 快速失败且原因含「私网」", async () => {
    const t0 = Date.now();
    await expect(guardedFetch("http://10.99.99.99/x", { method: "GET" })).rejects.toThrow(/私网/u);
    expect(Date.now() - t0).toBeLessThan(3000);
  }, 8000);

  it("环回不在白名单（vitest 进程无 env）→ 拒绝", async () => {
    await expect(guardedFetch("http://127.0.0.1:1/x", { method: "GET" })).rejects.toThrow(/私网/u);
  }, 8000);
});
