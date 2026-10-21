/** AgentScope 真实客户端：JWT 登录/缓存、agents/chats/turns/events + teams 浅映射（契约 2026-10-17/10-21 实测冻结）。 */
import type {
  AgentScopeOptions,
  AsAgent,
  AsAgentTask,
  AsRawEvent,
  AsTeam,
  ChatHandle,
} from "./types";

export class AgentScopeError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message?: string,
  ) {
    super(message ?? `AgentScope 上游错误（HTTP ${status}）：${body.slice(0, 300)}`);
    this.name = "AgentScopeError";
  }
}

interface LoginResponse {
  token?: string;
  userId?: string;
  error?: string;
}

export class AgentScopeClient {
  private token?: { value: string; expMs: number };

  constructor(readonly opts: AgentScopeOptions) {}

  // ───── 认证 ─────

  async login(): Promise<string> {
    const res = await this.fetchRaw("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: this.opts.username, password: this.opts.password }),
    });
    const data = (await res.json().catch(() => ({}))) as LoginResponse;
    if (!res.ok || !data.token) {
      throw new AgentScopeError(res.status, JSON.stringify(data), "AgentScope 登录失败");
    }
    this.token = { value: data.token, expMs: jwtExpMs(data.token) ?? Date.now() + 3600_000 };
    return data.token;
  }

  private async getToken(): Promise<string> {
    const marginMs = 120_000; // 到期前 2 分钟刷新
    if (!this.token || Date.now() > this.token.expMs - marginMs) await this.login();
    return this.token!.value!;
  }

  // ───── 底层请求 ─────

  private async fetchRaw(
    path: string,
    init: RequestInit = {},
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.opts.timeoutMs);
    try {
      return await fetch(`${this.opts.baseUrl}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const res = await this.fetchRaw(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AgentScopeError(res.status, text);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private scope(): string {
    return `tenant=${encodeURIComponent(this.opts.tenant)}&namespace=${encodeURIComponent(this.opts.namespace)}`;
  }

  // ───── agents ─────

  async listAgents(): Promise<AsAgent[]> {
    const data = await this.api<{ items?: AsAgent[] }>(`/api/v1/agents?${this.scope()}`);
    return data.items ?? [];
  }

  async getAgent(agentId: string): Promise<AsAgent | null> {
    const data = await this.api<{ agent?: AsAgent }>(
      `/api/v1/agents/${encodeURIComponent(agentId)}?${this.scope()}`,
    );
    return data.agent ?? null;
  }

  async createAgent(input: {
    agentKey: string;
    displayName: string;
    description?: string;
  }): Promise<AsAgent> {
    const data = await this.api<{ agent?: AsAgent }>("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        tenant: this.opts.tenant,
        namespace: this.opts.namespace,
        agentKey: input.agentKey,
        displayName: input.displayName,
        ...(input.description ? { description: input.description } : {}),
      }),
    });
    if (!data.agent?.id)
      throw new AgentScopeError(500, JSON.stringify(data), "AgentScope 建档无返回 id");
    return data.agent;
  }

  // ───── teams（TEAM-001 浅映射；契约 2026-10-21 实测） ─────

  async listTeams(): Promise<AsTeam[]> {
    const data = await this.api<{ items?: AsTeam[] }>(`/api/v1/teams?${this.scope()}`);
    return data.items ?? [];
  }

  async createTeam(input: { name: string; leaderAgentId: string }): Promise<AsTeam> {
    const data = await this.api<{ team?: AsTeam }>("/api/v1/teams", {
      method: "POST",
      body: JSON.stringify({
        tenant: this.opts.tenant,
        namespace: this.opts.namespace,
        name: input.name,
        leaderAgentId: input.leaderAgentId,
      }),
    });
    if (!data.team?.id) {
      throw new AgentScopeError(500, JSON.stringify(data), "AgentScope 建队无返回 id");
    }
    return data.team;
  }

  async updateTeam(
    teamId: string,
    input: { name: string; leaderAgentId: string },
  ): Promise<AsTeam> {
    // 上游 PATCH 实测要求 name+leaderAgentId 两者必填（缺一 400）
    const data = await this.api<{ team?: AsTeam }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}?${this.scope()}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    if (!data.team?.id) {
      throw new AgentScopeError(500, JSON.stringify(data), "AgentScope 更新团队无返回");
    }
    return data.team;
  }

  // ───── agent-tasks（只读浅映射） ─────

  async listAgentTasks(): Promise<AsAgentTask[]> {
    const data = await this.api<{ items?: unknown[] }>(`/api/v1/agent-tasks?${this.scope()}`);
    return (data.items ?? []).map(normalizeTask).filter((t): t is AsAgentTask => t !== null);
  }

  // ───── chats / turns ─────

  async createChat(agentId: string, message?: string): Promise<ChatHandle> {
    const data = await this.api<Record<string, unknown>>("/api/v1/chats", {
      method: "POST",
      body: JSON.stringify({
        tenant: this.opts.tenant,
        namespace: this.opts.namespace,
        agentId,
        ...(message ? { message } : {}),
      }),
    });
    return chatHandleOf(data);
  }

  async sendTurn(chatId: string, message: string): Promise<ChatHandle> {
    const data = await this.api<Record<string, unknown>>(
      `/api/v1/chats/${encodeURIComponent(chatId)}/turns?${this.scope()}`,
      { method: "POST", body: JSON.stringify({ message }) },
    );
    return chatHandleOf(data);
  }

  // ───── events ─────

  /** 回放：GET /api/v1/sessions/{sessionId}/events?chatId=… */
  async fetchEvents(sessionId: string, chatId: string): Promise<AsRawEvent[]> {
    const data = await this.api<{ events?: AsRawEvent[] }>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/events` +
        `?chatId=${encodeURIComponent(chatId)}&${this.scope()}`,
    );
    return data.events ?? [];
  }

  /**
   * 实时：SSE 帧消费（上游 eventStreamUrl，需 Authorization 头，只能在服务端订阅）。
   * 返回的 promise 在上游流关闭/出错时 settle；onEvent 收到的是原始 JSON 帧（信封同 replay）。
   */
  async streamEvents(
    url: string,
    onEvent: (raw: AsRawEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = await this.getToken();
    const full = url.startsWith("http") ? url : `${this.opts.baseUrl}${url}`;
    const res = await fetch(full, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new AgentScopeError(res.status, text, "AgentScope 事件流订阅失败");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 帧以空行分隔；仅处理 data: 行（事件名/注释忽略）
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        if (dataLines.length === 0) continue;
        try {
          onEvent(JSON.parse(dataLines.join("\n")) as AsRawEvent);
        } catch {
          // 非 JSON 帧（心跳等）忽略
        }
      }
    }
  }

  // ───── 其它 ─────

  /** 中断运行（官方文档形态 /sessions/{id}/interrupt；实测未覆盖，失败由调用方降级处理） */
  async interrupt(runtimeSessionId: string): Promise<boolean> {
    try {
      await this.api(
        `/api/v1/sessions/${encodeURIComponent(runtimeSessionId)}/interrupt?${this.scope()}`,
        { method: "POST" },
      );
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    try {
      const token = await this.getToken();
      const res = await this.fetchRaw(`/api/v1/me/scope`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? { ok: true } : { ok: false, detail: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
}

/** chat 创建 / turn 响应 → ChatHandle（两处字段同构，防御式提取） */
function chatHandleOf(data: Record<string, unknown>): ChatHandle {
  const chat = (data.chat ?? data) as Record<string, unknown>;
  const chatId = str(chat.id) ?? str(data.chatId);
  const sessionId = str(chat.sessionId) ?? str(data.sessionId);
  const runtimeSessionId = str(chat.runtimeSessionId) ?? str(data.runtimeSessionId);
  if (!chatId || !sessionId || !runtimeSessionId) {
    throw new AgentScopeError(
      500,
      JSON.stringify(data).slice(0, 500),
      "AgentScope chat 响应缺少关键字段",
    );
  }
  return {
    chatId,
    sessionId,
    runtimeSessionId,
    eventStreamUrl: str(data.eventStreamUrl) ?? undefined,
    eventsUrl: str(data.eventsUrl) ?? undefined,
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * agent-tasks 条目归一化（R-TASK-SHAPE：上游形状未冻结，按候选键名防御式提取；
 * 无 id 的条目整体丢弃，其余字段缺失置 null——视图层按空值降级展示）。
 */
function normalizeTask(raw: unknown): AsAgentTask | null {
  if (typeof raw !== "object" || raw === null) return null;
  const t = raw as Record<string, unknown>;
  const id = str(t.id) ?? str(t.taskId);
  if (!id) return null;
  return {
    id,
    title: str(t.title) ?? str(t.name) ?? str(t.summary),
    status: str(t.status) ?? str(t.state),
    assignee: str(t.assignee) ?? str(t.assigneeAgentId) ?? str(t.agentId),
    updatedAt: str(t.updatedAt) ?? str(t.lastModifiedAt) ?? str(t.createdAt),
  };
}

/** 解析 JWT exp（ms）；解析失败返回 null（调用方按 1 小时兜底） */
function jwtExpMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}
