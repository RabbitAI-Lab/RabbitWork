import { expect, test } from "./fixtures";

/**
 * CHNL-001 渠道接入。
 * 规格：docs/sprint-chnl-1/CHNL-001-im-channels.md §5。
 */
let seq = 0;
const uniq = () => `E2E渠道-${Date.now().toString(36)}-${(seq++).toString(36)}`;

async function setupStaff(page: import("@playwright/test").Page) {
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E渠道员工${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  return staffId;
}

test("CHNL-001-01 建渠道→webhook 消息→会话落库→同用户复用会话", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const staffId = await setupStaff(page);
  // 建渠道拿 token（API 级——UI 链路按钮交互在 03 简化;token 一次性展示已由 APIKEY 同款覆盖）
  const created = await page.request.post("/api/v1/channels", {
    data: { name: uniq(), platform: "feishu", employeeId: staffId },
  });
  expect(created.status()).toBe(201);
  const body = ((await created.json()) as { data: { id: string; token: string } }).data;

  // webhook 第一条消息（飞书形态）
  const r1 = await page.request.post(`/api/open/v1/channels/${body.token}/messages`, {
    data: {
      event: {
        message: { content: JSON.stringify({ text: "我的工单进度如何" }) },
        sender: { sender_id: { open_id: "ou_e2e_1" } },
      },
    },
  });
  expect(r1.status()).toBe(201);
  const conv1 = ((await r1.json()) as { data: { conversationId: string } }).data.conversationId;

  // 同一外部用户第二条 → 复用同一会话
  const r2 = await page.request.post(`/api/open/v1/channels/${body.token}/messages`, {
    data: { text: "追问：昨天提交的那单", user: "ou_e2e_1" },
  });
  expect(r2.status()).toBe(201);
  const conv2 = ((await r2.json()) as { data: { conversationId: string } }).data.conversationId;
  expect(conv2).toBe(conv1);

  // 会话内容可见
  const conv = await page.request.get(`/api/v1/conversations/${conv1}`);
  const convBody = (await conv.json()) as { data: { messages: Array<{ content: string }> } };
  expect(convBody.data.messages.some((m) => m.content.includes("工单进度"))).toBe(true);
  expect(convBody.data.messages.some((m) => m.content.includes("追问"))).toBe(true);

  // 管理面列表可见
  await page.goto("/channels");
  await expect(page.getByTestId("channels-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("channels-table")).toContainText("飞书");

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/channels/${body.id}`);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("CHNL-001-02 伪造 token 404 / 停用后 404 / 未识别形态 422", async ({ authedPage: page }) => {
  const fake = await page.request.post("/api/open/v1/channels/rw_ch_forged_token_zzz/messages", {
    data: { text: "x" },
  });
  expect(fake.status()).toBe(404);

  const staffId = await setupStaff(page);
  const created = await page.request.post("/api/v1/channels", {
    data: { name: uniq(), platform: "wecom", employeeId: staffId, enabled: false },
  });
  const ch = ((await created.json()) as { data: { id: string; token: string } }).data;
  const disabled = await page.request.post(`/api/open/v1/channels/${ch.token}/messages`, {
    data: { text: "x" },
  });
  expect(disabled.status()).toBe(404);

  // 启用后未识别形态 422
  await page.request.patch(`/api/v1/channels/${ch.id}`, { data: { enabled: true } });
  const bad = await page.request.post(`/api/open/v1/channels/${ch.token}/messages`, {
    data: { unrelated: true },
  });
  expect(bad.status()).toBe(422);

  await page.request.delete(`/api/v1/channels/${ch.id}`);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("CHNL-001-03 管理面未登录守卫(§3.2.2 例外)", async ({ page }) => {
  await page.goto("/channels");
  await expect(page).toHaveURL(/\/login\?next=%2Fchannels/u);
});
