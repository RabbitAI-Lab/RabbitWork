import { expect, test } from "./fixtures";

/**
 * OBS-003 API Key 与开放 API。
 * 规格：docs/sprint-obs-3/OBS-003-api-keys.md §5。
 */
let seq = 0;
const uniq = () => `E2E-Key-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("OBS-003-01 建 Key→明文一次性展示→列表前缀", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const name = uniq();
  await page.goto("/settings/api-keys");
  await expect(page.getByTestId("apikeys-page")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("apikey-create-btn").click();
  await page.getByTestId("apikey-form-name").fill(name);
  await page.getByRole("button", { name: /^(创\s*建|OK)$/ }).click();
  // 一次性明文
  const plaintext = await page.getByTestId("apikey-plaintext").textContent();
  expect(plaintext).toMatch(/^rw_live_/u);
  await page.getByRole("button", { name: /我已保存/u }).click();
  // 列表前缀
  await expect(page.getByTestId("apikey-table")).toContainText(name);
  await expect(page.getByTestId("apikey-table")).toContainText("rw_live_");

  await expectNoConsoleErrors();
});

test("OBS-003-02 开放 API 全链路:Key 建会话+发消息→吊销→401", async ({ page }) => {
  // API 级：登录拿 session → 建 Key（拿明文）
  await page.request.post("/api/v1/auth/login", {
    data: { email: "admin@rabbitwork.local", password: "rabbit123" },
  });
  const keyRes = await page.request.post("/api/v1/api-keys", {
    data: { name: uniq(), expiresInDays: 30 },
  });
  expect(keyRes.status()).toBe(201);
  const key = ((await keyRes.json()) as { data: { id: string; plaintext: string } }).data;
  const auth = { Authorization: `Bearer ${key.plaintext}` };

  // 员工（发布,mock 运行面）
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E开放员工${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });

  // 开放 API：创建会话
  const convRes = await page.request.post("/api/open/v1/conversations", {
    headers: auth,
    data: { staffId },
  });
  expect(convRes.status()).toBe(201);
  const convId = ((await convRes.json()) as { data: { id: string } }).data.id;

  // 发消息（mock 员工 sendTurn 成功即 201）
  const msgRes = await page.request.post(`/api/open/v1/conversations/${convId}/messages`, {
    headers: auth,
    data: { content: "开放 API 消息" },
  });
  expect(msgRes.status()).toBe(201);

  // 详情
  const detail = await page.request.get(`/api/open/v1/conversations/${convId}`, { headers: auth });
  expect(detail.status()).toBe(200);

  // 吊销后 401
  const revoke = await page.request.delete(`/api/v1/api-keys/${key.id}`);
  expect(revoke.status()).toBe(200);
  const after = await page.request.get(`/api/open/v1/conversations/${convId}`, { headers: auth });
  expect(after.status()).toBe(401);

  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("OBS-003-03 伪造 Key 与未认证 → 401(守卫,§3.2.2 例外)", async ({ request }) => {
  const fake = await request.get("/api/open/v1/conversations/xxx", {
    headers: { Authorization: "Bearer rw_live_forged_key_zzz" },
  });
  expect(fake.status()).toBe(401);
  const none = await request.get("/api/open/v1/conversations/xxx");
  expect(none.status()).toBe(401);
});
