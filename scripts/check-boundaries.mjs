#!/usr/bin/env node
/** 跨域引用静态检查（dependency-graph §4 禁止方向；目录不存在时跳过该规则）。 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
let violations = 0;

function walk(dir, cb) {
  for (const f of readdirSync(dir)) {
    if (f === "node_modules" || f.startsWith(".")) continue;
    const p = path.join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, cb);
    else if (/\.(ts|tsx)$/.test(f)) cb(p);
  }
}

const rules = [
  {
    scope: "apps/engine",
    banned: [/@rabbit\/db/, /@\/server/, /@\/components/],
    why: "engine 不得依赖 web 与 db（monorepo-structure §2.2；服务引入时生效）",
  },
  {
    scope: "packages/ui",
    banned: [/@rabbit\/api-client/, /@\/stores/],
    why: "packages/ui 不得依赖业务客户端与状态（monorepo-structure §2.5）",
  },
];

for (const rule of rules) {
  const dir = path.join(root, rule.scope);
  if (!existsSync(dir)) continue;
  walk(dir, (file) => {
    const src = readFileSync(file, "utf8");
    for (const re of rule.banned) {
      if (re.test(src)) {
        console.error(`[boundary] ${path.relative(root, file)} 违反：${rule.why}`);
        violations += 1;
      }
    }
  });
}

// 域包只准经 Provider 接口跨域引用（dependency-graph §4.2）：下游域不得直接 import 上游域模型。
// 域目录随首个域规格建立；登记处见 docs/architecture/dependency-graph.md §4。
const domainsDir = path.join(root, "apps/web/src/server/domains");
if (existsSync(domainsDir)) {
  const providerDownstreams = JSON.parse(
    readFileSync(path.join(root, "scripts/check-boundaries.domains.json"), "utf8"),
  );
  walk(domainsDir, (file) => {
    const rel = path.relative(root, file);
    const domain = rel.split("/").at(-2);
    const banned = providerDownstreams[domain ?? ""] ?? [];
    if (banned.length === 0) return;
    const src = readFileSync(file, "utf8");
    const m = src.match(new RegExp(`domains/(${banned.join("|")})/`));
    if (m) {
      console.error(
        `[boundary] ${rel} 直接引用 ${m[1]} 域（须走 Provider，dependency-graph §4.2）`,
      );
      violations += 1;
    }
  });
}

if (violations > 0) {
  console.error(`boundary check: ${violations} violation(s)`);
  process.exit(1);
}
console.log("boundary check: PASS");
