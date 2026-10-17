/** staff/chat/auth 域 API（前端唯一接口层，门禁 4）。 */
import { del, get, patch, post, put } from "./client";
import type {
  ConversationDto,
  LoginInput,
  MeDto,
  MessageDto,
  MessageSendInput,
  StaffCreateInput,
  StaffDto,
  StaffUpdateInput,
  TeamCreateInput,
  TeamDetailDto,
  TeamDto,
  TeamMemberAddInput,
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
    get<PageResult<StaffDto>>(`/api/v1/staffs?page=${params.page ?? 1}&pageSize=${params.pageSize ?? 50}`),
  create: (input: StaffCreateInput) => post<StaffDto>("/api/v1/staffs", input),
  update: (id: string, input: StaffUpdateInput) => patch<StaffDto>(`/api/v1/staffs/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/staffs/${id}`),
  publish: (
    id: string,
  ) =>
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
  interrupt: (id: string) => post<{ ok: boolean; upstream: boolean }>(`/api/v1/conversations/${id}/interrupt`),
};

/** SSE 事件流地址（EventSource 用；cookie 同源鉴权）。 */
export function conversationEventsUrl(id: string): string {
  return `/api/v1/conversations/${id}/events`;
}

// ───── teams（我的团队） ─────

export const teamApi = {
  list: (params: { page?: number; pageSize?: number } = {}) =>
    get<PageResult<TeamDto>>(`/api/v1/teams?page=${params.page ?? 1}&pageSize=${params.pageSize ?? 50}`),
  detail: (id: string) => get<TeamDetailDto>(`/api/v1/teams/${id}`),
  create: (input: TeamCreateInput) => post<TeamDto>("/api/v1/teams", input),
  update: (id: string, input: TeamUpdateInput) => patch<TeamDetailDto>(`/api/v1/teams/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/teams/${id}`),
  addMember: (id: string, input: TeamMemberAddInput) => post<TeamDetailDto>(`/api/v1/teams/${id}/members`, input),
  removeMember: (id: string, employeeId: string) =>
    del<TeamDetailDto>(`/api/v1/teams/${id}/members?employeeId=${encodeURIComponent(employeeId)}`),
};
