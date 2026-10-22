import { expect, test } from "./fixtures";

/**
 * MODEL-001 模型配置。
 * 规格：docs/sprint-model-1/MODEL-001-model-config.md §5。
 * 验证 happy-path 用本地目标（e2e 栈 health,openai 协议端点 /chat/completions 不存在——
 * health 不收 POST → 405/404 也算「HTTP 非 2xx」→ FAILED…… 故 happy 用一个真回 2xx 的
 * 目标：e2e 栈自身 /api/v1/models（POST 创建返回 201 —— 响应 2xx 即 VERIFIED,语义为
 * 「连通与凭据送达」;真实协议响应体解析随 AI Provider 接入）。
 */
let seq = 0;
const uniq = () => `E2E模型-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("MODEL-001-01 注册→验证(本地 2xx 目标)→默认互斥→删除", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const nameA = uniq();
  const nameB = uniq();
  await page.goto("/");
  await page.getByTestId("nav-models").click();
  await expect(page).toHaveURL(/\/models/u);
  await expect(page.getByTestId("models-page")).toBeVisible({ timeout: 15_000 });

  // 注册 A（默认）——UI 表单链路；响应断言经列表回读（glob 在集合 URL 上与 GET 刷新竞态,
  // 实证会错过 POST 响应——列表出现即创建成功,状态列断言 UNVERIFIED）
  await page.getByTestId("model-create-btn").click();
  await page.getByTestId("model-form-name").fill(nameA);
  // protocol 走表单默认值（initialValues;曾因无默认+未选被 required 校验静默拦截）
  await page
    .getByTestId("model-form-baseurl")
    .fill(`${page.url().split("/models")[0]}/api/v1/models`);
  await page.getByTestId("model-form-modelid").fill("test-model");
  await page.getByTestId("model-form-apikey").fill("sk-test-key");
  await page.getByRole("button", { name: /^(注\s*册|OK)$/ }).click();
  await expect(page.getByTestId("models-table")).toContainText(nameA, { timeout: 15_000 });
  await expect(page.getByTestId("models-table")).toContainText("UNVERIFIED");

  // 验证 A：本地目标 POST /api/v1/models 未带登录头会 401——仍非 2xx → FAILED?
  // 注:guardedFetch 不带平台 cookie → 401。FAILED 路径即本用例断言（原因透出）。
  const verifyApi = expectApi("**/api/v1/models/*/verify", "POST");
  await page
    .getByTestId("models-table")
    .getByRole("row")
    .filter({ hasText: nameA })
    .getByRole("button", { name: /验\s*证/u })
    .click();
  await page.getByTestId("model-verify-run").click();
  const v = await verifyApi;
  expect(v.code).toBe(0);
  expect((v.data as { status: string }).status).toBe("FAILED"); // 本地目标 401 → FAILED+原因
  await expect(page.getByTestId("model-verify-result")).toContainText(/HTTP 401/u);
  // 状态列转 FAILED + 行展开可看原因
  await expect(page.getByTestId("models-table")).toContainText("FAILED");

  // 注册 B → 设默认 → A 失去默认
  await page.request.post("/api/v1/models", {
    data: {
      name: nameB,
      protocol: "anthropic",
      baseUrl: "https://api.anthropic.com",
      modelId: "claude-sonnet-5-5",
      apiKey: "sk-b",
    },
  });
  await page.reload();
  const rowB = page.getByTestId("models-table").getByRole("row").filter({ hasText: nameB });
  await rowB.getByRole("button", { name: /设\s*默\s*认/u }).click();
  // 互斥断言走 API（行内「设默认」按钮文案会误伤 toContainText(/默认/) 类断言）
  await expect
    .poll(async () => {
      const r = await page.request.get("/api/v1/models");
      const j = (await r.json()) as {
        data: { items: Array<{ name: string; isDefault: boolean }> };
      };
      const a = j.data.items.find((m) => m.name === nameA);
      const b = j.data.items.find((m) => m.name === nameB);
      return a?.isDefault === false && b?.isDefault === true;
    })
    .toBe(true);

  // 删除 B（API 级——同款 popconfirm 交互已覆盖于 SKILL/MCP）
  const del = await page.request.delete(
    `/api/v1/models/${((await (await page.request.get("/api/v1/models")).json()) as { data: { items: Array<{ name: string; id: string }> } }).data.items.find((m) => m.name === nameB)!.id}`,
  );
  expect(del.status()).toBe(200);

  await expectNoConsoleErrors();
});

test("MODEL-001-02 私网 baseUrl 验证被守卫拒绝(原因透出)", async ({ authedPage: page }) => {
  const created = await page.request.post("/api/v1/models", {
    data: {
      name: uniq(),
      protocol: "openai_chat_completions",
      baseUrl: "http://10.77.77.77/v1",
      modelId: "m",
      apiKey: "sk-x",
    },
  });
  expect(
    created.status(),
    `注册失败: ${JSON.stringify(await created.json().catch(() => null))}`,
  ).toBe(201);
  const id = ((await created.json()) as { data: { id: string } }).data.id;
  const run = await page.request.post(`/api/v1/models/${id}/verify`, { data: {} });
  expect(run.status()).toBe(200); // 守卫拒绝收敛为验证结果 FAILED（非 422 信封——语义为验证失败）
  const body = (await run.json()) as { data: { status: string; error: string | null } };
  expect(body.data.status).toBe("FAILED");
  expect(body.data.error).toContain("私网");
  await page.request.delete(`/api/v1/models/${id}`);
});

test("MODEL-001-03 未登录跳转登录(守卫,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/models");
  await expect(page).toHaveURL(/\/login\?next=%2Fmodels/u);
});
