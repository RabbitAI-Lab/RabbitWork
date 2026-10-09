/**
 * 统一结构化日志（rules/observability §1）：web 与后台 worker 一律走本 logger，
 * 禁止 console.log/warn/error 直写（脚本与 CLI 例外）。
 * 标准字段：reqId / userId / orgId / projectId / module（顶层 JSON，见规范 §1.2）。
 */
import pino from "pino";

// 脱敏键清单（rules/security §4.3 / observability §3）：新增敏感字段同步登记
const REDACT_PATHS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "authorization",
  "cookie",
  "credential",
  "*.password",
  "*.passwd",
  "*.secret",
  "*.token",
  "*.apikey",
  "*.authorization",
  "*.cookie",
  "*.credential",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
});
