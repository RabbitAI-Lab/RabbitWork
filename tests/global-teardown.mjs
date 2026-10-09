#!/usr/bin/env node
/** 停掉 global-setup 起的本槽位 embedded PG（复用模式 E2E_DATABASE_URL 下无操作）。 */
import { existsSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = path.join(root, "tests", ".e2e-pg.json");

export default async function globalTeardown() {
  if (process.env.E2E_DATABASE_URL || !existsSync(marker)) return;
  const { dataDir } = JSON.parse(readFileSync(marker, "utf8"));
  try {
    const mod = await import("embedded-postgres");
    const EmbeddedPostgres = mod.default ?? mod.EmbeddedPostgres ?? mod;
    // 同一 PGDATA 上重建实例句柄执行 pg_ctl stop
    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "postgres",
      password: "postgres",
      persistent: true,
    });
    await pg.stop();
    console.log(`[e2e-teardown] embedded-postgres 已停止（${dataDir}）`);
  } catch (e) {
    console.warn(`[e2e-teardown] 停止 PG 失败（可手动清理：lsof -ti :6450+slot）`, e);
  } finally {
    rmSync(marker, { force: true });
  }
}
