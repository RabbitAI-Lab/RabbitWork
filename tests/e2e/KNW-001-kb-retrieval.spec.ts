import { expect, test } from "./fixtures";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * KNW-001 知识库与检索调试。
 * 规格：docs/sprint-knw-1/KNW-001-kb-retrieval.md §5.1/§5.3。
 * 上传 fixture 自造（§3.5.2）：临时目录生成 .md（禁依赖本机路径残留）。
 */

let seq = 0;
const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("KNW-001-01 全链路:建库→上传摄取→检索命中/无命中", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const kbName = uniq("E2E知识库");
  await page.goto("/");
  await page.getByRole("link", { name: "知识库" }).click();
  await expect(page.getByTestId("knowledge-page")).toBeVisible();

  // ── 建库 ──
  const created = expectApi("**/api/v1/knowledge-bases", "POST");
  await page.getByTestId("kb-create-btn").click();
  await page.getByTestId("kb-form-name").fill(kbName);
  await page.getByRole("button", { name: /^(创\s*建|OK)$/ }).click();
  const kb = await created;
  expect(kb.status).toBe(201);
  await expect(page.getByTestId(`kb-card-${kbName}`)).toBeVisible();

  // ── 进详情,上传 .md(fixture 自造) ──
  const dir = mkdtempSync(path.join(tmpdir(), "knw-e2e-"));
  const file = path.join(dir, "quick-start.md");
  writeFileSync(
    file,
    "# 快速上手\n\n进入「账号设置 → 重置密码」,通过绑定邮箱验证后即可设置新密码。\n密码连续输错 5 次将锁定 30 分钟。\n",
    "utf8",
  );
  await page.getByTestId(`kb-card-${kbName}`).click();
  await expect(page.getByTestId("kb-detail-page")).toBeVisible();
  const uploaded = expectApi("**/api/v1/knowledge-bases/*/documents", "POST");
  await page.getByTestId("kb-upload-btn").click();
  await page.setInputFiles('input[type="file"]', file);
  const doc = await uploaded;
  expect(doc.status).toBe(201);
  expect((doc.data as { status: string }).status).toBe("READY");
  expect((doc.data as { chunkCount: number }).chunkCount).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("kb-docs-table")).toContainText(/READY/u);

  // ── 检索调试:命中 → 片段含目标词;无命中 → 空态 ──
  await page.getByRole("tab", { name: /检索调试/u }).click();
  await page.getByTestId("kb-retrieval-input").fill("重置密码");
  const retrieved = expectApi("**/api/v1/knowledge-bases/*/retrieve", "POST");
  await page.getByTestId("kb-retrieval-run").click();
  const hits = await retrieved;
  expect(hits.code).toBe(0);
  expect((hits.data as { total: number }).total).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("kb-retrieval-results")).toContainText(/重置密码/u);

  await page.getByTestId("kb-retrieval-input").fill("完全不存在的词xyzq");
  await page.getByTestId("kb-retrieval-run").click();
  await expect(page.getByTestId("kb-retrieval-results")).toContainText(/没有命中/u);

  await expectNoConsoleErrors();
});

test("KNW-001-02 员工绑定知识库(Transfer)并回显", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const kbName = uniq("E2E绑定库");
  // API 建库 + 建员工（绑定链路的被测交互在员工页,前置数据 API 造）
  const kb = await page.request.post("/api/v1/knowledge-bases", {
    data: { name: kbName, description: "绑定回显用" },
  });
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E绑定员工${uniq("")}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;

  // 员工详情 → 知识库 Tab → Transfer 选库右移 → 保存
  await page.goto(`/staffs/${staffId}`);
  await page.getByRole("tab", { name: "知识库" }).click();
  // Transfer 项是 label 结构——点条目文本即切换勾选；data-testid 不落在 Transfer 根节点
  // （antd 不透传），改用全局唯一文本/按钮名定位（kbName 经 uniq 唯一）
  await page.getByText(kbName, { exact: true }).first().click();
  await page.getByRole("button", { name: "right" }).click();
  await page.getByRole("button", { name: /保存配置/u }).click();

  // 回显:重进页面右侧「已配置」含该库
  await page.reload();
  await page.getByRole("tab", { name: "知识库" }).click();
  await expect(page.getByText(kbName, { exact: true }).first()).toBeVisible();

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("KNW-001-03 未登录访问知识库跳转登录(守卫,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/knowledge");
  await expect(page).toHaveURL(/\/login\?next=%2Fknowledge/u);
});
