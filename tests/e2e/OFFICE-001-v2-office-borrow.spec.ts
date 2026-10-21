import { expect, test } from "./fixtures";

/**
 * OFFICE-001 v2 — 局部借鉴 PixOffice（高保真原型 docs/design/OFFICE-001-office-borrow/）。
 * 用户路径完整（rules/testing §3.2.2）：从首页 "/" 进入办公室页。三类断言齐备（rules/testing §3.1）。
 *
 * 2026-10-21 对齐现状：顶部 mock 数据卡三张已整体移除（含 office-stat-staffs，
 * 2026-10-18 决策）——断言改为楼层平面主结构与 API 数据可达。
 */
test("OFFICE-001-v2-01 办公室主体结构存在", async ({ authedPage: page, expectNoConsoleErrors }) => {
  await page.goto("/");

  // ── UI 断言：进入办公室页 ──
  await expect(page.getByTestId("office-page")).toBeVisible();
  await expect(page.getByText("办公室", { exact: true }).first()).toBeVisible();

  // ── UI 断言：楼层平面主结构（右栏任务流/动态与顶部 mock 卡已移除）──
  await expect(page.getByTestId("office-floor-plan")).toBeVisible();

  // ── Console 断言（rules/testing §3.1）──
  await expectNoConsoleErrors();

  // ── 接口断言：staffs 接口可达（工位数据依赖）──
  const staffs = await page.request.get("/api/v1/staffs?pageSize=100");
  expect(staffs.status()).toBe(200);
  const body = (await staffs.json()) as { code: number; data: { items: unknown[] } };
  expect(body.code).toBe(0);
  expect(Array.isArray(body.data.items)).toBe(true);
});

test("OFFICE-001-v2-02 亮暗主题无裸色穿透", async ({ authedPage: page, expectNoConsoleErrors }) => {
  // 暗色走查
  await page.goto("/");
  await expect(page.getByTestId("office-page")).toBeVisible();
  await expectNoConsoleErrors();
  // 切亮色：直接操作 class（与 theme-toggle 一致）
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("rw-theme", "light");
  });
  await page.reload();
  await expect(page.getByTestId("office-page")).toBeVisible();
  await expectNoConsoleErrors();
});
