import { expect, test } from "./fixtures";

/**
 * TEAM-001 团队协作复用 AgentScope teams（浅映射）。
 * 规格：docs/sprint-team-1/TEAM-001-agentscope-team-sync.md §5.1/§5.3。
 *
 * 运行口径：e2e 栈 AGENTSCOPE_MODE=mock（playwright.config 注入）——mock 确定性约定：
 * - ensureTeam 建队自动挂 2 条任务（任务 Tab 有数据）；
 * - 团队名 "FAIL:" 前缀 → 上游 503（同步失败态演练；改名即恢复）。
 * 数据自建自清（rules/testing §3.2.3）；从首页经真实导航进入（§3.2.2）。
 */

const ADMIN = { email: "admin@rabbitwork.local", password: "rabbit123" };

let seq = 0;
const uniq = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** API 级登录并注入会话 cookie（鉴权准备,非被测功能；authedPage fixture 随 SYS 规格引入前的过渡写法） */
async function login(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/v1/auth/login", { data: ADMIN });
  expect(res.status()).toBe(200);
  const raw = res.headers()["set-cookie"] ?? "";
  const [name, value] = raw.split(";")[0]!.split("=");
  await page.context().addCookies([
    { name: name!, value: value!, domain: "localhost", path: "/" },
  ]);
}

