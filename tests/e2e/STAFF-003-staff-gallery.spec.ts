import { expect, test } from "./fixtures";

/**
 * STAFF-003 员工广场。
 * 规格：docs/sprint-staff-3/STAFF-003-staff-gallery.md §5。
 */
let seq = 0;
const uniq = () => `E2E广场-${Date.now().toString(36)}-${(seq++).toString(36)}`;

test("STAFF-003-01 发布广场员工→广场可见→复制→DRAFT 私有副本+原件不动", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  // 造数：GALLERY 员工（创建后 PATCH visibility + publish）
  const created = await page.request.post("/api/v1/staffs", {
    data: {
      name: uniq(),
      title: "广场测试员",
      personaPrompt: "广场共享人设——被复制后原样保留",
      visibility: "GALLERY",
    },
  });
  const createdBody = (await created.json()) as { data: { id: string; name: string } };
  const srcId = createdBody.data.id;
  const srcName = createdBody.data.name;
  await page.request.post(`/api/v1/staffs/${srcId}/publish`, { data: {} });

  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("gallery-list")).toContainText(srcName);
  await expect(page.getByTestId("gallery-list")).toContainText("被复制 0 次");

  // 复制
  const copyApi = expectApi("**/api/v1/gallery/*/copy", "POST");
  await page.getByTestId(`gallery-copy-${srcName}`).click();
  const copied = await copyApi;
  expect(copied.status).toBe(201);
  const copyData = copied.data as { id: string; name: string; visibility: string; status: string };
  expect(copyData.name).toContain("-副本");
  expect(copyData.visibility).toBe("PRIVATE");
  expect(copyData.status).toBe("DRAFT");
  // 跳转到副本详情页
  await expect(page).toHaveURL(new RegExp(`/staffs/${copyData.id}`, "u"));

  // 原件不动（仍 GALLERY+PUBLISHED,人设原样）
  const src = await page.request.get(`/api/v1/staffs/${srcId}`);
  const srcBody = (await src.json()) as {
    data: { visibility: string; status: string; personaPrompt: string };
  };
  expect(srcBody.data.visibility).toBe("GALLERY");
  expect(srcBody.data.personaPrompt).toContain("原样保留");

  // 次数 +1（回广场看）
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-list")).toContainText("被复制 1 次");

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${srcId}`);
  await page.request.delete(`/api/v1/staffs/${copyData.id}`);
});

test("STAFF-003-02 复制不存在员工 404（API 级）", async ({ authedPage: page }) => {
  const res = await page.request.post("/api/v1/gallery/00000000-0000-4000-8000-000000000000/copy", {
    data: {},
  });
  expect(res.status()).toBe(404);
});

test("STAFF-003-03 未登录守卫(§3.2.2 例外)", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).toHaveURL(/\/login\?next=%2Fgallery/u);
});
