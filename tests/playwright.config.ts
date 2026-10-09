import { defineConfig } from "@playwright/test";
import { rabbitEnv } from "../scripts/rabbit-env.mjs";

/** rules/testing.md §3.3：录屏 on-with-retry + trace retain-on-failure + 失败截图 + HTML 报告。 */
const E = rabbitEnv();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 4,
  retries: process.env.CI ? 2 : 0, // 本地失败敏感：偶现即视为不稳定用例，必须修复
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    // 端口随 worktree 槽位（RabbitWork-s{N} → 3700+N；主仓/CI slot0=3700）
    baseURL: process.env.E2E_BASE_URL ?? E.e2e.webUrl,
    video: {
      mode:
        (process.env.E2E_VIDEO as "on" | "on-with-retry" | "off" | undefined) ?? "on-with-retry",
      size: { width: 1280, height: 720 },
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  outputDir: "../test-results",
  globalSetup: "./global-setup.mjs",
  globalTeardown: "./global-teardown.mjs",
  webServer: {
    // 全部必需 env 经 bash 默认展开注入（global-setup 起的 PG 端口即默认值；E2E_* 为显式
    // 覆盖口——CI service 库或修复循环常驻库复用模式，rules/testing §3.4.2）
    command:
      `bash -c 'DATABASE_URL="\${E2E_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:${E.e2e.pgPort}/${E.e2e.database}}" ` +
      `REDIS_URL="\${E2E_REDIS_URL:-}" PORT=${E.e2e.webPort} pnpm --filter web start'`,
    cwd: "..",
    url: `${E.e2e.webUrl}/api/v1/system/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env },
  },
});
