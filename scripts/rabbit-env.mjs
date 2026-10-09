#!/usr/bin/env node
/**
 * 并行 worktree 槽位环境——单一事实源（移植自 RabbitAITest INFRA-005）。
 *
 * 多 worktree 并行联调/自测时，端口、Redis 逻辑库、/tmp 共享路径必须按槽位隔离，
 * 禁止在脚本/测试里硬编码端口（rules/git-workflow.md §9）。
 *
 * 槽位推导（优先级）：
 *   1. RABBIT_SLOT 环境变量（0-9）
 *   2. worktree 目录名 RabbitWork-s{N} → N
 *   3. 其余（主仓 / CI checkout）→ 0
 *
 * 端口表（base + slot，slot 0-9）：
 *   用途 | web    | mock（预留）| runner（预留）| PG    | Redis（逻辑库号 = slot）
 *   dev  | 3600+s | 4600+s     | 4900+s       | 6440+s| 127.0.0.1:6390/{s}
 *   e2e  | 3700+s | 4700+s     | 4910+s       | 6450+s| 127.0.0.1:6391/{s}
 *   jm   | 3800+s | 4800+s     | 4920+s       | 6460+s| 127.0.0.1:6391/{s}
 *
 * 相对 RabbitAITest（3000/3100/3200/4000/…/5440+ 系、Redis 6379/6381）端口基址整体偏移：
 * 同一台机器上 RabbitWork 与 RabbitAITest 的 worktree 并行时互不冲突（两项目槽位推导
 * 相互独立，同名槽位会撞同基址端口，故必须错开）；Redis 也用独立实例端口（6390/6391）
 * 而非共享实例换逻辑库——逻辑库号 0-15 容不下两项目 × 10 槽。
 *
 * CLI：
 *   node scripts/rabbit-env.mjs            # 打印 JSON
 *   node scripts/rabbit-env.mjs --shell    # 打印 export RABBIT_*=...（bash 脚本 eval 用）
 */
import path from "node:path";

export const MAX_SLOT = 9;

/**
 * 解析当前目录的槽位号。目录名匹配失败的（主仓 RabbitWork、CI checkout）返回 0；
 * 显式 RABBIT_SLOT 优先；超出 0-9 报错（端口表按 10 槽设计，扩容须重排基址）。
 */
export function resolveSlot(cwd = process.cwd(), env = process.env) {
  const explicit = Number(env.RABBIT_SLOT);
  if (Number.isInteger(explicit)) {
    if (explicit < 0 || explicit > MAX_SLOT) {
      throw new Error(`RABBIT_SLOT=${explicit} 超出 0-${MAX_SLOT}（端口表按 10 槽设计）`);
    }
    return explicit;
  }
  const m = /RabbitWork-s(\d+)$/.exec(path.basename(path.resolve(cwd)));
  if (m) {
    const n = Number(m[1]);
    if (n > MAX_SLOT) {
      throw new Error(
        `worktree 目录 ${path.basename(cwd)} 槽位 ${n} 超出 0-${MAX_SLOT}（端口表按 10 槽设计）`,
      );
    }
    return n;
  }
  return 0;
}

/** 按槽位计算全部环境资源标识（端口/URL/路径）。 */
export function rabbitEnv(slot = resolveSlot()) {
  if (slot < 0 || slot > MAX_SLOT) {
    throw new Error(`slot=${slot} 超出 0-${MAX_SLOT}`);
  }
  const db = String(slot);
  return {
    slot,
    dev: {
      webPort: 3600 + slot,
      webUrl: `http://localhost:${3600 + slot}`,
      // mock / runner 端口位预留：对应服务引入时启用（RabbitAITest 同表先例）
      mockPort: 4600 + slot,
      mockUrl: `http://127.0.0.1:${4600 + slot}`,
      runnerPort: 4900 + slot,
      pgPort: 6440 + slot,
      database: "rabbitwork",
      pgDataDir: ".pgdata",
      redisPort: 6390,
      redisUrl: `redis://127.0.0.1:6390/${db}`,
    },
    e2e: {
      webPort: 3700 + slot,
      webUrl: `http://localhost:${3700 + slot}`,
      mockPort: 4700 + slot,
      mockUrl: `http://127.0.0.1:${4700 + slot}`,
      runnerPort: 4910 + slot,
      pgPort: 6450 + slot,
      database: "rabbitwork_e2e",
      pgDataDir: ".pgdata-e2e",
      redisPort: 6391,
      redisUrl: `redis://127.0.0.1:6391/${db}`,
      // e2e web 构建副本目录（dev 与 e2e 并行会话防串台；RabbitAITest e2e-web-copy.mjs 先例）
      tmpWebRoot: `/tmp/rabbitwork-e2e-root-s${slot}`,
    },
    jm: {
      webPort: 3800 + slot,
      webUrl: `http://localhost:${3800 + slot}`,
      mockPort: 4800 + slot,
      mockUrl: `http://127.0.0.1:${4800 + slot}`,
      runnerPort: 4920 + slot,
      pgPort: 6460 + slot,
      database: "rabbitwork_jm",
      pgDataDir: ".pgdata-jm",
      redisPort: 6391,
      redisUrl: `redis://127.0.0.1:6391/${db}`,
      // JMeter 栈 pid/日志统一目录（共享 /tmp 路径按槽位隔离）
      tmpDir: `/tmp/rabbitwork-s${slot}-jm`,
    },
  };
}

