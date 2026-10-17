import { DomainError, ErrCode, conversationCreateInput } from "@rabbit/shared";
import { prisma } from "@/server/db";
import { defaultOrgId, requirePermission } from "@/server/auth";
import { jsonOk, parseBody, toErrorResponse } from "@/server/http";
import { toConversationDto } from "@/server/dto";

export const runtime = "nodejs";

/** CHAT-001：创建会话（AgentScope 侧 chat 在首条消息发送时懒创建）。 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ORG_CHAT:CREATE");
    const { id } = await ctx.params;
    const input = await parseBody(req, conversationCreateInput);
    const staff = await prisma.digitalEmployee.findFirst({
      where: { id, orgId: defaultOrgId(), deletedAt: null },
    });
    if (!staff) throw new DomainError(ErrCode.NOT_FOUND, "员工不存在");
    if (staff.status !== "PUBLISHED" || !staff.asAgentId) {
      throw new DomainError(ErrCode.STAFF_NOT_PUBLISHED, "员工未发布，请先发布再发起会话");
    }
    const conversation = await prisma.conversation.create({
      data: {
        orgId: staff.orgId,
        employeeId: staff.id,
        userId: user.uid,
        title: input.title?.trim() || `与 ${staff.name} 的对话`,
        status: "ACTIVE",
        origin: "WEB",
      },
    });
    return jsonOk(toConversationDto(conversation, staff), { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
