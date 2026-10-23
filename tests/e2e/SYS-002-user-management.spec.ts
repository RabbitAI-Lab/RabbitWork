import { expect, test } from "./fixtures";

/**
 * SYS-002 用户管理。
 * 规格：docs/sprint-sys-2/SYS-002-user-management.md §5。
 * 02 为全马拉松首条 MEMBER 403 e2e（jmx 403 豁免收口）。
 */
let seq = 0;
const uniq = () => `e2euser${Date.now().toString(36)}${(seq++).toString(36)}`;

test("SYS-002-01 ADMIN 创建 MEMBER→一次性密码→MEMBER 登录成功", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const email = `${uniq()}@test.local`;
  await page.goto("/users");
  await expect(page.getByTestId("users-page")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("user-create-btn").click();
  await page.getByTestId("user-form-email").fill(email);
  await page.getByTestId("user-form-name").fill("张三");
  const created = expectApi("**/api/v1/users", "POST");
  await page.getByRole("button", { name: /^(创\s*建|OK)$/ }).click();
  const res = await created;
  expect(res.status).toBe(201);
  const pwd = (res.data as { password: string }).password;
  expect(pwd).toHaveLength(12);
  // 一次性密码展示
  await expect(page.getByTestId("password-reveal")).toHaveText(pwd);
  await page.getByRole("button", { name: /我已保存/u }).click();
  await expect(page.getByTestId("users-table")).toContainText(email);

  // MEMBER 用一次性密码可登录（新 context 模拟）
  const ctx = await page.context().browser()?.newContext();
  const memberPage = await ctx!.newPage();
  const login = await memberPage.request.post("/api/v1/auth/login", {
    data: { email, password: pwd },
  });
  expect(login.status()).toBe(200);
  await ctx!.close();

  await expectNoConsoleErrors();
  // 清理（API）
  const list = await page.request.get("/api/v1/users");
  const items = ((await list.json()) as { data: { items: Array<{ email: string; id: string }> } })
    .data.items;
  const mine = items.find((u) => u.email === email);
  if (mine) await page.request.delete(`/api/v1/users/${mine.id}`);
});

test("SYS-002-02 MEMBER 创建团队→403（马拉松首条 403 e2e,豁免收口）", async ({
  authedPage: page,
}) => {
  // ADMIN 建 MEMBER 拿密码
  const email = `${uniq()}@test.local`;
  const created = await page.request.post("/api/v1/users", {
    data: { email, name: "李四", role: "MEMBER" },
  });
  expect(created.status()).toBe(201);
  const body = ((await created.json()) as { data: { id: string; password: string } }).data;

  // MEMBER 登录
  const ctx = await page.context().browser()?.newContext();
  const memberPage = await ctx!.newPage();
  const login = await memberPage.request.post("/api/v1/auth/login", {
    data: { email, password: body.password },
  });
  expect(login.status()).toBe(200);

  // MEMBER 读团队列表 200（:READ 白名单）,创建团队 403
  const listOk = await memberPage.request.get("/api/v1/teams");
  expect(listOk.status()).toBe(200);
  const forbidden = await memberPage.request.post("/api/v1/teams", {
    data: { name: `403测试-${uniq()}` },
  });
  expect(forbidden.status()).toBe(403);
  const fb = (await forbidden.json()) as { message: string };
  expect(fb.message).toContain("ORG_TEAM:CREATE");

  await ctx!.close();
  await page.request.delete(`/api/v1/users/${body.id}`);
});

test("SYS-002-03 禁用→登录拒绝;重置密码→旧失效新可用", async ({ authedPage: page }) => {
  const email = `${uniq()}@test.local`;
  const created = await page.request.post("/api/v1/users", {
    data: { email, name: "王五" },
  });
  const u = ((await created.json()) as { data: { id: string; password: string } }).data;

  // 禁用 → 登录 401
  const disable = await page.request.patch(`/api/v1/users/${u.id}`, {
    data: { status: "DISABLED" },
  });
  expect(disable.status()).toBe(200);
  const ctx = await page.context().browser()?.newContext();
  const p2 = await ctx!.newPage();
  const login1 = await p2.request.post("/api/v1/auth/login", {
    data: { email, password: u.password },
  });
  expect(login1.status()).toBe(401);

  // 重新启用 → 旧密码可登录;重置密码 → 旧失效
  await page.request.patch(`/api/v1/users/${u.id}`, { data: { status: "ACTIVE" } });
  const login2 = await p2.request.post("/api/v1/auth/login", {
    data: { email, password: u.password },
  });
  expect(login2.status()).toBe(200);
  const reset = await page.request.post(`/api/v1/users/${u.id}/reset-password`, { data: {} });
  const newPassword = ((await reset.json()) as { data: { password: string } }).data.password;
  const loginOld = await p2.request.post("/api/v1/auth/login", {
    data: { email, password: u.password },
  });
  expect(loginOld.status()).toBe(401);
  const loginNew = await p2.request.post("/api/v1/auth/login", {
    data: { email, password: newPassword },
  });
  expect(loginNew.status()).toBe(200);
  await ctx!.close();
  await page.request.delete(`/api/v1/users/${u.id}`);
});

// 纯 API 用例（无浏览器页面开销——曾因 worker setup 卡死 60s,实证后收敛）
test("SYS-002-04 自我保护:改自己角色 422", async ({ request }) => {
  const login = await request.post("/api/v1/auth/login", {
    data: { email: "admin@rabbitwork.local", password: "rabbit123" },
  });
  expect(login.status()).toBe(200);
  const cookie = (login.headers()["set-cookie"] ?? "").split(";")[0]!;
  const me = await request.get("/api/v1/auth/me", { headers: { Cookie: cookie } });
  const myId = ((await me.json()) as { data: { id: string } }).data.id;
  const res = await request.patch(`/api/v1/users/${myId}`, {
    headers: { Cookie: cookie },
    data: { role: "MEMBER" },
  });
  expect(res.status()).toBe(422);
});

test("SYS-002-05 未登录守卫(§3.2.2 例外)", async ({ page }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login\?next=%2Fusers/u);
});