/** bash 脚本 eval 用：`eval "$(node scripts/rabbit-env.mjs --shell)"`。 */
function shellExports(e) {
  const lines = [
    ["RABBIT_SLOT", e.slot],
    ["RABBIT_DEV_WEB_PORT", e.dev.webPort],
    ["RABBIT_DEV_WEB_URL", e.dev.webUrl],
    ["RABBIT_DEV_MOCK_PORT", e.dev.mockPort],
    ["RABBIT_DEV_RUNNER_PORT", e.dev.runnerPort],
    ["RABBIT_DEV_PG_PORT", e.dev.pgPort],
    [
      "RABBIT_DEV_DATABASE_URL",
      `postgresql://postgres:postgres@127.0.0.1:${e.dev.pgPort}/${e.dev.database}`,
    ],
    ["RABBIT_DEV_REDIS_URL", e.dev.redisUrl],
    ["RABBIT_DEV_REDIS_PORT", e.dev.redisPort],
    ["RABBIT_E2E_WEB_PORT", e.e2e.webPort],
    ["RABBIT_E2E_WEB_URL", e.e2e.webUrl],
    ["RABBIT_E2E_MOCK_PORT", e.e2e.mockPort],
    ["RABBIT_E2E_RUNNER_PORT", e.e2e.runnerPort],
    ["RABBIT_E2E_MOCK_URL", e.e2e.mockUrl],
    ["RABBIT_E2E_PG_PORT", e.e2e.pgPort],
    [
      "RABBIT_E2E_DATABASE_URL",
      `postgresql://postgres:postgres@127.0.0.1:${e.e2e.pgPort}/${e.e2e.database}`,
    ],
    ["RABBIT_E2E_REDIS_URL", e.e2e.redisUrl],
    ["RABBIT_E2E_REDIS_PORT", e.e2e.redisPort],
    ["RABBIT_E2E_TMP_WEB_ROOT", e.e2e.tmpWebRoot],
    ["RABBIT_JM_WEB_PORT", e.jm.webPort],
    ["RABBIT_JM_WEB_URL", e.jm.webUrl],
    ["RABBIT_JM_MOCK_PORT", e.jm.mockPort],
    ["RABBIT_JM_RUNNER_PORT", e.jm.runnerPort],
    ["RABBIT_JM_MOCK_URL", e.jm.mockUrl],
    ["RABBIT_JM_PG_PORT", e.jm.pgPort],
    [
      "RABBIT_JM_DATABASE_URL",
      `postgresql://postgres:postgres@127.0.0.1:${e.jm.pgPort}/${e.jm.database}`,
    ],
    ["RABBIT_JM_REDIS_URL", e.jm.redisUrl],
    ["RABBIT_JM_REDIS_PORT", e.jm.redisPort],
    ["RABBIT_JM_TMP_DIR", e.jm.tmpDir],
  ];
  return lines.map(([k, v]) => `export ${k}=${v}`).join("\n") + "\n";
}

// CLI 入口判定：仅当本模块是启动脚本（playwright.config 的 CJS 编译路径不含 import.meta，故用 argv 判定）
const isMain = typeof process.argv[1] === "string" && process.argv[1].endsWith("rabbit-env.mjs");
if (isMain) {
  const e = rabbitEnv();
  if (process.argv.includes("--shell")) {
    process.stdout.write(shellExports(e));
  } else {
    console.log(JSON.stringify(e, null, 2));
  }
}
