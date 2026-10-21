/** Mock 运行时：无 AgentScope 实例时的确定性脚本回复（CI/e2e 一律走本模式——蓝图 §8）。 */
import { randomUUID } from "node:crypto";
import { AgentScopeError } from "./client";
import type { AgentScopeOptions, AsAgentTask, AsRawEvent, AsTeam, ChatHandle } from "./types";

interface MockChat {
  sessionId: string;
  runtimeSessionId: string;
  events: AsRawEvent[];
}

/**
 * 事件信封与真实实例同构（event_delta/item.completed/usage.recorded/run.ended），
 * 供上层归一化链路与真实模式共用同一套代码路径。
 *
 * teams 浅映射确定性约定（TEAM-001）：
 * - 团队名以 "FAIL:" 开头 → ensureTeam 抛 503（e2e/jmx 同步失败态演练；改名后即恢复）；
 * - 每个经 ensureTeam 建出的团队自动挂 2 条任务（C6 有数据）；LOCAL_ONLY 团队无任务（C7 空态）。
 */
export class MockAgentScope {
  readonly mode = "mock" as const;
  private agents = new Map<string, { displayName: string; description?: string }>();
  private chats = new Map<string, MockChat>();
  private teams = new Map<string, AsTeam>();
  private tasks = new Map<string, AsAgentTask[]>();
  private seq = 0;

  constructor(_opts: AgentScopeOptions) {
    void _opts;
  }

  async listAgents() {
    return [...this.agents.entries()].map(([id, a]) => ({
      id,
      agentKey: id,
      displayName: a.displayName,
      description: a.description,
      status: "active",
      version: 1,
    }));
  }

  async createAgent(input: { agentKey: string; displayName: string; description?: string }) {
    const id = `mock-agent-${input.agentKey}`;
    this.agents.set(id, { displayName: input.displayName, description: input.description });
    return {
      id,
      agentKey: input.agentKey,
      displayName: input.displayName,
      description: input.description,
      status: "active",
      version: 1,
    };
  }

  async listTeams(): Promise<AsTeam[]> {
    return [...this.teams.values()].map((t) => ({ ...t }));
  }

  async createTeam(input: { name: string; leaderAgentId: string }): Promise<AsTeam> {
    return this.upsertTeam(undefined, input);
  }

  async updateTeam(
    teamId: string,
    input: { name: string; leaderAgentId: string },
  ): Promise<AsTeam> {
    return this.upsertTeam(teamId, input);
  }

  async listAgentTasks(teamId?: string): Promise<AsAgentTask[]> {
    if (!teamId) return [...this.tasks.values()].flat();
    return [...(this.tasks.get(teamId) ?? [])];
  }

