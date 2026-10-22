/** SOP 执行体（SKILL-002 §2.3）：同步逐步执行;人工节点经 CHAT-003 HANDOFF 暂停续跑。 */
import { prisma } from "@/server/db";
import { getAgentScope } from "@/server/agentscope";
import { pickEdge, renderSopPrompt, validateSopGraph, type SopGraph } from "@rabbit/shared";
import { logger } from "@rabbit/shared";

interface RunResult {
  conversationId: string;
  status: "COMPLETED" | "PAUSED_HANDOFF";
  steps: Array<{ nodeId: string; type: string; note: string }>;
}

async function appendMessage(conversationId: string, role: "USER" | "SYSTEM", content: string) {
  const last = await prisma.messageMirror.findFirst({
    where: { conversationId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  await prisma.messageMirror.create({
    data: { conversationId, seq: (last?.seq ?? 0) + 1, role, content },
  });
}

/** 执行 SOP（SKILL-002 §2.3;startNodeId 可指定续跑起点——HANDOFF 解决后从暂停节点继续）。 */
export async function runSop(opts: {
  skillId: string;
  employeeId: string;
  variables: Record<string, string | number>;
  /** 续跑:已有会话与起点 */
  resume?: { conversationId: string; startNodeId: string };
}): Promise<RunResult> {
  const skill = await prisma.skillDefinition.findUnique({ where: { id: opts.skillId } });
  if (!skill || skill.deletedAt || skill.kind !== "SOP") {
    throw new Error("技能不存在或非 SOP 类型");
  }
  const graph = skill.sopGraph as unknown as SopGraph;
  const errs = validateSopGraph(graph);
  if (errs.length > 0) throw new Error(`SOP 图非法：${errs[0]}`);
  // 必填变量校验
  for (const v of graph.variables) {
    if (v.required && !(v.key in opts.variables)) {
      throw new Error(`缺少必填变量：${v.key}`);
    }
  }
  const staff = await prisma.digitalEmployee.findFirst({
    where: { id: opts.employeeId, deletedAt: null, status: "PUBLISHED" },
  });
  if (!staff?.asAgentId) throw new Error("员工不存在或未发布");
  const agentId = staff.asAgentId;

  let conversationId: string;
  let nodeId: string;
  if (opts.resume) {
    conversationId = opts.resume.conversationId;
    nodeId = opts.resume.startNodeId;
  } else {
    const conv = await prisma.conversation.create({
      data: {
        orgId: staff.orgId,
        employeeId: staff.id,
        userId: staff.creatorId ?? "sop",
        title: `[SOP] ${skill.name}`,
        origin: "SOP",
        originRef: skill.id,
      },
    });
    conversationId = conv.id;
    const start = graph.nodes.find((n) => n.type === "start");
    if (!start) throw new Error("SOP 图缺少 start");
    nodeId = start.id;
    await appendMessage(conversationId, "SYSTEM", `SOP「${skill.name}」开始执行`);
  }

  const steps: RunResult["steps"] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outEdges = new Map<string, typeof graph.edges>();
  for (const e of graph.edges) {
    const arr = outEdges.get(e.from) ?? [];
    arr.push(e);
    outEdges.set(e.from, arr);
  }

  // 最大步数防环死循环（节点数×4 上限）;resume 起点的 human 节点已处理过——直接走出边
  const maxSteps = graph.nodes.length * 4;
  const resumeEntry = Boolean(opts.resume);
  for (let i = 0; i < maxSteps; i++) {
    const node = byId.get(nodeId);
    if (!node) throw new Error(`节点 ${nodeId} 不存在`);
    const isResumeHuman = resumeEntry && i === 0 && node.type === "human";
    if (node.type === "end") {
      await appendMessage(conversationId, "SYSTEM", "SOP 执行完成");
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: "ACTIVE", lastMessageAt: new Date() },
      });
      return { conversationId, status: "COMPLETED", steps };
    }
    if (node.type === "human" && !isResumeHuman) {
      // 暂停：HANDOFF 记录 + 系统消息;解决后由 resumeSopAfterHandoff 续跑
      await prisma.humanHandoffRecord.create({
        data: {
          conversationId,
          status: "PENDING",
          reason: node.instruction ?? `SOP 人工节点 ${node.id}`,
        },
      });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: "HANDOFF" },
      });
      // 暂停位置存 originRef 的扩展（SOP 图内起点）——写入消息可解析
      await appendMessage(
        conversationId,
        "SYSTEM",
        `[SOP:PAUSE] ${nodeId} ${node.instruction ?? ""}`.trim(),
      );
      steps.push({ nodeId, type: "human", note: "已暂停等待人工处理" });
      return { conversationId, status: "PAUSED_HANDOFF", steps };
    }
    if (node.type === "llm" && node.prompt) {
      const prompt = renderSopPrompt(node.prompt, opts.variables);
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      const provider = getAgentScope();
      const handle = conv?.asChatId
        ? await provider.sendTurn(conv.asChatId, agentId, prompt)
        : await (async () => {
            const created = await provider.startChat(agentId);
            return provider.sendTurn(created.chatId, agentId, prompt);
          })();
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          asChatId: handle.chatId,
          asSessionId: handle.sessionId,
          asRuntimeSessionId: handle.runtimeSessionId,
          lastMessageAt: new Date(),
        },
      });
      await appendMessage(conversationId, "USER", prompt);
      steps.push({ nodeId, type: "llm", note: "已执行" });
    }
    const next = pickEdge(outEdges.get(nodeId) ?? [], opts.variables);
    if (!next) throw new Error(`节点 ${nodeId} 无可用出边（条件均未命中且无兜底）`);
    nodeId = next.to;
  }
  logger.warn({ module: "sop", skillId: opts.skillId }, "sop max steps reached");
  throw new Error("SOP 执行超过最大步数（疑似图有环）");
}

/** HANDOFF 解决后续跑（handoffs/resolve 钩子调用;从 [SOP:PAUSE] 消息解析起点）。 */
export async function resumeSopAfterHandoff(conversationId: string): Promise<void> {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.origin !== "SOP" || !conv.originRef) return;
  const pauseMsg = await prisma.messageMirror.findFirst({
    where: { conversationId, role: "SYSTEM", content: { startsWith: "[SOP:PAUSE]" } },
    orderBy: { seq: "desc" },
  });
  if (!pauseMsg) return;
  const startNodeId = pauseMsg.content.split(" ")[1];
  if (!startNodeId) return;
  // 变量从首轮 USER 消息前不可复原——存哪? 首期:从 originRef 重建（变量不持久化,
  // 条件分支续跑后仅用常量条件——登记限制 R-RESUME-VARS,蒸馏迭代时随 SOP 运行表落地）
  try {
    await runSop({
      skillId: conv.originRef,
      employeeId: conv.employeeId,
      variables: {},
      resume: { conversationId, startNodeId },
    });
  } catch (e) {
    logger.warn({ module: "sop", conversationId, err: String(e) }, "sop resume failed");
  }
}
