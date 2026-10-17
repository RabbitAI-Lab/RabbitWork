/** 种子数据：幂等，可重复执行（rules/database §6.5）。S1：默认组织 + 管理员账号。 */
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 默认组织固定 ID（幂等 upsert 锚点；三级权限模型的最小载体） */
const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_USER_ID = "00000000-0000-4000-8000-0000000000a1";

/** scrypt 口令哈希（与 apps/web/src/server/auth.ts 同算法：scrypt$N$salt$hash） */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$16384$${salt}$${hash}`;
}

async function main() {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: { id: DEFAULT_ORG_ID, name: "默认组织", isDefault: true },
  });

  // 管理员：admin@rabbitwork.local / rabbit123（SEED_ADMIN_PASSWORD 可覆盖，仅首次创建生效）
  const email = "admin@rabbitwork.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "rabbit123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        id: ADMIN_USER_ID,
        email,
        name: "管理员",
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash: hashPassword(password),
      },
    });
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: DEFAULT_ORG_ID, userId: ADMIN_USER_ID } },
      update: {},
      create: { orgId: DEFAULT_ORG_ID, userId: ADMIN_USER_ID, role: "OWNER" },
    });
  }
}

main()
  .then(() => {
    void prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
