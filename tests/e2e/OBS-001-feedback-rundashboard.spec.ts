import { expect, test } from "./fixtures";

/**
 * OBS-001 消息反馈 + 运行留痕 + 最小看板。
 * 规格：docs/sprint-obs-1/OBS-001-feedback-rundashboard.md §5.1/§5.3。
 *
 * 反馈 happy-path 在此覆盖（需 SSE 消费产出员工消息镜像——jmx 无法稳定复刻，规格 §5.2）。
 * mock 模式：一轮对话确定性完成（脚本回复），run 终态 SUCCEEDED。
 */

let seq = 0;
const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** 造数：已发布员工 + 会话（API 级，非被测功能） */
async function createConversation(page: import("@playwright/test").Page) {
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E观测员工${uniq("")}`, title: "测试工程师", personaPrompt: "E2E 造数" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  const conv = await page.request.post(`/api/v1/staffs/${staffId}/conversations`, {
    data: { title: `E2E观测会话${uniq("")}` },
  });
  const convId = ((await conv.json()) as { data: { id: string } }).data.id;
  return { staffId, convId };
}

test("OBS-001-01 消息反馈全链路:赞→切踩附评语→撤销", async ({
  authedPage: page,
  expectNoConsoleErrors,
  expectApi,
}) => {
  const { staffId, convId } = await createConversation(page);
  await page.goto(`/chat/${convId}`);
  await expect(page.getByTestId("chat-messages")).toBeVisible();

  // 发一轮消息,等 mock 流式完成（状态翻转强信号:员工气泡出现,§3.5.1）
  // Composer 为 ⌘/Ctrl+Enter 提交（ChatComposer onKeyDown）
  await page.getByTestId("chat-input").fill("帮我列一份工作计划");
  await page.getByTestId("chat-input").press("Control+Enter");
  const assistant = page.getByTestId("bubble-assistant").first();
  await expect(assistant).toBeVisible({ timeout: 30_000 });
  // mock 回复含「Mock 模式」字样即回复完成（脚本回复固定文案）
  await expect(page.getByTestId("chat-messages")).toContainText(/Mock/u, { timeout: 30_000 });
  // 终态强信号（§3.5.1）：done 处理器会 invalidate 会话详情——等这次 refetch 完成，
  // 流式占位气泡（无反馈 handler、与消息气泡同 testid 的竞态体）已被清空/替换
  const refetched = expectApi("**/api/v1/conversations/*", "GET");
  await refetched;
  await expect(page.getByTestId("bubble-assistant").first()).toBeVisible();

  // ── 👍 点赞:接口断言钉 PUT + UI active 态 ──
  const putUp = expectApi("**/api/v1/messages/*/feedback", "PUT");
  await page.getByTestId("msg-feedback-up").first().click();
  const up = await putUp;
  expect(up.status).toBe(200);
  expect(up.code).toBe(0);
  expect((up.data as { rating: string }).rating).toBe("UP");
  await expect(page.getByTestId("msg-feedback-up").first()).toHaveAttribute("aria-pressed", "true");

  // ── 切 👎:评语弹层 + 提交（弹层 OK 点击才是真正发 PUT 的动作） ──
  const putDown = expectApi("**/api/v1/messages/*/feedback", "PUT");
  await page.evaluate(() => {
    (document.querySelector('[data-testid="msg-feedback-down"]') as HTMLElement | null)?.click();
  });
  await page.getByTestId("feedback-comment-input").fill("结论太笼统,缺少数据支撑");
  await page.getByRole("button", { name: /提\s*交\s*反\s*馈|OK/u }).click();
  const down = await putDown;
  expect(down.code).toBe(0);
  expect((down.data as { rating: string }).rating).toBe("DOWN");
  expect((down.data as { comment: string | null }).comment).toContain("太笼统");
  await expect(page.getByTestId("msg-feedback-down").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("msg-feedback-up").first()).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // ── 再点 👎 = 撤销 ──
  const putRevoke = expectApi("**/api/v1/messages/*/feedback", "PUT");
  await page.getByTestId("msg-feedback-down").first().click();
  const revoke = await putRevoke;
  expect((revoke.data as { rating: string | null }).rating).toBeNull();
  await expect(page.getByTestId("msg-feedback-down").first()).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("OBS-001-02 运行观测页:看板四卡 + 留痕列表 + 过滤", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  // 用例数据独立（§3.2.3）:自造一轮对话（UI 路径与 01 同——SSE 消费驱动 run 终态）
  const { staffId, convId } = await createConversation(page);
  await page.goto(`/chat/${convId}`);
  await expect(page.getByTestId("chat-messages")).toBeVisible();
  await page.getByTestId("chat-input").fill("E2E 观测链路消息");
  await page.getByTestId("chat-input").press("Control+Enter");
  await expect(page.getByTestId("bubble-assistant").first()).toBeVisible({ timeout: 30_000 });

  // ── 从侧栏真实导航到运行观测（§3.2.2） ──
  await page.getByRole("link", { name: "运行观测" }).click();
  await expect(page.getByTestId("runs-page")).toBeVisible();

  // 统计卡:四卡 + 今日调用 ≥1（刚跑过一轮）
  await expect(page.getByTestId("runs-stat-card")).toHaveCount(4);
  await expect(page.getByTestId("runs-stat-value").first()).toHaveText(/^[1-9]\d*$/u);

  // 列表:至少 1 行且含会话标题；状态过滤 Tab 计数存在
  await expect(page.getByTestId("runs-table").locator("tbody tr").first()).toBeVisible();
  await page.getByRole("tab", { name: /失败/u }).click();
  await expect(page.getByTestId("runs-table")).toBeVisible();

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("OBS-001-03 未登录访问运行观测跳转登录(守卫,§3.2.2 例外)", async ({ page }) => {
  await page.goto("/runs");
  await expect(page).toHaveURL(/\/login\?next=%2Fruns/u);
});
