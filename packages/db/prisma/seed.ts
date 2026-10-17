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

/** 资源域种子（RESOURCE-001）：示例技能与知识库，幂等。 */
async function seedResources() {
  const skills = [
    {
      name: "结构化周报生成",
      description: "按「结论-数据-风险-下周计划」四段式输出工作周报",
      kind: "PROMPT",
      promptTemplate:
        "请按以下结构整理周报：\n1. 本周结论（3 条以内）\n2. 关键数据（表格）\n3. 风险与依赖\n4. 下周计划（按优先级）",
    },
    {
      name: "需求澄清访谈",
      description: "通过五问法澄清模糊需求，输出结构化需求摘要",
      kind: "PROMPT",
      promptTemplate:
        "针对用户描述的需求，依次澄清：目标用户、使用场景、成功标准、边界约束、优先级，然后输出需求摘要。",
    },
  ];
  for (const s of skills) {
    await prisma.skillDefinition.upsert({
      where: { orgId_name: { orgId: DEFAULT_ORG_ID, name: s.name } },
      update: {},
      create: { orgId: DEFAULT_ORG_ID, ...s },
    });
  }

  const kbs = [
    { name: "产品手册", description: "RabbitWork 平台功能说明与常见问题" },
    { name: "前端规范库", description: "设计系统 v2.1 与编码规范文档" },
  ];
  for (const k of kbs) {
    const existing = await prisma.knowledgeBase.findFirst({
      where: { orgId: DEFAULT_ORG_ID, name: k.name },
    });
    if (!existing) {
      await prisma.knowledgeBase.create({ data: { orgId: DEFAULT_ORG_ID, ...k } });
    }
  }
}

async function main() {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: { id: DEFAULT_ORG_ID, name: "默认组织", isDefault: true },
  });
  await seedResources();

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
