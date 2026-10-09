/**
 * e2e 环境基址单一来源（INFRA-005）：
 * 端口随 worktree 槽位（scripts/rabbit-env.mjs），禁止在 spec 里写死端口——
 * 多 worktree 并行跑 e2e 时各用各的槽位端口，互不串台。
 * E2E_BASE_URL 保留为显式覆盖口（CI 特殊口径或远程目标机）。
 */
import { rabbitEnv } from "../../scripts/rabbit-env.mjs";

const E = rabbitEnv();

/** 被测 web 基址（page 走 playwright.config baseURL；API 直打/cookie 域用这里） */
export const E2E_BASE = process.env.E2E_BASE_URL ?? E.e2e.webUrl;
