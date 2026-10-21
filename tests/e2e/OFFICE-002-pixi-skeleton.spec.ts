import { expect, test } from "./fixtures";

/**
 * OFFICE-002 · Pixi 工位渲染（原型 docs/design/OFFICE-002-pixi-skeleton/；OFFICE-003 落地后
 * 演示卡已由真实 PixiFloorPlan 取代——2026-10-21 对齐：断言楼层 Pixi canvas 而非 256×192 demo）。
 * 三类断言齐备（rules/testing §3.1）。
 */

test("OFFICE-002-E2E-01 Pixi 楼层 canvas 可见，无 console 错误", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/office");

  // 楼层平面区可见
  await expect(page.getByTestId("office-floor-plan")).toBeVisible();

  // PixiFloorPlan 挂载 canvas（渲染于 office-pixi-floor-wrap 内）
  const canvas = page.getByTestId("office-pixi-floor-wrap").locator("canvas").first();
  await expect(canvas).toBeVisible();

  await expectNoConsoleErrors();
});

test("OFFICE-002-E2E-02 暗 ↔ 亮主题切换：canvas 仍可见且无 console 错误", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/office");
  const canvas = page.getByTestId("office-pixi-floor-wrap").locator("canvas").first();

  // 默认（继承保存的偏好 / 系统偏好 —— 可能是 dark 也可能是 light）
  await expect(canvas).toBeVisible();

  // 暗色（显式）——可见性断言即等待，无硬等待（rules/testing §3.2.3）
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("rw-theme", "dark");
  });
  await expect(canvas).toBeVisible();

  // 亮色
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("rw-theme", "light");
  });
  await expect(canvas).toBeVisible();

  // 不应该出现 console error（颜色桥 MutationObserver 不会抛）
  await expectNoConsoleErrors();
});
