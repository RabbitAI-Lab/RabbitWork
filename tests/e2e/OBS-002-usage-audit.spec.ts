import { expect, test } from "./fixtures";

/**
 * OBS-002 用量统计与审计。
 * 规格：docs/sprint-obs-2/OBS-002-usage-audit.md §5。
 */
let seq = 0;
const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("OBS-002-01 对话产生用量:用量 Tab 当日条形 + Top 员工", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  // 自造一轮对话（usage 写入在 run 终态,OBS-001 实证链路）
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E用量员工${uniq("")}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  const conv = await page.request.post(`/api/v1/staffs/${staffId}/conversations`, {
    data: { title: `E2E用量会话${uniq("")}` },
  });
  const convId = ((await conv.json()) as { data: { id: string } }).data.id;
  await page.goto(`/chat/${convId}`);
  await expect(page.getByTestId("chat-messages")).toBeVisible();
  await page.getByTestId("chat-input").fill("用量统计消息");
  await page.getByTestId("chat-input").press("Control+Enter");
  await expect(page.getByTestId("bubble-assistant").first()).toBeVisible({ timeout: 30_000 });
  // 终态强信号（§3.5.1）：done 会 invalidate 会话详情——等该 refetch 完成即 usage 已落
  const detailRefetch = page.waitForResponse(
    (r) => r.url().includes("/api/v1/conversations/") && r.request().method() === "GET",
  );
  await detailRefetch;

  await page.getByRole("link", { name: "运行观测" }).click();
  await expect(page.getByTestId("runs-page")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("tab", { name: "用量" }).click();
  await expect(page.getByTestId("usage-panel")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("usage-bars").locator("div").first()).toBeVisible();
  // 员工维度断言走 API（Top5 按总量排序,单轮用量的新员工可能挤不进前五——不作为 UI 依据）
  const usage = await page.request.get("/api/v1/usage/daily?days=1");
  expect(usage.status()).toBe(200);
  const uj = (await usage.json()) as {
    data: { topEmployees: Array<{ employeeId: string; runs: number }> };
  };
  const mine = uj.data.topEmployees.find((e) => e.employeeId === staffId);
  expect(mine?.runs ?? 0).toBeGreaterThanOrEqual(1);

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("OBS-002-02 变更动作进审计:建团队→审计 Tab 可见 team.create", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const team = await page.request.post("/api/v1/teams", {
    data: { name: uniq("E2E审计团队") },
  });
  const teamId = ((await team.json()) as { data: { id: string } }).data.id;

  await page.goto("/runs");
  await expect(page.getByTestId("runs-page")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("tab", { name: "审计" }).click();
  await expect(page.getByTestId("audit-table")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("audit-table")).toContainText("team.create");

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/teams/${teamId}`);
});

test("OBS-002-03 用量/审计接口未登录 401(守卫,§3.2.2 例外)", async ({ request }) => {
  const u = await request.get("/api/v1/usage/daily");
  expect(u.status()).toBe(401);
  const a = await request.get("/api/v1/audit-logs");
  expect(a.status()).toBe(401);
});
