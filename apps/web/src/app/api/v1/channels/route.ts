import { Prisma } from "@prisma/client";
import { channelCreateInput, DomainError, ErrCode } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { generateChannelToken } from "@/server/channel-token";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 渠道列表（CHNL-001 §1.4-C1;token 只展示摘要特性,不回传）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.channelConfig.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk({
      items: rows.map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        employeeId: c.employeeId,
        enabled: c.enabled,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      total: rows.length,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 创建渠道（token 明文一次性返回,CHNL-001 §2.1）。 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, channelCreateInput);
    const staff = await prisma.digitalEmployee.findFirst({
      where: { id: input.employeeId, orgId: defaultOrgId(), deletedAt: null, status: "PUBLISHED" },
    });
    if (!staff) throw new DomainError(ErrCode.VALIDATION_FAILED, "绑定员工不存在或未发布");
    const token = generateChannelToken();
    try {
      const row = await prisma.channelConfig.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          platform: input.platform,
          employeeId: input.employeeId,
          tokenHash: token.tokenHash,
          enabled: input.enabled ?? true,
        },
      });
      void audit({
        actorId: user.uid,
        action: "chnl.create",
        targetType: "channel",
        targetId: row.id,
      });
      return jsonOk(
        {
          id: row.id,
          name: row.name,
          platform: row.platform,
          employeeId: row.employeeId,
          enabled: row.enabled,
          lastMessageAt: null,
          createdAt: row.createdAt.toISOString(),
          token: token.plaintext,
        },
        { status: 201 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, "同名渠道已存在");
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
