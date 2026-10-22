import { Prisma } from "@prisma/client";
import { DomainError, ErrCode, modelCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toModelDto } from "@/server/model-dto";
import { encryptText } from "@/server/model-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 模型列表（MODEL-001 §1.4-C1）。 */
export async function GET() {
  try {
    await requirePermission("ORG_RESOURCE:READ");
    const rows = await prisma.modelConfig.findMany({
      where: { orgId: defaultOrgId(), deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return jsonOk({ items: rows.map(toModelDto), total: rows.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 注册模型（apiKey 加密落库;isDefault 互斥清旧）。 */
export async function POST(req: Request) {
  try {
    await requirePermission("ORG_RESOURCE:WRITE");
    const input = await parseBody(req, modelCreateInput);
    const orgId = defaultOrgId();
    const row = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.modelConfig.updateMany({
          where: { orgId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.modelConfig.create({
        data: {
          orgId,
          name: input.name,
          protocol: input.protocol,
          baseUrl: input.baseUrl,
          modelId: input.modelId,
          apiKeyEnc: encryptText(input.apiKey),
          isDefault: input.isDefault ?? false,
        },
      });
    });
    return jsonOk(toModelDto(row), { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return toErrorResponse(new DomainError(ErrCode.VALIDATION_FAILED, "模型名已存在"));
    }
    return toErrorResponse(e);
  }
}
