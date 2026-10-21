import { expect, test } from "./fixtures";

/**
 * STAFF-002 人设模板：新建员工选预置模板 → 四段预填 → 提交成功。
 * 规格：docs/sprint-staff-2/STAFF-002-persona-templates.md §5。
 */
let seq = 0;
const uniq = () => `模板员工-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("STAFF-002-01 模板选择预填并创建员工", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const name = uniq();
  await page.goto("/");
  await page.getByRole("link", { name: "我的数字员工" }).click();
  await expect(page.getByTestId("staffs-page")).toBeVisible();

  await page.getByTestId("staff-create-btn").click();
  await page.getByTestId("staff-form-name").fill(name);

  // 选「代码评审」模板 → 岗位/人设/边界预填
  await page.getByTestId("staff-form-template").click();
  await page.getByRole("option", { name: /代码评审/u }).click();
  await expect(page.getByTestId("staff-form-persona")).toContainText(/代码评审员/u);

  const created = expectApi("**/api/v1/staffs", "POST");
  await page.getByRole("button", { name: /^(确\s*定|创\s*建|OK)$/ }).click();
  const res = await created;
  expect(res.status).toBe(201);
  const data = res.data as { title: string; personaPrompt: string; boundary: string };
  expect(data.title).toBe("代码评审员");
  expect(data.personaPrompt).toContain("代码评审");
  expect(data.boundary.length).toBeGreaterThan(0);

  await expectNoConsoleErrors();
});
