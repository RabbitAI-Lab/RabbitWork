/** staff/chat/auth 域 API（前端唯一接口层，门禁 4）。 */
import { del, get, patch, post, put } from "./client";
import type {
  ConversationDto,
  FeedbackDto,
  FeedbackInput,
  LoginInput,
  MeDto,
  MessageDto,
  MessageSendInput,
  ApiKeyCreatedDto,
  ApiKeyDto,
  AuditLogDto,
  RunDto,
  RunStatsDto,
  UsageSummaryDto,
  StaffCreateInput,
  StaffDto,
  StaffUpdateInput,
  TeamCreateInput,
  TeamDetailDto,
  TeamDto,
  TeamMemberAddInput,
  TeamTasksResultDto,
  TeamUpdateInput,
} from "@rabbit/shared";

// ───── auth ─────

export const authApi = {
  login: (input: LoginInput) => post<MeDto & { id: string }>("/api/v1/auth/login", input),
  logout: () => post<{ ok: boolean }>("/api/v1/auth/logout"),
  me: () => get<MeDto>("/api/v1/auth/me"),
};

// ───── staffs ─────

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const staffApi = {
  list: (params: { page?: number; pageSize?: number } = {}) =>
    get<PageResult<StaffDto>>(
      `/api/v1/staffs?page=${params.page ?? 1}&pageSize=${params.pageSize ?? 50}`,
    ),
  create: (input: StaffCreateInput) => post<StaffDto>("/api/v1/staffs", input),
  update: (id: string, input: StaffUpdateInput) => patch<StaffDto>(`/api/v1/staffs/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/staffs/${id}`),
  publish: (id: string) =>
    post<StaffDto & { agentStatus: string; usedFallback: boolean; version: number }>(
      `/api/v1/staffs/${id}/publish`,
    ),
  assignDesk: (id: string, input: { floor: number; seat: number }) =>
    put<StaffDto>(`/api/v1/staffs/${id}/desk`, input),
  stats: (id: string) =>
    get<{
      conversationCount: number;
      runTotal: number;
      runSucceeded: number;
      runFailed: number;
      runInterrupted: number;
      tokenIn: number;
      tokenOut: number;
      lastActiveAt: string | null;
    }>(`/api/v1/staffs/${id}/stats`),
};

// ───── conversations / chat ─────

export interface ConversationDetail {
  conversation: ConversationDto;
  employee: { id: string; name: string; title: string; avatarUrl: string | null };
  messages: MessageDto[];
}

export const chatApi = {
  createConversation: (staffId: string, title?: string) =>
    post<ConversationDto>(`/api/v1/staffs/${staffId}/conversations`, title ? { title } : {}),
  listConversations: (params: { employeeId?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.employeeId) q.set("employeeId", params.employeeId);
    q.set("page", String(params.page ?? 1));
    return get<PageResult<ConversationDto>>(`/api/v1/conversations?${q.toString()}`);
  },
  detail: (id: string) => get<ConversationDetail>(`/api/v1/conversations/${id}`),
  send: (id: string, input: MessageSendInput) =>
    post<{ runId: string; userMessage: MessageDto }>(`/api/v1/conversations/${id}/messages`, input),
  handoff: (id: string, input: { reason: string }) =>
    post<import("@rabbit/shared").HandoffDto>(`/api/v1/conversations/${id}/handoff`, input),
  interrupt: (id: string) =>
    post<{ ok: boolean; upstream: boolean }>(`/api/v1/conversations/${id}/interrupt`),
};

/** SSE 事件流地址（EventSource 用；cookie 同源鉴权）。 */
export function conversationEventsUrl(id: string): string {
  return `/api/v1/conversations/${id}/events`;
}

// ───── teams（我的团队） ─────

