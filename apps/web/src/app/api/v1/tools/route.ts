import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, toolCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { encodeSecureHeaders, splitHeaders, toToolDto } from "@/server/tool-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 工具列表（TOOL-001 §1.4-C1）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.toolDefinition.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonOk({ items: rows.map(toToolDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 创建工具（敏感头加密列,TOOL-001 §2.1）。 */
export async function POST(req: Request) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, toolCreateInput);
    const { plain, secure } = splitHeaders(input.headers);
    try {
      const row = await prisma.toolDefinition.create({
        data: {
          orgId: defaultOrgId(),
          name: input.name,
          description: input.description ?? null,
          method: input.method,
          url: input.url,
          headersJson: plain,
          secureHeaders: Object.keys(secure).length > 0 ? encodeSecureHeaders(secure) : null,
        },
      });
      return jsonOk(toToolDto(row), { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DomainError(ErrCode.VALIDATION_FAILED, `工具名「${input.name}」已存在`);
      }
      throw e;
    }
  } catch (e) {
    return toErrorResponse(e);
  }
}
