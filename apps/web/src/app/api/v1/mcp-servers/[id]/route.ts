import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, mcpUpdateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toMcpDto } from "@/server/mcp-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findMcp(id: string) {
  const row = await prisma.mcpServerConfig.findFirst({
    where: { id, orgId: defaultOrgId(), deletedAt: null },
  });
  if (!row) throw new DomainError(ErrCode.NOT_FOUND, "MCP 服务不存在");
  return row;
}

/** 编辑。 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findMcp(id);
    const input = await parseBody(req, mcpUpdateInput);
    try {
      const row = await prisma.mcpServerConfig.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.transport !== undefined ? { transport: input.transport } : {}),
          ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
          ...(input.config !== undefined
            ? { configJson: input.config as Prisma.InputJsonValue } // 边界断言（同上）
            : {}),
        },
      });
      return jsonOk(toMcpDto(row));
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

/** 软删。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const { id } = await ctx.params;
    await findMcp(id);
    await prisma.mcpServerConfig.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED" },
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
