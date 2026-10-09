import { test as base, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * rules/testing.md §3.1 三类断言公共夹具（禁止各用例手写收集逻辑）：
 * - expectNoConsoleErrors：全程 console.error / pageerror 收集（白名单显式登记）
 * - expectApi：关键链路网络断言（状态码 + 响应体 code/data；method 钉方法）
 * - page：每条 UI 用例结束自动整页截屏（rules/testing §3.6）
 * - authedPage：注册 + 会话注入（随首个 SYS 认证规格加入，RabbitAITest fixtures.ts 先例）
 */

export interface ConsoleNoise {
  pageUrlPattern: string;
  textPattern: string;
  reason: string;
}

export const test = base.extend<{
  page: import("@playwright/test").Page;
  expectNoConsoleErrors: (whitelist?: ConsoleNoise[]) => Promise<void>;
  expectApi: (
    urlGlob: string,
    method?: string,
  ) => Promise<{ status: number; code: number; data: unknown; body: unknown }>;
}>({
  page: async ({ page: basePage }, use, testInfo) => {
    await use(basePage);
    try {
      const dir = path.join(process.cwd(), "test-results", "screenshots");
      mkdirSync(dir, { recursive: true });
      const name = testInfo.titlePath
        .slice(1)
        .join("-")
        .replace(/[^\w\u4e00-\u9fa5-]+/g, "_")
        .slice(0, 120);
      await basePage.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
    } catch {
      /* 页面已关闭等场景忽略 */
    }
  },
  expectNoConsoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console.error] ${page.url()} ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`[pageerror] ${page.url()} ${err.message}`));
    // 页面上下文 4xx/5xx 一并留痕（console.error 不带 URL，排障盲区）
    page.on("response", (res) => {
      if (res.status() >= 400 && ["xhr", "fetch"].includes(res.request().resourceType())) {
        errors.push(
          `[http ${res.status()}] ${res.request().method()} ${res.url()} @ ${page.url()}`,
        );
      }
    });
    await use(async (whitelist: ConsoleNoise[] = []) => {
      const filtered = errors.filter(
        (e) =>
          !whitelist.some(
            (w) => new RegExp(w.textPattern).test(e) && new RegExp(w.pageUrlPattern).test(e),
          ),
      );
      expect(filtered, `页面存在 console 错误（未入白名单）：\n${filtered.join("\n")}`).toEqual([]);
    });
  },
  expectApi: async ({ page }, use) => {
    await use(async (urlGlob: string, method?: string) => {
      // waitForResponse 匹配本用例触发的接口（断言作用域化 rules/testing §3.5.1）。
      // method：集合 URL（同路径 GET 列表刷新与 POST 创建并存）必须钉住方法——高压并发下
      // GET 刷新曾抢先进队被误捕（RabbitAITest CASE-002-01 CI 实证）
      let res = await page.waitForResponse(urlGlob);
      while (method && res.request().method() !== method) {
        res = await page.waitForResponse(urlGlob);
      }
      const body = (await res.json().catch(() => ({}))) as { code?: number; data?: unknown };
      return { status: res.status(), code: body.code ?? -1, data: body.data ?? null, body };
    });
  },
});

export { expect };
