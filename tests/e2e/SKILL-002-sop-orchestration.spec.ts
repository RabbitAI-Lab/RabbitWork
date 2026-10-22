import { expect, test } from "./fixtures";

/**
 * SKILL-002 SOP 状态机编排。
 * 规格：docs/sprint-skill-2/SKILL-002-sop-orchestration.md §5。
 */
let seq = 0;
const uniq = () => `E2E-SOP-${Date.now().toString(36)}-${(seq++).toString(36)}`;

async function setupStaff(page: import("@playwright/test").Page) {
  const staff = await page.request.post("/api/v1/staffs", {
    data: { name: `E2E-SOP员工${uniq()}`, title: "T", personaPrompt: "x" },
  });
  const staffId = ((await staff.json()) as { data: { id: string } }).data.id;
  await page.request.post(`/api/v1/staffs/${staffId}/publish`, { data: {} });
  return staffId;
}

test("SKILL-002-01 建 SOP→运行→会话含渲染消息与完成留痕", async ({
  authedPage: page,
  expectNoConsoleErrors,
}) => {
  const staffId = await setupStaff(page);
  const name = uniq();
  // 建 SOP（API 级——编辑器 JSON 输入用例在 03 简化覆盖;本条主链路是运行）
  const created = await page.request.post("/api/v1/skills", {
    data: {
      name,
      description: "E2E SOP",
      kind: "SOP",
      sopGraph: {
        nodes: [
          { id: "s", type: "start" },
          { id: "l", type: "llm", prompt: "总结 {{query}}" },
          { id: "e", type: "end" },
        ],
        edges: [
          { from: "s", to: "l" },
          { from: "l", to: "e" },
        ],
        variables: [{ key: "query", required: true }],
      },
    },
  });
  expect(created.status()).toBe(201);
  const skillId = ((await created.json()) as { data: { id: string } }).data.id;

  // 运行
  const runRes = await page.request.post(`/api/v1/skills/${skillId}/run`, {
    data: { employeeId: staffId, variables: { query: "退款政策" } },
  });
  expect(runRes.status()).toBe(201);
  const run = (
    (await runRes.json()) as { data: { status: string; conversationId: string; steps: unknown[] } }
  ).data;
  expect(run.status).toBe("COMPLETED");
  expect(run.steps.length).toBeGreaterThanOrEqual(1);

  // 会话内留痕:渲染后的 prompt + 完成系统消息
  const conv = await page.request.get(`/api/v1/conversations/${run.conversationId}`);
  const convBody = (await conv.json()) as {
    data: { messages: Array<{ content: string; role: string }> };
  };
  expect(convBody.data.messages.some((m) => m.content.includes("总结 退款政策"))).toBe(true);
  expect(
    convBody.data.messages.some((m) => m.role === "SYSTEM" && m.content.includes("SOP 执行完成")),
  ).toBe(true);

  await expectNoConsoleErrors();
  await page.request.delete(`/api/v1/skills/${skillId}`);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("SKILL-002-02 条件分支两路径", async ({ authedPage: page }) => {
  const staffId = await setupStaff(page);
  const created = await page.request.post("/api/v1/skills", {
    data: {
      name: uniq(),
      kind: "SOP",
      sopGraph: {
        nodes: [
          { id: "s", type: "start" },
          { id: "hi", type: "llm", prompt: "高分路径 {{score}}" },
          { id: "lo", type: "llm", prompt: "低分路径 {{score}}" },
          { id: "e", type: "end" },
        ],
        edges: [
          { from: "s", to: "hi", when: { var: "score", op: "gte", value: 80 } },
          { from: "s", to: "lo" },
          { from: "hi", to: "e" },
          { from: "lo", to: "e" },
        ],
        variables: [],
      },
    },
  });
  const skillId = ((await created.json()) as { data: { id: string } }).data.id;

  for (const [score, expectPath] of [
    [90, "高分路径"],
    [10, "低分路径"],
  ] as const) {
    const runRes = await page.request.post(`/api/v1/skills/${skillId}/run`, {
      data: { employeeId: staffId, variables: { score } },
    });
    const run = ((await runRes.json()) as { data: { conversationId: string } }).data;
    const conv = await page.request.get(`/api/v1/conversations/${run.conversationId}`);
    const convBody = (await conv.json()) as { data: { messages: Array<{ content: string }> } };
    expect(
      convBody.data.messages.some((m) => m.content.includes(expectPath)),
      `score=${score} 应走 ${expectPath}`,
    ).toBe(true);
  }
  await page.request.delete(`/api/v1/skills/${skillId}`);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("SKILL-002-03 人工节点:运行暂停→handoffs 解决→续跑完成", async ({ authedPage: page }) => {
  const staffId = await setupStaff(page);
  const created = await page.request.post("/api/v1/skills", {
    data: {
      name: uniq(),
      kind: "SOP",
      sopGraph: {
        nodes: [
          { id: "s", type: "start" },
          { id: "h", type: "human", instruction: "人工复核" },
          { id: "e", type: "end" },
        ],
        edges: [
          { from: "s", to: "h" },
          { from: "h", to: "e" },
        ],
        variables: [],
      },
    },
  });
  const skillId = ((await created.json()) as { data: { id: string } }).data.id;

  // 运行 → PAUSED_HANDOFF
  const runRes = await page.request.post(`/api/v1/skills/${skillId}/run`, {
    data: { employeeId: staffId, variables: {} },
  });
  const run = ((await runRes.json()) as { data: { status: string; conversationId: string } }).data;
  expect(run.status).toBe("PAUSED_HANDOFF");

  // 解决接管 → 续跑完成
  await page.goto("/handoffs");
  await expect(page.getByTestId("handoffs-page")).toBeVisible({ timeout: 15_000 });
  const row = page.getByTestId("handoffs-table").getByRole("row").filter({ hasText: "人工复核" });
  await row
    .getByRole("button", { name: /解\s*决/u })
    .first()
    .click();
  await page.getByRole("button", { name: /解\s*决\s*并\s*恢\s*复/u }).click();
  await expect(page.getByText("已解决——会话恢复对话")).toBeVisible({ timeout: 10_000 });

  // 会话续跑完成——续跑为 fire-and-forget,轮询强信号至完成（§3.5.1 条件退出+总时限）
  await expect
    .poll(
      async () => {
        const conv = await page.request.get(`/api/v1/conversations/${run.conversationId}`);
        const convBody = (await conv.json()) as {
          data: { messages: Array<{ role: string; content: string }> };
        };
        return convBody.data.messages.some(
          (m) => m.role === "SYSTEM" && m.content.includes("SOP 执行完成"),
        );
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  await page.request.delete(`/api/v1/skills/${skillId}`);
  await page.request.delete(`/api/v1/staffs/${staffId}`);
});

test("SKILL-002-04 非法图 422（无 end/缺变量）", async ({ authedPage: page }) => {
  const bad = await page.request.post("/api/v1/skills", {
    data: {
      name: uniq(),
      kind: "SOP",
      sopGraph: {
        nodes: [
          { id: "s", type: "start" },
          { id: "l", type: "llm", prompt: "x" },
        ],
        edges: [{ from: "s", to: "l" }],
        variables: [],
      },
    },
  });
  expect(bad.status()).toBe(422);
  expect(((await bad.json()) as { message: string }).message).toContain("end");
});

test("SKILL-002-05 未登录守卫(§3.2.2 例外)", async ({ page }) => {
  await page.goto("/skills");
  await expect(page).toHaveURL(/\/login\?next=%2Fskills/u);
});
