/**
 * AgentScope 适配层唯一出口（蓝图 §5.1）：
 * real = 真实实例（契约 2026-10-17 实测冻结）；mock = 确定性脚本回复（CI/e2e）。
 * 两种形态差异（provisioning 卡死 → fallbackAgentId 回退）全部收敛在本包内。
 */
import { AgentScopeClient, AgentScopeError } from "./client";
import { MockAgentScope } from "./mock";
import type {
  AgentScopeOptions,
  AsAgent,
  AsAgentTask,
  AsRawEvent,
  ChatHandle,
  ProviderMode,
} from "./types";

export { AgentScopeError } from "./client";
export { normalizeEvent, normalizeEvents, summarizeRun } from "./events";
export type {
  AgentScopeOptions,
  AsAgent,
  AsAgentTask,
  AsRawEvent,
  AsTeam,
  ChatEvent,
  ChatHandle,
  EventMeta,
  NormalizedEvent,
  ProviderMode,
  RunSummary,
} from "./types";

export interface EnsureAgentInput {
  agentKey: string;
  displayName: string;
  description?: string;
}

export interface EnsureAgentResult {
  agentId: string;
  namespace: string;
  agentStatus: string;
  usedFallback: boolean;
}

/** TEAM-001 浅映射：建队/改队归一入口（asTeamId 空则建，非空则改；同名复用） */
export interface EnsureTeamInput {
  name: string;
  leaderAgentId: string;
  /** 已关联的上游团队 id；空 = 需要创建 */
  asTeamId?: string | null;
}

export interface EnsureTeamResult {
  teamId: string;
  /** true = 未发起新建，命中既有上游团队（同名匹配/更新既有） */
  reusedExisting: boolean;
}

export interface AgentScopeProvider {
  readonly mode: ProviderMode;
  ensureAgent(input: EnsureAgentInput): Promise<EnsureAgentResult>;
  ensureTeam(input: EnsureTeamInput): Promise<EnsureTeamResult>;
  listAgentTasks(teamId?: string): Promise<AsAgentTask[]>;
  startChat(agentId: string, firstMessage?: string): Promise<ChatHandle>;
  sendTurn(chatId: string, agentId: string, message: string): Promise<ChatHandle>;
  fetchEvents(sessionId: string, chatId: string): Promise<AsRawEvent[]>;
  interrupt(runtimeSessionId: string): Promise<boolean>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

function envOptions(): Partial<AgentScopeOptions> {
  return {
    mode: (process.env.AGENTSCOPE_MODE as ProviderMode) ?? "mock",
    baseUrl: process.env.AGENTSCOPE_BASE_URL ?? "",
    username: process.env.AGENTSCOPE_USERNAME ?? "",
    password: process.env.AGENTSCOPE_PASSWORD ?? "",
    tenant: process.env.AGENTSCOPE_TENANT ?? "default",
    namespace: process.env.AGENTSCOPE_NAMESPACE ?? "default",
    fallbackAgentId: process.env.AGENTSCOPE_FALLBACK_AGENT_ID || undefined,
    timeoutMs: Number(process.env.AGENTSCOPE_TIMEOUT_MS ?? 30000),
  };
}

export function createAgentScopeProvider(
  overrides: Partial<AgentScopeOptions> = {},
): AgentScopeProvider {
  const merged = { ...envOptions(), ...overrides } as AgentScopeOptions;
  if (merged.mode === "real") {
    if (!merged.baseUrl || !merged.username || !merged.password) {
      throw new Error("AGENTSCOPE_MODE=real 需要 BASE_URL / USERNAME / PASSWORD 配置");
    }
    return new RealProvider(merged);
  }
  return new MockProvider(merged);
}

// ───── real ─────

export class RealProvider implements AgentScopeProvider {
  readonly mode = "real" as const;
  constructor(
    private opts: AgentScopeOptions,
    private client: AgentScopeClient = new AgentScopeClient(opts),
  ) {}

  async ensureAgent(input: EnsureAgentInput): Promise<EnsureAgentResult> {
    let agent: AsAgent | undefined;
    try {
      const agents = await this.client.listAgents();
      agent = agents.find((a) => a.agentKey === input.agentKey);
    } catch (e) {
      throw toAgentScopeError(e, "列出 agents 失败");
    }
    if (!agent) {
      try {
        agent = await this.client.createAgent(input);
      } catch (e) {
        throw toAgentScopeError(e, "创建 agent 失败");
      }
    }
    // 新建 agent 可能停在 provisioning（实例需控制台完成运行时配置）——配置了
    // fallbackAgentId 时回退到既有可用 agent，保证发布/对话链路可用（蓝图 R1 降级路径）
    if (agent.status !== "active" && this.opts.fallbackAgentId) {
      return {
        agentId: this.opts.fallbackAgentId,
        namespace: this.opts.namespace,
        agentStatus: `fallback(${agent.status ?? "unknown"})`,
        usedFallback: true,
      };
    }
    return {
      agentId: agent.id!,
      namespace: this.opts.namespace,
      agentStatus: agent.status ?? "unknown",
      usedFallback: false,
    };
  }

