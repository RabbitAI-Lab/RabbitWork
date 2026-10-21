import { expect, test } from "./fixtures";

/**
 * INFRA-001 脚手架冒烟（三类断言齐备：UI + Console + 接口，rules/testing §3.1）。
 * 2026-10-21 对齐现状：`/` 已改为 redirect → /office（首页改版，home-* testid 移除）；
 * Tailwind 红线断言（rules/react-nextjs §5.5）迁至 office 页 font-mono 元素。
 */
test("INFRA-001-01 脚手架冒烟：首页重定向 office + Tailwind 生效 + health/ready 可用", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/");

  // ── UI 断言：`/` 重定向至办公室（首页改版后的固定行为）──
  await expect(page).toHaveURL(/\/office/u);
  await expect(page.getByTestId("office-page")).toBeVisible();

  // 样式加载红线（rules/react-nextjs §5.5）：Tailwind 未安装/构建丢失立即红灯
  // （楼层计数 span 使用 font-mono 工具类；原 home-main 元素随首页改版移除）
  const mono = await page
    .getByText(/工位在用/u)
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(mono.toLowerCase()).toContain("jetbrains mono");

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
