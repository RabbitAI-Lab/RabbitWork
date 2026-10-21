#!/usr/bin/env node
/**
 * JMeter API 测试栈（rules/testing §2.4 / §2.5；TEAM-001 首个 jmx 落地配套）：
 * 1) embedded-postgres（.pgdata-jm，端口 = 6460+slot；DATABASE_URL 已设则跳过）
 * 2) prisma migrate deploy + seed
 * 3) web 以生产构建启动（jm 端口 = 3800+slot）；AGENTSCOPE_MODE 默认 mock（确定性）
 * 用法：node scripts/jm-stack.mjs   （Ctrl-C 统一回收；与 dev.mjs 同款编排）
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rabbitEnv } from "./rabbit-env.mjs";

const ENV = rabbitEnv();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
let shuttingDown = false;

function log(msg) {
  console.log(`\x1b[36m[jm]\x1b[0m ${msg}`);
}

function waitPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, host);
      s.once("connect", () => {
        s.destroy();
        resolve();
      });
      s.once("error", () => {
        s.destroy();
        if (Date.now() > deadline) reject(new Error(`port ${port} timeout`));
        else setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

async function startEmbeddedPostgres() {
  if (process.env.DATABASE_URL) {
    log(`DATABASE_URL 已设置，跳过 embedded-postgres：${process.env.DATABASE_URL}`);
    return;
  }
  const dataDir = path.join(root, ENV.jm.pgDataDir);
  const port = ENV.jm.pgPort;
  if (existsSync(dataDir) && !existsSync(path.join(dataDir, "PG_VERSION"))) {
    rmSync(dataDir, { recursive: true, force: true });
  }
  const mod = await import("embedded-postgres");
  const EmbeddedPostgres = mod.default ?? mod.EmbeddedPostgres ?? mod;
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
  });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    await pg.initialise();
  } else {
    rmSync(path.join(dataDir, "postmaster.pid"), { force: true });
  }
  await pg.start();
  try {
    await pg.createDatabase(ENV.jm.database);
  } catch {
    // 已存在（持久目录重启）
  }
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/${ENV.jm.database}`;
  log(`embedded-postgres 就绪 :${port}（${dataDir}）`);
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 退出码 ${r.status}`);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/** 端口占用 fail-fast（rules/git-workflow §9.4）：next start 进程名会被改写为
 * next-server，pkill 按名匹配不可靠——启动前按端口检测，指名冲突而非静默抢占。 */
function assertPortFree(port, label) {
  const used = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  if ((used.stdout ?? "").trim().length > 0) {
    console.error(
      `[jm] 端口 ${port}（${label}）已被占用：\n${used.stdout}\n` +
        `先清理本槽位残留（kill $(lsof -ti :${port})）再启动；占用者 cwd 属其他 worktree 时须换槽位。`,
    );
    process.exit(2);
  }
}

async function main() {
  assertPortFree(ENV.jm.webPort, "jm web");
  assertPortFree(ENV.jm.pgPort, "jm pg");
  await startEmbeddedPostgres();
  run("pnpm", ["db:migrate"], { DATABASE_URL: process.env.DATABASE_URL });
  run("pnpm", ["db:seed"], { DATABASE_URL: process.env.DATABASE_URL });

  log(`worktree slot=${ENV.slot}（jm web :${ENV.jm.webPort} · pg :${ENV.jm.pgPort}）`);
  const web = spawn("pnpm", ["--filter", "web", "start"], {
    stdio: "inherit",
    cwd: root,
    env: {
      ...process.env,
      PORT: String(ENV.jm.webPort),
      WEB_URL: ENV.jm.webUrl,
      // 确定性口径：jm 栈默认 mock（显式 env 可覆盖为 real）
      AGENTSCOPE_MODE: process.env.AGENTSCOPE_MODE ?? "mock",
    },
  });
  children.push(web);
  await waitPort(ENV.jm.webPort, "127.0.0.1", 60000);
  log(`web 就绪 ${ENV.jm.webUrl} —— 执行 pnpm test:api（或 bash scripts/run-api-tests.sh）`);
  await new Promise((resolve) => web.on("exit", resolve));
}

main().catch((e) => {
  console.error(e);
  shutdown();
});
