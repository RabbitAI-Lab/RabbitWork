#!/usr/bin/env node
/**
 * e2e 全局起栈（全新口径）：
 * 1) E2E_DATABASE_URL 已设 → 复用既有库（修复循环复用模式，rules/testing §3.4.2），跳过建库
 * 2) 否则起本槽位 embedded PG（端口 6450+slot，.pgdata-e2e）→ migrate deploy + seed
 * 3) web 生产构建缺失时补构建（webServer 以 next start 拉起；源码变更后请重跑 pnpm --filter web build）
 * teardown 见 global-teardown.mjs（停 PG）。
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 槽位环境经子进程 JSON 获取（不走静态 import）：playwright 的 globalSetup 加载管线会
// 将 import 的 .mjs 转 CJS 导致命名导出丢失（RabbitAITest INFRA-005 实测）；子进程口径与 CLI/Node 侧恒一致
const E = JSON.parse(
  spawnSync("node", [path.join(root, "scripts/rabbit-env.mjs")], {
    encoding: "utf8",
    cwd: root,
  }).stdout,
);
const marker = path.join(root, "tests", ".e2e-pg.json");

function sh(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 失败（exit ${r.status}）`);
}

async function startEmbeddedPostgres() {
  const dataDir = path.join(root, E.e2e.pgDataDir);
  if (existsSync(dataDir) && !existsSync(path.join(dataDir, "PG_VERSION"))) {
    rmSync(dataDir, { recursive: true, force: true });
  }
  const mod = await import("embedded-postgres");
  const EmbeddedPostgres = mod.default ?? mod.EmbeddedPostgres ?? mod;
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: E.e2e.pgPort,
    persistent: true,
  });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    await pg.initialise();
  } else {
    rmSync(path.join(dataDir, "postmaster.pid"), { force: true });
  }
  await pg.start();
  try {
    await pg.createDatabase(E.e2e.database);
  } catch {
    // 已存在（持久目录重启）
  }
  const url = `postgresql://postgres:postgres@127.0.0.1:${E.e2e.pgPort}/${E.e2e.database}`;
  writeFileSync(marker, JSON.stringify({ dataDir, slot: E.slot }, null, 2));
  console.log(`[e2e-setup] embedded-postgres 就绪 :${E.e2e.pgPort}（${dataDir}）`);
  return url;
}

export default async function globalSetup() {
  let databaseUrl;
  if (process.env.E2E_DATABASE_URL) {
    console.log(`[e2e-setup] 复用既有数据库（跳过建库）：${process.env.E2E_DATABASE_URL}`);
    databaseUrl = process.env.E2E_DATABASE_URL;
  } else {
    databaseUrl = await startEmbeddedPostgres();
  }

  sh("pnpm", ["--filter", "@rabbit/db", "migrate-deploy"], { DATABASE_URL: databaseUrl });
  sh("pnpm", ["--filter", "@rabbit/db", "seed"], { DATABASE_URL: databaseUrl });

  if (!existsSync(path.join(root, "apps/web/.next/BUILD_ID"))) {
    console.log("[e2e-setup] web 构建缺失，补构建（next start 需要）…");
    sh("pnpm", ["--filter", "web", "build"], { DATABASE_URL: databaseUrl });
  }
  console.log(`[e2e-setup] 就绪：web 将起在 ${E.e2e.webUrl}（槽位 ${E.slot}）`);
}
