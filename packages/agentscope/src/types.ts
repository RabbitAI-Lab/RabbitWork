/** AgentScope 资源类型与平台归一化事件（契约按 2026-10-17 实测冻结，见仓库蓝图 §2.2）。 */
import type { ChatEvent } from "@rabbit/shared";

export type { ChatEvent };

export type ProviderMode = "real" | "mock";

export interface AgentScopeOptions {
  mode: ProviderMode;
  baseUrl: string;
  username: string;
  password: string;
  tenant: string;
  namespace: string;
  fallbackAgentId?: string;
  timeoutMs: number;
}

// ───── 上游资源形态（实测） ─────

export interface AsAgent {
  id: string;
  tenant?: string;
  namespace?: string;
  agentKey?: string;
  displayName?: string;
  description?: string;
  status?: string; // provisioning | active | …
  version?: number;
}

/** POST /chats 与 POST /chats/{id}/turns 的合并结果（两处字段同一形态，防御式可选） */
export interface ChatHandle {
  chatId: string;
  sessionId: string; // 平台会话 uuid
  runtimeSessionId: string; // sess_* 运行时会话
  eventStreamUrl?: string;
  eventsUrl?: string;
}

// ───── teams 浅映射（TEAM-001；契约 2026-10-21 实测冻结） ─────

/** GET/POST /api/v1/teams 的 team 形态（实测：policy 可默认 {}，version 随 PATCH 自增） */
export interface AsTeam {
  id: string;
  tenant?: string;
  namespace?: string;
  name: string;
  status?: string; // active | …（实测仅见 active）
  leaderAgentId: string;
  policy?: {
    maxActiveTasks?: number;
    maxHops?: number;
    maxChildDepth?: number;
    maxChildIssues?: number;
    maxFanout?: number;
  };
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * agent-tasks 归一化条目（TEAM-001 §4.1 R-TASK-SHAPE：实例暂无任务数据，上游原始形状
 * 未冻结——此处已是平台归一化形态，字段全可选防御，映射规则见 client.normalizeTasks）。
 */
export interface AsAgentTask {
  id: string;
  title: string | null;
  status: string | null;
  assignee: string | null;
  updatedAt: string | null;
}


// ───── 事件（上游信封 → 平台归一化） ─────

/** 上游事件信封（replay 数组元素 / SSE data 帧同构；防御式全可选） */
export interface AsRawEvent {
  id?: number;
  sessionFk?: string;
  seq?: number;
  eventType?: string;
  frameworkMeta?: {
    turnId?: string;
    message_id?: string;
    public_event?: {
      type?: string;
      payload?: {
        run_id?: string;
        turn_id?: string;
        item_id?: string;
        position?: number;
        message_id?: string;
        content?: Array<{ text?: string; type?: string }>;
        item?: {
          id?: string;
          role?: string;
          type?: string;
          status?: string;
          message_id?: string;
          content?: Array<{ text?: string; type?: string }>;
        };
        final_output?: boolean;
        model?: string;
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          time?: number;
        };
        status?: string;
        reason?: string;
      };
    } | null;
  } | null;
  /** SSE 直发帧可能没有 frameworkMeta 包裹 */
  type?: string;
  payload?: Record<string, unknown>;
}

/** 归一化事件 = 平台 ChatEvent + 平台侧持久化所需的元数据 */
export interface EventMeta {
  runId?: string;
  turnId?: string;
  itemId?: string;
  seq?: number;
}

export type NormalizedEvent = ChatEvent & { _meta?: EventMeta };

/** 归一化后的运行汇总（run_record 落库用） */
export interface RunSummary {
  status: "STREAMING" | "SUCCEEDED" | "FAILED" | "INTERRUPTED";
  finalText?: string;
  asMsgId?: string;
  asRunId?: string;
  asTurnId?: string;
  model?: string;
  tokenIn?: number;
  tokenOut?: number;
  totalTokens?: number;
  error?: string;
}
