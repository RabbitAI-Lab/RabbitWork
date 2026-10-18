import { expect, test } from "./fixtures";

/**
 * OFFICE-001 v2 — 局部借鉴 PixOffice（高保真原型 docs/design/OFFICE-001-office-borrow/）。
 * 用户路径完整（rules/testing §3.2.2）：从首页 "/" 进入办公室页。三类断言齐备（rules/testing §3.1）。
 *
 * 涵盖（高保真原型段落对应）：
 *  - office-stat-staffs：顶部唯一保留的数据卡（其余三张与右栏任务流/动态均为 mock，
 *    agentscope 平台无 Task 概念，2026-10-18 决策移除）
 *  - 底部 chat composer 2026-10-18 一并移除（办公室页只保留"看 + 安排工位"）
 */
test("OFFICE-001-v2-01 数据卡存在", async ({ page, expectNoConsoleErrors }) => {
  await page.goto("/");

  // ── UI 断言：进入办公室页 ──
  await expect(page.getByTestId("office-page")).toBeVisible();
  await expect(page.getByText("办公室", { exact: true }).first()).toBeVisible();

  // ── UI 断言：顶部数据卡（仅保留 AI 员工一项；其余 mock 卡已移除）──
  await expect(page.getByTestId("office-stat-staffs")).toBeVisible();
  await expect(page.getByTestId("office-stat-staffs")).toContainText("AI 员工");

  // ── Console 断言（rules/testing §3.1）──
  await expectNoConsoleErrors();

  // ── 接口断言：staffs 接口可达（顶部 AI 员工 / 待安排都依赖）──
  const staffs = await page.request.get("/api/v1/staffs?pageSize=100");
  expect(staffs.status()).toBe(200);
  const body = (await staffs.json()) as { code: number; data: { items: unknown[] } };
  expect(body.code).toBe(0);
  expect(Array.isArray(body.data.items)).toBe(true);
});

test("OFFICE-001-v2-02 亮暗主题无裸色穿透", async ({ page, expectNoConsoleErrors }) => {
  // 暗色走查
  await page.goto("/");
  await expect(page.getByTestId("office-stat-staffs")).toBeVisible();
  await expectNoConsoleErrors();
  // 切亮色：直接操作 class（与 theme-toggle 一致）
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("rw-theme", "light");
  });
  await page.reload();
  await expect(page.getByTestId("office-stat-staffs")).toBeVisible();
  await expectNoConsoleErrors();
});
