import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient 全仓唯一出口（rules/database §1.2）：只有 apps/web/src/server 允许消费；
 * 后台 worker（引擎等，引入时）禁止直连数据库，状态经队列与 HTTP 回调交互。
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;
