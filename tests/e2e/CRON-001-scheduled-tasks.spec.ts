import { expect, test } from "./fixtures";

/**
 * CRON-001 定时任务。
 * 规格：docs/sprint-cron-1/CRON-001-scheduled-tasks.md §5。
 */
let seq = 0;
const uniq = () => `E2E任务-${Date.now().toString(36)}-${(seq++).toString(36)}`;

async function setup(page: import("@playwright/test").Page) {
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E定时员工${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  return staffId;
}

test("CRON-001-01 建任务→立即执行→运行历史 SUCCEEDED", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const staffId = await setup(page);
  const name = uniq();
  await page.goto("/scheduled-tasks");
  await expect(page.getByTestId("cron-page")).toBeVisible({ timeout: 15_000 });

  // 建任务
  await page.getByTestId("cron-create-btn").click();
  await page.getByTestId("cron-form-name").fill(name);
  await page.getByTestId("cron-form-cron").fill("0 9 * * *");
  await page.locator(".ant-select").first().click();
  await page.getByRole("option").first().click();
  await page.getByTestId("cron-form-template").fill("输出 {{日期}} 测试站报");
  const created = expectApi("**/api/v1/scheduled-tasks", "POST");
  await page.getByRole("button", { name: /^(创\s*建|OK)$/ }).click();
  expect((await created).status).toBe(201);
  await expect(page.getByTestId("cron-table")).toContainText(name);

  // 立即执行 → run SUCCEEDED
  const runApi = expectApi("**/api/v1/scheduled-tasks/*/run", "POST");
  await page
    .getByTestId("cron-table")
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: /立即执行/u })
    .click();
  const run = await runApi;
  expect(run.code).toBe(0);
  expect((run.data as { status: string }).status).toBe("SUCCEEDED");

  // 展开行看运行历史（antd 展开钮无名称——按第一行展开图标 role=button 定位）
  await page.getByTestId("cron-table").locator("button.ant-table-row-expand-icon").first().click();
  await expect(page.getByRole("cell", { name: "SUCCEEDED" }).first()).toBeVisible();

  await expectNoConsoleErrors();
  // 清理:删任务+软删员工
  const list = await page.request.get("/api/v1/scheduled-tasks");
  const tasks = ((await list.json()) as { data: { items: Array<{ name: string; id: string }> } })
    .data.items;
  const mine = tasks.find((t) => t.name === name);
  if (mine) await page.request.delete(`/api/v1/scheduled-tasks/${mine.id}`);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("CRON-001-02 非法 cron 422（真实原因透出）", async ({ authedPage: page }) => {
  const staffId = await setup(page);
  const res = await page.request.post("/api/v1/scheduled-tasks", {
    data: { name: uniq(), cron: "99 * * * *", employeeId: staffId, inputTemplate: "x" },
  });
  expect(res.status()).toBe(422);
  const body = (await res.json()) as { message: string };
  expect(body.message).toContain("cron");
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("CRON-001-03 未登录跳转登录(守卫,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/scheduled-tasks");
  await expect(page).toHaveURL(/\/login\?next=%2Fscheduled-tasks/u);
});
