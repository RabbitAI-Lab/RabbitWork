import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, mcpCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toMcpDto } from "@/server/mcp-dto";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** MCP 服务列表（TOOL-002 §1.4-C1）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.mcpServerConfig.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk({ items: rows.map(toMcpDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 注册 MCP 服务。 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, mcpCreateInput);
    try {
      const row = await prisma.mcpServerConfig.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          transport: input.transport,
          endpoint: input.endpoint,
          // Prisma Json 输入边界：zod unknown 收窄为 InputJsonValue（边界断言,rules/typescript §3.2）
          configJson: input.config as Prisma.InputJsonValue,
        },
      });
      void audit({ actorId: user.uid, action: "mcp.create", targetType: "mcp", targetId: row.id });
      return jsonOk(toMcpDto(row), { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, `MCP 服务名「${input.name}」已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
