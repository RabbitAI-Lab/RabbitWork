/** 资源域（技能/知识库/员工绑定）API（RESOURCE-001）。 */
import { del, get, patch, post, put } from "./client";
import type {
  McpCreateInput,
  McpDto,
  McpTestResultDto,
  McpUpdateInput,
  ToolCreateInput,
  ToolDto,
  ToolTestRunInput,
  ToolTestRunResultDto,
  ToolUpdateInput,
  KbCreateInput,
  KbDocumentDto,
  KbDto,
  KbRetrieveInput,
  KbRetrieveResultDto,
  KbUpdateInput,
  SkillCreateInput,
  SkillDto,
  SkillUpdateInput,
  StaffResourcesDto,
} from "@rabbit/shared";
import type { PageResult } from "./staff";

export const skillApi = {
  list: () => get<PageResult<SkillDto>>("/api/v1/skills"),
  create: (input: SkillCreateInput) => post<SkillDto>("/api/v1/skills", input),
  update: (id: string, input: SkillUpdateInput) => patch<SkillDto>(`/api/v1/skills/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/skills/${id}`),
};

export const kbApi = {
  list: () => get<PageResult<KbDto>>("/api/v1/knowledge-bases"),
  create: (input: KbCreateInput) => post<KbDto>("/api/v1/knowledge-bases", input),
  update: (id: string, input: KbUpdateInput) =>
    patch<KbDto>(`/api/v1/knowledge-bases/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/knowledge-bases/${id}`),
  documents: (id: string) =>
    get<{ items: KbDocumentDto[]; total: number }>(`/api/v1/knowledge-bases/${id}/documents`),
  /** multipart 上传摄取（KNW-001 §2.1 同步切片） */
  upload: async (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const { request } = await import("./client");
    return request<KbDocumentDto>(`/api/v1/knowledge-bases/${id}/documents`, {
      method: "POST",
      body: fd,
    });
  },
  removeDocument: (id: string, docId: string) =>
    del<{ ok: boolean }>(`/api/v1/knowledge-bases/${id}/documents/${docId}`),
  retrieve: (id: string, input: KbRetrieveInput) =>
    post<KbRetrieveResultDto>(`/api/v1/knowledge-bases/${id}/retrieve`, input),
};

export const staffResourceApi = {
  get: (staffId: string) => get<StaffResourcesDto>(`/api/v1/staffs/${staffId}/resources`),
  put: (staffId: string, input: { skillIds: string[]; knowledgeBaseIds: string[] }) =>
    put<{ ok: boolean }>(`/api/v1/staffs/${staffId}/resources`, input),
};

// ───── tools（TOOL-001 HTTP 工具与试运行） ─────

export const toolApi = {
  list: () => get<{ items: ToolDto[]; total: number }>("/api/v1/tools"),
  create: (input: ToolCreateInput) => post<ToolDto>("/api/v1/tools", input),
  update: (id: string, input: ToolUpdateInput) => patch<ToolDto>(`/api/v1/tools/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/tools/${id}`),
  testRun: (id: string, input: ToolTestRunInput) =>
    post<ToolTestRunResultDto>(`/api/v1/tools/${id}/test-run`, input),
};

// ───── mcp（TOOL-002 MCP 服务器配置） ─────

export const mcpApi = {
  list: () => get<{ items: McpDto[]; total: number }>("/api/v1/mcp-servers"),
  create: (input: McpCreateInput) => post<McpDto>("/api/v1/mcp-servers", input),
  update: (id: string, input: McpUpdateInput) => patch<McpDto>(`/api/v1/mcp-servers/${id}`, input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/v1/mcp-servers/${id}`),
  test: (id: string) => post<McpTestResultDto>(`/api/v1/mcp-servers/${id}/test`, {}),
};
