import { expect, test } from "./fixtures";

/**
 * TOOL-001 HTTP 工具与试运行。
 * 规格：docs/sprint-tool-1/TOOL-001-http-tool.md §5。
 * e2e 栈注入 TOOL_SSRF_ALLOWLIST=127.0.0.1（playwright.config）——本地目标可真实调用。
 */
let seq = 0;
const uniq = () => `E2E工具-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("TOOL-001-01 建工具→试运行真实回显(白名单本地目标)", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const name = uniq();
  await page.goto("/");
  await page.getByTestId("nav-tools").click();
  await expect(page).toHaveURL(/\/tools/u);
  await expect(page.getByTestId("tools-page")).toBeVisible({ timeout: 15_000 });

  // ── 建工具：目标 = e2e 栈自身的 health 端点（白名单放行的本地地址） ──
  const created = expectApi("**/api/v1/tools", "POST");
  await page.getByTestId("tool-create-btn").click();
  await page.getByTestId("tool-form-name").fill(name);
  await page
    .getByTestId("tool-form-url")
    .fill(`${page.url().split("/tools")[0]}/api/v1/system/health`);
  await page.getByRole("button", { name: /^(创\s*建|OK)$/ }).click();
  const res = await created;
  expect(res.status).toBe(201);

  // ── 试运行：真实调用 → 200 + alive 回显 ──
  await page
    .getByRole("button", { name: /试\s*运\s*行/u })
    .first()
    .click();
  const runApi = expectApi("**/api/v1/tools/*/test-run", "POST");
  await page.getByTestId("tool-testrun-run").click();
  const run = await runApi;
  expect(run.code).toBe(0);
  const data = run.data as { status: number; bodyText: string };
  expect(data.status).toBe(200);
  expect(data.bodyText).toContain("alive");
  await expect(page.getByTestId("tool-testrun-result")).toContainText(/alive/u);

  await expectNoConsoleErrors();
});

test("TOOL-001-02 试运行私网目标被 SSRF 守卫拒绝(真实原因透出)", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const created = await page.request.post("/api/v1/tools", {
    data: { name: uniq(), url: "http://10.99.99.99/x", method: "GET" },
  });
  const toolId = ((await created.json()) as { data: { id: string } }).data.id;

  // API 级触发并直接断言（守卫语义验证;UI 展示与 01 同面板）
  const run = await page.request.post(`/api/v1/tools/${toolId}/test-run`, {
    data: { params: {} },
  });
  expect(run.status()).toBe(422);
  const runBody = (await run.json()) as { message: string };
  // 守卫拒绝 → 422 信封 + 真实原因（rules/react-nextjs §5.7）
  expect(runBody.message).toContain("私网");

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/tools/${toolId}`);
});

test("TOOL-001-03 未登录访问工具页跳转登录(守卫,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/tools");
  await expect(page).toHaveURL(/\/login\?next=%2Ftools/u);
});