  private upsertTeam(
    teamId: string | undefined,
    input: { name: string; leaderAgentId: string },
  ): AsTeam {
    if (input.name.startsWith("FAIL:")) {
      // 故障注入（确定性）：同步失败态的 e2e/jmx 演练开关
      throw new AgentScopeError(503, "mock injected failure", "AgentScope 上游不可用（mock 注入）");
    }
    const existing = teamId ? this.teams.get(teamId) : undefined;
    if (teamId && !existing) {
      throw new AgentScopeError(404, "mock team not found", "AgentScope 团队不存在（mock）");
    }
    const id = existing?.id ?? `mock-team-${randomUUID().slice(0, 8)}`;
    const team: AsTeam = {
      ...existing,
      id,
      name: input.name,
      leaderAgentId: input.leaderAgentId,
      status: "active",
      policy: existing?.policy ?? {},
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.teams.set(id, team);
    if (!existing) {
      this.tasks.set(id, [
        {
          id: `mock-task-${id}-1`,
          title: "Mock 演练任务·撰写复盘初稿",
          status: "active",
          assignee: null,
          updatedAt: new Date().toISOString(),
        },
        {
          id: `mock-task-${id}-2`,
          title: "Mock 演练任务·竞品监测周报",
          status: "pending",
          assignee: null,
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
    return { ...team };
  }

  async createChat(agentId: string, message?: string): Promise<ChatHandle> {
    const chatId = randomUUID();
    const chat: MockChat = {
      sessionId: randomUUID(),
      runtimeSessionId: `sess_mock_${chatId.slice(0, 8)}`,
      events: [],
    };
    this.chats.set(chatId, chat);
    if (message) void this.scriptRun(chatId, agentId, message);
    return { chatId, sessionId: chat.sessionId, runtimeSessionId: chat.runtimeSessionId };
  }

  async sendTurn(chatId: string, agentId: string, message: string): Promise<ChatHandle> {
    const chat = this.chats.get(chatId);
    if (!chat) throw new Error(`mock chat 不存在：${chatId}`);
    void this.scriptRun(chatId, agentId, message);
    return { chatId, sessionId: chat.sessionId, runtimeSessionId: chat.runtimeSessionId };
  }

  async fetchEvents(_sessionId: string, chatId: string): Promise<AsRawEvent[]> {
    return [...(this.chats.get(chatId)?.events ?? [])];
  }

  async streamEvents(
    _url: string,
    onEvent: (raw: AsRawEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    // mock 模式统一走 replay 轮询语义：此处仅作保活空转（web 层用 fetchEvents 轮询）
    void onEvent;
    void signal;
    await new Promise((r) => setTimeout(r, 500));
  }

  async interrupt(runtimeSessionId: string): Promise<boolean> {
    for (const chat of this.chats.values()) {
      if (chat.runtimeSessionId === runtimeSessionId) {
        chat.events.push({ eventType: "session.interrupted", frameworkMeta: null });
        return true;
      }
    }
    return false;
  }

  async health() {
    return { ok: true as const, detail: "mock" };
  }

  /** 脚本化一轮运行：分片 delta → usage → item.completed(final) → run.ended */
  private async scriptRun(chatId: string, agentId: string, message: string) {
    const chat = this.chats.get(chatId);
    if (!chat) return;
    const agent = this.agents.get(agentId);
    const runId = `mock-run-${randomUUID().slice(0, 8)}`;
    const turnId = randomUUID();
    const itemId = `item_model_mock_${randomUUID().slice(0, 8)}`;
    const reply =
      `【${agent?.displayName ?? "数字员工"}·Mock】已收到你的消息："${message.slice(0, 120)}"。` +
      `当前运行在 Mock 模式（AGENTSCOPE_MODE=mock），未连接真实 AgentScope 实例。`;
    const chunks = reply.match(/.{1,8}/gu) ?? [reply];
    for (const text of chunks) {
      await delay(90);
      chat.events.push({
        seq: ++this.seq,
        eventType: "event_delta",
        frameworkMeta: {
          public_event: {
            type: "item.delta",
            payload: {
              run_id: runId,
              turn_id: turnId,
              item_id: itemId,
              content: [{ text, type: "text" }],
            },
          },
        },
      });
    }
    await delay(120);
    chat.events.push({
      seq: ++this.seq,
      eventType: "span.model_request_end",
      frameworkMeta: {
        public_event: {
          type: "usage.recorded",
          payload: {
            run_id: runId,
            turn_id: turnId,
            model: "mock-model",
            usage: {
              inputTokens: 20 + message.length,
              outputTokens: reply.length,
              totalTokens: 20 + message.length + reply.length,
              time: 0.5,
            },
          },
        },
      },
    });
    await delay(120);
    chat.events.push({
      seq: ++this.seq,
      eventType: "agent.message",
      frameworkMeta: {
        public_event: {
          type: "item.completed",
          payload: {
            run_id: runId,
            turn_id: turnId,
            item_id: itemId,
            message_id: `mock-msg-${randomUUID().slice(0, 8)}`,
            final_output: true,
            item: {
              id: itemId,
              role: "ASSISTANT",
              type: "message",
              status: "completed",
              content: [{ text: reply, type: "text" }],
            },
          },
        },
      },
    });
    await delay(100);
    chat.events.push({
      seq: ++this.seq,
      eventType: "run.ended",
      frameworkMeta: {
        public_event: {
          type: "run.ended",
          payload: { run_id: runId, turn_id: turnId, status: "completed", reason: "MODEL_STOP" },
        },
      },
    });
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
