import { expect, test } from "./fixtures";

/**
 * CHAT-003 HITL 人工接管。
 * 规格：docs/sprint-chat-3/CHAT-003-hitl-handoff.md §5。
 */
let seq = 0;
const uniq = () => `E2E接管-${Date.now().toString(36)}-${(seq++).toString(36)}`;

async function setupConv(page: import("@playwright/test").Page) {
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E接管员工${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  const conv = await page.request.post(`/api/v1/staffs/${staffId}/conversations`, {
    data: { title: `E2E会话${uniq()}` },
  });
  const convId = ((await conv.json()) as { data: { id: string } }).data.id;
  return { staffId, convId };
}

test("CHAT-003-01 转人工→HANDOFF 拦截→工作台解决→恢复", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const { staffId, convId } = await setupConv(page);
  await page.goto(`/chat/${convId}`);
  await expect(page.getByTestId("chat-messages")).toBeVisible();

  // ── 转人工（reason 必填） ──
  const hoApi = expectApi("**/api/v1/conversations/*/handoff", "POST");
  await page.getByTestId("handoff-btn").click();
  await page.getByTestId("handoff-reason-input").fill("退款诉求超出答复边界");
  await page.getByRole("button", { name: /^(转\s*人\s*工|OK)$/ }).click();
  const ho = await hoApi;
  expect(ho.status).toBe(201);
  expect((ho.data as { status: string }).status).toBe("PENDING");
  // 黄条 + 系统消息
  await expect(page.getByTestId("handoff-banner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("chat-messages")).toContainText(/已转人工处理/u);

  // ── HANDOFF 态发消息 → 422 ──
  const blocked = await page.request.post(`/api/v1/conversations/${convId}/messages`, {
    data: { content: "应该被拦" },
  });
  expect(blocked.status()).toBe(422);

  // ── 工作台认领→解决 ──
  await page
    .getByTestId("handoff-banner")
    .getByText(/去处理/u)
    .click();
  await expect(page.getByTestId("handoffs-page")).toBeVisible({ timeout: 15_000 });
  await page
    .getByTestId("handoffs-table")
    .getByRole("row")
    .filter({ hasText: "退款诉求" })
    .getByRole("button", { name: /认\s*领/u })
    .click();
  await expect(
    page.getByTestId("handoffs-table").getByRole("row").filter({ hasText: "退款诉求" }),
  ).toContainText("HANDLING");
  const resApi = expectApi("**/api/v1/handoffs/*/resolve", "POST");
  await page
    .getByTestId("handoffs-table")
    .getByRole("row")
    .filter({ hasText: "退款诉求" })
    .getByRole("button", { name: /解\s*决/u })
    .click();
  await page.getByTestId("handoff-conclusion-input").fill("已按流程退款");
  await page.getByRole("button", { name: /解\s*决\s*并\s*恢\s*复/u }).click();
  expect((await resApi).code).toBe(0);

  // ── 会话恢复:可再发消息 ──
  const ok = await page.request.post(`/api/v1/conversations/${convId}/messages`, {
    data: { content: "恢复后消息" },
  });
  expect(ok.status()).toBe(201);

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("CHAT-003-02 重复转人工 422（未解决记录存在）", async ({ authedPage: page }) => {
  const { staffId, convId } = await setupConv(page);
  const first = await page.request.post(`/api/v1/conversations/${convId}/handoff`, {
    data: { reason: "第一次" },
  });
  expect(first.status()).toBe(201);
  const second = await page.request.post(`/api/v1/conversations/${convId}/handoff`, {
    data: { reason: "第二次" },
  });
  expect(second.status()).toBe(422);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("CHAT-003-03 未登录守卫(§3.2.2 例外)", async ({ page }) => {
  await page.goto("/handoffs");
  await expect(page).toHaveURL(/\/login\?next=%2Fhandoffs/u);
});
