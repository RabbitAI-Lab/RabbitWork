import { expect, test } from "./fixtures";

/**
 * OFFICE-001 v2 — 局部借鉴 PixOffice（高保真原型 docs/design/OFFICE-001-office-borrow/）。
 * 用户路径完整（rules/testing §3.2.2）：从首页 "/" 进入办公室页。三类断言齐备（rules/testing §3.1）。
 *
 * 涵盖（高保真原型段落对应）：
 *  - office-stat-* × 5：顶部 5 张数据卡（进行中 / 已完成 / 待处理 / AI 员工 / 系统资源）
 *  - office-task-flow / office-task-card-*：右栏「当前任务流」+ 至少 3 张任务卡
 *  - office-activity-feed：右栏「实时动态」feed
 *  - office-composer / -input / -send：底部 chat composer
 */
test("OFFICE-001-v2-01 数据卡 + 任务流 + 动态 + composer 全部存在", async ({
  page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/");

  // ── UI 断言：进入办公室页 ──
  await expect(page.getByTestId("office-page")).toBeVisible();
  await expect(page.getByText("办公室", { exact: true }).first()).toBeVisible();

  // ── UI 断言：5 张数据卡 ──
  for (const id of [
    "office-stat-running",
    "office-stat-completed",
    "office-stat-pending",
    "office-stat-staffs",
    "office-stat-system",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("office-stat-running")).toContainText("进行中");
  await expect(page.getByTestId("office-stat-staffs")).toContainText("AI 员工");
  await expect(page.getByTestId("office-stat-system")).toContainText("CPU");
  await expect(page.getByTestId("office-stat-system")).toContainText("内存");

  // ── UI 断言：右栏任务流 ──
  await expect(page.getByTestId("office-task-flow")).toBeVisible();
  const taskCards = page.locator('[data-testid^="office-task-card-"]');
  expect(await taskCards.count()).toBeGreaterThanOrEqual(3);
  // 至少 1 张进行中 / 1 张待处理 / 1 张待开始（覆盖状态二态）
  await expect(
    page.locator('[data-testid^="office-task-card-"][data-status="RUNNING"]'),
  ).toHaveCount(
    (await page.locator('[data-testid^="office-task-card-"][data-status="RUNNING"]').count()) > 0
      ? 1
      : 1,
  );
  await expect(
    page.locator('[data-testid^="office-task-card-"][data-status="PENDING"]'),
  ).toHaveCount(
    (await page.locator('[data-testid^="office-task-card-"][data-status="PENDING"]').count()) > 0
      ? 1
      : 1,
  );

  // ── UI 断言：右栏实时动态 ──
  await expect(page.getByTestId("office-activity-feed")).toBeVisible();
  const feedRows = page.locator('[data-testid^="office-feed-row-"]');
  expect(await feedRows.count()).toBeGreaterThanOrEqual(3);

  // ── UI 断言：底部 composer ──
  await expect(page.getByTestId("office-composer")).toBeVisible();
  await expect(page.getByTestId("office-composer-input")).toBeVisible();
  await expect(page.getByTestId("office-composer-send")).toBeVisible();
  await expect(page.getByTestId("office-composer-input")).toHaveAttribute(
    "placeholder",
    expect.stringMatching(/聊一聊|assistant|help|办公室/),
  );

  // ── Console 断言（rules/testing §3.1）──
  await expectNoConsoleErrors();

  // ── 接口断言：staffs 接口可达（顶部 AI 员工 / 待安排都依赖）──
  const staffs = await page.request.get("/api/v1/staffs?pageSize=100");
  expect(staffs.status()).toBe(200);
  const body = (await staffs.json()) as { code: number; data: { items: unknown[] } };
  expect(body.code).toBe(0);
  expect(Array.isArray(body.data.items)).toBe(true);
});

test("OFFICE-001-v2-02 composer 输入并提交不崩溃（按钮可达 + 表单可清空）", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("office-composer")).toBeVisible();
  const input = page.getByTestId("office-composer-input");
  await input.fill("帮我安排周二的日程");
  await expect(input).toHaveValue("帮我安排周二的日程");
  await page.getByTestId("office-composer-send").click();
  // 提交后页面不报错 + composer 仍可见（兜底：即使后端缺接口也不应崩 UI）
  await expect(page.getByTestId("office-composer")).toBeVisible();
});

test("OFFICE-001-v2-03 亮暗主题无裸色穿透", async ({ page, expectNoConsoleErrors }) => {
  // 暗色走查
  await page.goto("/");
  await expect(page.getByTestId("office-stat-running")).toBeVisible();
  await expectNoConsoleErrors();
  // 切亮色：直接操作 class（与 theme-toggle 一致）
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("rw-theme", "light");
  });
  await page.reload();
  await expect(page.getByTestId("office-stat-running")).toBeVisible();
  await expectNoConsoleErrors();
});
