import { expect, test } from "./fixtures";

/**
 * INFRA-001 脚手架冒烟（三类断言齐备：UI + Console + 接口，rules/testing §3.1）。
 * 用户路径完整（§3.2.2）：从首页 `/` 出发。
 */
test("INFRA-001-01 脚手架冒烟：首页渲染 + Tailwind 生效 + health/ready 可用", async ({
  page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/");

  // ── UI 断言 ──
  await expect(page.getByTestId("home-title")).toHaveText("RabbitWork");
  await expect(page.getByTestId("home-subtitle")).toBeVisible();

  // 样式加载红线（rules/react-nextjs §5.5）：Tailwind 未安装/构建丢失立即红灯
  // （bg-slate-50 在 Tailwind v4 为 oklch 色；RabbitAITest「类名写了但 Tailwind 未安装」事故的守门断言）
  const bg = await page
    .getByTestId("home-main")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("oklch(0.984 0.003 247.858)");

  // ── Console 断言 ──
  await expectNoConsoleErrors();

  // ── 接口断言 ──
  const health = await page.request.get("/api/v1/system/health");
  expect(health.status()).toBe(200);
  const healthBody = (await health.json()) as {
    code: number;
    data: { status: string };
  };
  expect(healthBody.code).toBe(0);
  expect(healthBody.data.status).toBe("alive");
  // reqId 链路（rules/observability §4）：响应头必须带 X-Request-Id
  expect(health.headers()["x-request-id"]).toBeTruthy();

  const ready = await page.request.get("/api/v1/system/ready");
  expect(ready.status()).toBe(200);
  const readyBody = (await ready.json()) as {
    code: number;
    data: { checks: Record<string, { ok: boolean }> };
  };
  expect(readyBody.code).toBe(0);
  expect(readyBody.data.checks.database?.ok).toBe(true);
});
