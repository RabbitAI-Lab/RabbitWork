/** 种子数据：幂等，可重复执行（rules/database §6.5）。S0 最小集：默认组织。 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 默认组织固定 ID（幂等 upsert 锚点；三级权限模型的最小载体） */
const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";

async function main() {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: { id: DEFAULT_ORG_ID, name: "默认组织", isDefault: true },
  });
  // 后续随域规格扩展：系统参数、预置用户组、管理员账号（先例：RabbitAITest seed.ts）
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
