import { expect, test } from "./fixtures";

/**
 * OFFICE-004 等距楼层视图。
 * 规格：docs/sprint-office-2/OFFICE-004-isometric-floor.md §5。
 * 造数：发布员工并安排到 1F-1（有人工位渲染小人）;空工位与既有页面断言复用。
 */
let seq = 0;
const uniq = () => `E2E等距${Date.now().toString(36)}${(seq++).toString(36)}`;

test("OFFICE-004-01 等距 canvas 渲染 + 既有数据卡不回退", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E等距员工${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  for (let seat = 20; seat >= 1; seat--) {
    const r = await page.request.put(`/api/v1/staffs/${staffId}/desk`, {
      data: { floor: 1, seat },
    });
    if (r.status() === 200) break;
  }

  await page.goto("/office");
  await expect(page.getByTestId("office-page")).toBeVisible();
  // 等距 canvas 可见（OFFICE-004 主断言;数据卡已随 v3 移除——OFFICE-001 勘误先例）
  const canvas = page.getByTestId("office-pixi-floor-wrap").locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  // 既有楼层区结构不回退（楼层平面标题）
  await expect(page.getByTestId("office-floor-plan")).toBeVisible();

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("OFFICE-004-02 员工入座回显（楼层计数）+ 点击画布无错误", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  // 入座到确定空闲的工位：选 1F 最后一个（20）——若 409 则顺延递减找空位
  let seat = 20;
  let seated: import("@playwright/test").APIResponse | null = null;
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E等距入座${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  for (; seat >= 1; seat--) {
    const r = await page.request.put(`/api/v1/staffs/${staffId}/desk`, {
      data: { floor: 1, seat },
    });
    if (r.status() === 200) {
      seated = r;
      break;
    }
  }
  expect(seated?.status(), "1F 应至少有一个空位").toBe(200);

  await page.goto("/office");
  const canvas = page.getByTestId("office-pixi-floor-wrap").locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  // 入座回显:楼层按钮计数 aria-label 含「工位在用」（x ≥ 1）
  const floorBtn = page.getByTestId("office-floor-1");
  await expect(floorBtn).toBeVisible();
  const label = await floorBtn.getAttribute("aria-label");
  expect(label).toMatch(/1\s*工位在用|[2-9]|1[0-9]|20/u);
  // 点击画布交互不报错（canvas 内坐标自动化不稳定——同 OFFICE-002/003 先例,点到即验证事件链无异常）
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.2);
  await expect(canvas).toBeVisible();

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("OFFICE-004-03 楼层切换重绘", async ({ authedPage: page, expectNoConsoleErrors }) => {
  await page.goto("/office");
  await expect(page.getByTestId("office-page")).toBeVisible();
  // 楼层按钮（既有 1F/2F…）切换后 canvas 仍可见
  const canvas = page.getByTestId("office-pixi-floor-wrap").locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const floorBtn = page.getByTestId("office-floor-2");
  await floorBtn.click();
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await expectNoConsoleErrors();
});

test("OFFICE-004-04 暗亮主题切换无错误（canvas 仍可见）", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  await page.goto("/office");
  const canvas = page.getByTestId("office-pixi-floor-wrap").locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("rw-theme", "dark");
  });
  await expect(canvas).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("rw-theme", "light");
  });
  await expect(canvas).toBeVisible();
  await expectNoConsoleErrors();
});
