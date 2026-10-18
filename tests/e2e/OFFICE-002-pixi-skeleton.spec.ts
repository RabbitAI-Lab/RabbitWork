import { expect, test } from "./fixtures";

/**
 * OFFICE-002 · Pixi 演示工位骨架（高保真原型 docs/design/OFFICE-002-pixi-skeleton/）。
 * 三类断言齐备（rules/testing §3.1）。
 *
 * 覆盖 SPEC §1.4：
 *  - OFFCIE-002-02 demo 可见（含一个 <canvas>）
 *  - OFFCIE-002-04 切主题不抛错，canvas 仍可见
 *  - OFFCIE-002-05 与现有 Q 版 20 工位共存不崩（首页仍正常）
 */

test("OFFICE-002-E2E-01 Pixi 演示工位可见：含 <canvas>，无 console 错误", async ({
  page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/office");

  // demo 卡片可见
  await expect(page.getByTestId("office-pixi-demo-section")).toBeVisible();

  // demo 卡片内含一个 <canvas>（Pixi 把 canvas 挂到 div 内）
  const canvas = page.getByTestId("office-pixi-demo").locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBe(256);
  expect(box?.height).toBe(192);

  // 现有 20 工位仍渲染
  await expect(page.getByTestId("office-floor-plan")).toBeVisible();
  const seated = page.locator('[data-testid^="office-seat-1f-"]');
  expect(await seated.count()).toBeGreaterThan(0);

  await expectNoConsoleErrors();
});

test("OFFICE-002-E2E-02 暗 ↔ 亮主题切换：canvas 仍可见且无 console 错误", async ({
  page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/office");
  const canvas = page.getByTestId("office-pixi-demo").locator("canvas").first();

  // 默认（继承保存的偏好 / 系统偏好 —— 可能是 dark 也可能是 light）
  await expect(canvas).toBeVisible();

  // 暗色（显式）
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("rw-theme", "dark");
  });
  await page.waitForTimeout(150);
  await expect(canvas).toBeVisible();

  // 亮色
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("rw-theme", "light");
  });
  await page.waitForTimeout(150);
  await expect(canvas).toBeVisible();

  // 不应该出现 console error（颜色桥 MutationObserver 不会抛）
  await expectNoConsoleErrors();
});
