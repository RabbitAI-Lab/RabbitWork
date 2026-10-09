/**
 * 服务端数据访问收口（rules/database §1.2）：只有 apps/web/src/server 可用 PrismaClient，
 * 域服务一律从本门面 import prisma；后台 worker 禁止直连数据库。
 */
export { prisma } from "@rabbit/db";
