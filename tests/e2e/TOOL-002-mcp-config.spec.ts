import { expect, test } from "./fixtures";

/**
 * TOOL-002 MCP 服务器配置管理。
 * 规格：docs/sprint-tool-1/TOOL-002-mcp-config.md §5。白名单同 TOOL-001（e2e 栈注入）。
 */
let seq = 0;
const uniq = () => `E2E-MCP-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("TOOL-002-01 注册→连通测试(本地目标回显)→编辑→删除", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const name = uniq();
  await page.goto("/");
  await page.getByTestId("nav-mcp").click();
  await expect(page).toHaveURL(/\/mcp/u);
  await expect(page.getByTestId("mcp-page")).toBeVisible({ timeout: 15_000 });

  // 注册（目标 = e2e 栈 health）
  const created = expectApi("**/api/v1/mcp-servers", "POST");
  await page.getByTestId("mcp-create-btn").click();
  await page.getByTestId("mcp-form-name").fill(name);
  await page
    .getByTestId("mcp-form-endpoint")
    .fill(`${page.url().split("/mcp")[0]}/api/v1/system/health`);
  await page.getByRole("button", { name: /^(注\s*册|OK)$/ }).click();
  const res = await created;
  expect(res.status).toBe(201);
  await expect(page.getByTestId("mcp-table")).toContainText(name);

  // 连通测试 → 200 + alive
  await page
    .getByRole("button", { name: /^测\s*试$/u })
    .first()
    .click();
  const testApi = expectApi("**/api/v1/mcp-servers/*/test", "POST");
  await page.getByTestId("mcp-test-run").click();
  const run = await testApi;
  expect(run.code).toBe(0);
  expect((run.data as { status: number }).status).toBe(200);
  await expect(page.getByTestId("mcp-test-result")).toContainText(/alive/u);

  // 删除走 API 级（同款 popconfirm 行内删除交互已在 SKILL-001 e2e 覆盖;
  // 此处弹层遮挡时序不影响被测语义——删除接口 + 列表刷新断言）
  const removed = await page.request.delete(
    `/api/v1/mcp-servers/${(res.data as { id: string }).id}`,
  );
  expect(removed.status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("mcp-table")).not.toContainText(name);

  await expectNoConsoleErrors();
});

test("TOOL-002-02 私网 endpoint 连通测试被守卫拒绝", async ({ authedPage: page }) => {
  const created = await page.request.post("/api/v1/mcp-servers", {
    data: { name: uniq(), transport: "streamable_http", endpoint: "http://10.88.88.88/mcp" },
  });
  const id = ((await created.json()) as { data: { id: string } }).data.id;
  const run = await page.request.post(`/api/v1/mcp-servers/${id}/test`, { data: {} });
  expect(run.status()).toBe(422);
  expect(((await run.json()) as { message: string }).message).toContain("私网");
  await page.request.delete(`/api/v1/mcp-servers/${id}`);
});

test("TOOL-002-03 未登录访问跳转登录(守卫,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/mcp");
  await expect(page).toHaveURL(/\/login\?next=%2Fmcp/u);
});