  async ensureTeam(input: EnsureTeamInput): Promise<EnsureTeamResult> {
    // 已关联 → 更新；上游团队丢失（404）→ 落到建队路径重建关联
    if (input.asTeamId) {
      try {
        const team = await this.client.updateTeam(input.asTeamId, {
          name: input.name,
          leaderAgentId: input.leaderAgentId,
        });
        return { teamId: team.id, reusedExisting: true };
      } catch (e) {
        if (!(e instanceof AgentScopeError) || e.status !== 404) throw e;
      }
    }
    try {
      const team = await this.client.createTeam({
        name: input.name,
        leaderAgentId: input.leaderAgentId,
      });
      return { teamId: team.id, reusedExisting: false };
    } catch (e) {
      // 同名冲突（如本地未同步过的重建）→ 列表匹配既有团队回写关联（TEAM-001 §2.2.4）
      if (!(e instanceof AgentScopeError)) throw e;
      const teams = await this.client.listTeams();
      const match = teams.find((t) => t.name === input.name);
      if (!match) throw e;
      await this.client.updateTeam(match.id, {
        name: input.name,
        leaderAgentId: input.leaderAgentId,
      });
      return { teamId: match.id, reusedExisting: true };
    }
  }

  async listAgentTasks(_teamId?: string): Promise<AsAgentTask[]> {
    // 上游暂无按团队过滤的已冻结参数（TEAM-001 §4.1 R-TASK-SHAPE）——返回 namespace 全量，
    // 形状冻结后在此接过滤；_teamId 保留形参以对齐 Provider 接口
    return this.client.listAgentTasks();
  }

  async startChat(agentId: string, firstMessage?: string): Promise<ChatHandle> {
    return this.client.createChat(agentId, firstMessage);
  }

  async sendTurn(chatId: string, _agentId: string, message: string): Promise<ChatHandle> {
    return this.client.sendTurn(chatId, message);
  }

  async fetchEvents(sessionId: string, chatId: string): Promise<AsRawEvent[]> {
    return this.client.fetchEvents(sessionId, chatId);
  }

  async interrupt(runtimeSessionId: string): Promise<boolean> {
    return this.client.interrupt(runtimeSessionId);
  }

  async health() {
    return this.client.health();
  }
}

// ───── mock ─────

class MockProvider implements AgentScopeProvider {
  readonly mode = "mock" as const;
  constructor(
    private opts: AgentScopeOptions,
    private mock = new MockAgentScope(opts),
  ) {}

  async ensureAgent(input: EnsureAgentInput): Promise<EnsureAgentResult> {
    const agent = await this.mock.createAgent(input);
    return {
      agentId: agent.id,
      namespace: this.opts.namespace,
      agentStatus: "active",
      usedFallback: false,
    };
  }

  async ensureTeam(input: EnsureTeamInput): Promise<EnsureTeamResult> {
    if (input.asTeamId) {
      const team = await this.mock.updateTeam(input.asTeamId, {
        name: input.name,
        leaderAgentId: input.leaderAgentId,
      });
      return { teamId: team.id, reusedExisting: true };
    }
    const team = await this.mock.createTeam({
      name: input.name,
      leaderAgentId: input.leaderAgentId,
    });
    return { teamId: team.id, reusedExisting: false };
  }

  async listAgentTasks(teamId?: string): Promise<AsAgentTask[]> {
    return this.mock.listAgentTasks(teamId);
  }

  async startChat(agentId: string, firstMessage?: string): Promise<ChatHandle> {
    return this.mock.createChat(agentId, firstMessage);
  }

  async sendTurn(chatId: string, agentId: string, message: string): Promise<ChatHandle> {
    return this.mock.sendTurn(chatId, agentId, message);
  }

  async fetchEvents(sessionId: string, chatId: string): Promise<AsRawEvent[]> {
    return this.mock.fetchEvents(sessionId, chatId);
  }

  async interrupt(runtimeSessionId: string): Promise<boolean> {
    return this.mock.interrupt(runtimeSessionId);
  }

  async health() {
    return this.mock.health();
  }
}

function toAgentScopeError(e: unknown, context: string): AgentScopeError {
  if (e instanceof AgentScopeError) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new AgentScopeError(503, message, `AgentScope ${context}：${message}`);
}