/** 造一名已发布员工（mock 模式下 publish 即得 asAgentId） */
async function createPublishedStaff(page: import("@playwright/test").Page, tag: string) {
  const created = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E员工${tag}`, title: "测试工程师", personaPrompt: "E2E 造数用数字员工" },
  });
  const staff = ((await created.json()) as { data: { id: string } }).data;
  const pub = await page.request.post(`/api/v1/staffs/${staff.id}/publish`, { data: {} });
  expect(pub.status()).toBe(200);
  return staff.id;
}

async function cleanupTeam(page: import("@playwright/test").Page, teamId?: string) {
  if (teamId) await page.request.delete(`/api/v1/teams/${teamId}`);
}

/** UI 全链路：首页 → 侧栏「我的团队」 */
async function navToTeams(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "我的团队" }).first().click();
  await expect(page.getByTestId("teams-page")).toBeVisible();
}

test("TEAM-001-01 创建团队随建同步运行面(徽标已同步)", async ({
  page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  await login(page);
  const staffId = await createPublishedStaff(page, uniq("TL"));
  const teamName = uniq("E2E同步组");

  await navToTeams(page);
  await page.getByTestId("team-create-btn").click();
  await page.getByTestId("team-form-name").fill(teamName);
  // 选择 TL(Select virtual={false},rules/testing §3.2.3)
  await page.getByTestId("team-form-leader").click();
  await page.getByRole("option").first().click();
  // 同步开关默认开;提交并钉住 POST(集合 URL 防他方法抢先,§3.1)
  const created = expectApi("**/api/v1/teams", "POST");
  await page.getByRole("button", { name: /^(确\s*定|创\s*建|OK)$/ }).click();
  const res = await created;
  expect(res.status()).toBe(201);
  expect(res.code).toBe(0);
  expect((res.data as { asTeamId: string | null }).asTeamId).toBeTruthy();
  expect((res.data as { syncState: string }).syncState).toBe("SYNCED");

  // ── UI 断言:卡片出现且徽标=运行面已同步 ──
  const card = page.getByTestId(`team-card-${teamName}`);
  await expect(card).toBeVisible();
  await expect(page.getByTestId(`team-sync-badge-${teamName}`)).toHaveText(/运行面已同步/u);

  await expectNoConsoleErrors();
  await cleanupTeam(page, ((res.data as { id: string }).id));
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("TEAM-001-02 详情页运行面状态行 + 任务Tab(只读浅映射)", async ({
  page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  await login(page);
  const staffId = await createPublishedStaff(page, uniq("TL"));
  const teamName = uniq("E2E任务组");
  // API 建队(带 TL,同步开)——本用例主链路是详情页,建队链路已由 01 覆盖
  const created = await page.request.post("/api/v1/teams", {
    data: { name: teamName, leaderEmployeeId: staffId, syncToRuntime: true },
  });
  const teamId = ((await created.json()) as { data: { id: string } }).data.id;

  await navToTeams(page);
  await page.getByTestId(`team-card-${teamName}`).click();
  await expect(page.getByTestId("team-detail-page")).toBeVisible();

  // ── UI 断言:运行面状态行(同步时间 + 同步 pill) ──
  await expect(page.getByTestId("team-runtime-row")).toBeVisible();
  await expect(page.getByTestId("team-runtime-row")).toContainText(/同步/u);
  await expect(page.getByTestId("team-sync-pill")).toBeVisible();

  // 任务 Tab:mock 建队自动挂 2 条任务
  const tasksApi = expectApi("**/api/v1/teams/*/tasks", "GET");
  await page.getByRole("tab", { name: /任务/u }).click();
  const tasks = await tasksApi;
  expect(tasks.code).toBe(0);
  expect((tasks.data as { degraded: boolean }).degraded).toBe(false);
  await expect(page.getByTestId("team-tasks-table")).toContainText(/Mock 演练任务/u);
  await expect(page.getByTestId("team-tasks-table").locator("tbody tr")).toHaveCount(2);

  await expectNoConsoleErrors();
  await cleanupTeam(page, teamId);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("TEAM-001-03 仅本地建队(无TL):徽标未同步 + 任务空态", async ({
  page,
  expectNoConsoleErrors,
}) => {
  await login(page);
  const teamName = uniq("E2E本地组");

  await navToTeams(page);
  await page.getByTestId("team-create-btn").click();
  await page.getByTestId("team-form-name").fill(teamName);
  // 不选 TL:同步开关禁用(仅本地建队,TEAM-001 §2.2.1)
  await expect(page.getByTestId("team-form-sync")).toBeDisabled();
  await page.getByRole("button", { name: /^(确\s*定|创\s*建|OK)$/ }).click();

  const card = page.getByTestId(`team-card-${teamName}`);
  await expect(card).toBeVisible();
  await expect(page.getByTestId(`team-sync-badge-${teamName}`)).toHaveText(/未同步/u);

  // 详情页任务 Tab 空态:提示「尚未同步运行面」
  await card.click();
  await page.getByRole("tab", { name: /任务/u }).click();
  await expect(page.getByText(/尚未同步运行面/u)).toBeVisible();

  await expectNoConsoleErrors();
  const teamId = await page.evaluate(async () => {
    const list = await fetch("/api/v1/teams?pageSize=50").then((r) => r.json());
    return list.data.items.find((t: { name: string }) => t.name.startsWith("E2E本地组"))?.id;
  });
  await cleanupTeam(page, teamId);
});

test("TEAM-001-04 同步失败横幅(FAIL:注入) + 改名恢复", async ({
  page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  await login(page);
  const staffId = await createPublishedStaff(page, uniq("TL"));
  const failName = `FAIL:${uniq("E2E失败组")}`;
  const okName = uniq("E2E恢复组");

  // 建队即失败(mock 注入 503):本地创建成功,syncState=SYNC_FAILED
  const created = await page.request.post("/api/v1/teams", {
    data: { name: failName, leaderEmployeeId: staffId, syncToRuntime: true },
  });
  const teamId = ((await created.json()) as { data: { id: string } }).data.id;
  expect(((await created.json()) as { data: { syncState: string } }).data.syncState).toBe(
    "SYNC_FAILED",
  );

  await navToTeams(page);
  await page.getByTestId(`team-card-${failName}`).click();
  // ── UI 断言:失败横幅透出真实原因(mock 注入) ──
  await expect(page.getByTestId("team-sync-fail-banner")).toBeVisible();
  await expect(page.getByTestId("team-sync-fail-banner")).toContainText(/mock 注入/u);

  // 编辑改名(去掉 FAIL: 前缀) → PATCH 触发同步 → 横幅消失、状态恢复 SYNCED
  const patched = expectApi("**/api/v1/teams/*", "PATCH");
  await page.getByRole("button", { name: /^(编\s*辑|Edit)$/ }).click();
  await page.getByLabel("团队名称").fill(okName);
  await page.getByRole("button", { name: /^(保\s*存|OK)$/ }).click();
  const patchRes = await patched;
  expect(patchRes.code).toBe(0);
  expect((patchRes.data as { syncState: string }).syncState).toBe("SYNCED");

  await expect(page.getByTestId("team-sync-fail-banner")).toHaveCount(0);
  await expect(page.getByTestId("team-sync-pill")).toBeVisible();

  await expectNoConsoleErrors();
  await cleanupTeam(page, teamId);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("TEAM-001-05 未登录访问团队页跳转登录(守卫断言,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/teams");
  await expect(page).toHaveURL(/\/login\?next=%2Fteams/u);
});
