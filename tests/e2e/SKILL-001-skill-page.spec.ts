import { expect, test } from "./fixtures";

/**
 * SKILL-001 技能管理页：新建 → 列表 → 编辑（version 自增）→ 删除。
 * 规格：docs/sprint-skill-1/SKILL-001-skill-page.md §5。
 */
let seq = 0;
const uniq = () => `E2E技能-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("SKILL-001-01 技能 CRUD 全链路", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const name = uniq();
  await page.goto("/");
  await page.getByTestId("nav-skills").click();
  // 4-worker 并发下首屏数据拉取可超默认 5s——URL 强信号 + 放宽可见性（§3.5.1-2）
  await expect(page).toHaveURL(/\/skills/u);
  await expect(page.getByTestId("skills-page")).toBeVisible({ timeout: 15_000 });

  // ── 新建 ──
  const created = expectApi("**/api/v1/skills", "POST");
  await page.getByTestId("skill-create-btn").click();
  await page.getByTestId("skill-form-name").fill(name);
  await page.getByTestId("skill-form-template").fill("按三段输出周报：进展/风险/计划");
  await page.getByRole("button", { name: /^(创\s*建|OK)$/ }).click();
  const res = await created;
  expect(res.status).toBe(201);
  const skill = res.data as { id: string; version: number };
  expect(skill.version).toBe(1);
  await expect(page.getByTestId(`skill-card-${name}`)).toBeVisible();

  // ── 编辑:模板正文变更 → version 自增 ──
  const patched = expectApi("**/api/v1/skills/*", "PATCH");
  await page
    .getByTestId(`skill-card-${name}`)
    .getByRole("button", { name: /编\s*辑/u })
    .click();
  await page.getByTestId("skill-form-template").fill("按四段输出周报：进展/风险/计划/备忘");
  await page.getByRole("button", { name: /^(保\s*存|OK)$/ }).click();
  const patchRes = await patched;
  expect((patchRes.data as { version: number }).version).toBe(2);

  // ── 删除 ──
  const removed = expectApi("**/api/v1/skills/*", "DELETE");
  await page
    .getByTestId(`skill-card-${name}`)
    .getByRole("button", { name: /删\s*除/u })
    .click();
  // popconfirm 确认键「删 除」（带空格）与卡片删除键区分——exact 匹配 portal 内主按钮
  await page.getByRole("button", { name: "删 除", exact: true }).click();
  const delRes = await removed;
  expect(delRes.status).toBe(200);
  await expect(page.getByTestId(`skill-card-${name}`)).toHaveCount(0);

  await expectNoConsoleErrors();
});