export const teamApi = {
  list: (params: { page?: number; pageSize?: number } = {}) =>
    get<PageResult<TeamDto>>(
      `/api/v1/teams?page=${params.page ?? 1}&pageSize=${params.pageSize ?? 50}`,
    ),
  detail: (id: string) => get<TeamDetailDto>(`/api/v1/teams/${id}`),
  create: (input: TeamCreateInput) => post<TeamDto>("/api/v1/teams", input),
  update: (id: string, input: TeamUpdateInput) =>
    patch<TeamDetailDto>(`/api/v1/teams/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/teams/${id}`),
  addMember: (id: string, input: TeamMemberAddInput) =>
    post<TeamDetailDto>(`/api/v1/teams/${id}/members`, input),
  removeMember: (id: string, employeeId: string) =>
    del<TeamDetailDto>(`/api/v1/teams/${id}/members?employeeId=${encodeURIComponent(employeeId)}`),
  /** 手动同步/重试运行面（TEAM-001） */
  sync: (id: string) => post<TeamDetailDto>(`/api/v1/teams/${id}/sync`, {}),
  /** 任务只读视图（agent-tasks 浅映射，TEAM-001） */
  tasks: (id: string) => get<TeamTasksResultDto>(`/api/v1/teams/${id}/tasks`),
};

// ───── obs（OBS-001：反馈 + 运行留痕 + 看板） ─────

export interface RunsResult {
  items: RunDto[];
  counts: Record<string, number>;
  total: number;
  page: number;
  pageSize: number;
}

export const obsApi = {
  /** 消息反馈 upsert（rating=null 撤销） */
  feedback: (mirrorId: string, input: FeedbackInput) =>
    put<FeedbackDto>(`/api/v1/messages/${mirrorId}/feedback`, input),
  runs: (params: { status?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    q.set("page", String(params.page ?? 1));
    q.set("pageSize", String(params.pageSize ?? 20));
    return get<RunsResult>(`/api/v1/runs?${q.toString()}`);
  },
  runStats: () => get<RunStatsDto>("/api/v1/runs/stats"),
  usage: (days = 14) => get<UsageSummaryDto>(`/api/v1/usage/daily?days=${days}`),
};

// ───── audit（OBS-002,仅 ADMIN） ─────

export const auditApi = {
  logs: (page = 1, pageSize = 20) =>
    get<PageResult<AuditLogDto>>(`/api/v1/audit-logs?page=${page}&pageSize=${pageSize}`),
};

// ───── api keys（OBS-003） ─────

export const apiKeyApi = {
  list: () => get<PageResult<ApiKeyDto>>("/api/v1/api-keys"),
  create: (input: { name: string; expiresInDays?: number }) =>
    post<ApiKeyCreatedDto>("/api/v1/api-keys", input),
  revoke: (id: string) => del<{ ok: boolean }>(`/api/v1/api-keys/${id}`),
};

// ───── cron（CRON-001 定时任务） ─────

export interface CronTaskDto {
  id: string;
  name: string;
  cron: string;
  employeeId: string;
  inputTemplate: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

export interface CronRunDto {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export const cronApi = {
  list: () => get<{ items: CronTaskDto[]; total: number }>("/api/v1/scheduled-tasks"),
  create: (input: { name: string; cron: string; employeeId: string; inputTemplate: string }) =>
    post<CronTaskDto>("/api/v1/scheduled-tasks", input),
  update: (
    id: string,
    input: Partial<{
      name: string;
      cron: string;
      employeeId: string;
      inputTemplate: string;
      enabled: boolean;
    }>,
  ) => patch<CronTaskDto>(`/api/v1/scheduled-tasks/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/scheduled-tasks/${id}`),
  runNow: (id: string) =>
    post<{ runId: string; status: string; error?: string }>(
      `/api/v1/scheduled-tasks/${id}/run`,
      {},
    ),
  runs: (id: string) =>
    get<{ items: CronRunDto[]; total: number }>(`/api/v1/scheduled-tasks/${id}/runs`),
};

// ───── HITL 人工接管（CHAT-003） ─────

export interface HandoffRow {
  id: string;
  conversationId: string;
  conversationTitle: string;
  status: "PENDING" | "HANDLING" | "RESOLVED";
  initiatedBy: string | null;
  handledBy: string | null;
  reason: string | null;
  conclusion: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export const handoffApi = {
  list: (params: { status?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    q.set("page", String(params.page ?? 1));
    return get<{ items: HandoffRow[]; total: number }>(`/api/v1/handoffs?${q.toString()}`);
  },
  claim: (id: string) => post<{ id: string; status: string }>(`/api/v1/handoffs/${id}/claim`, {}),
  resolve: (id: string, conclusion?: string) =>
    post<{ id: string; status: string }>(
      `/api/v1/handoffs/${id}/resolve`,
      conclusion ? { conclusion } : {},
    ),
};
