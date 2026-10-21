/** mcp 域 DTO 映射（TOOL-002;不占 route.ts 导出面——Next 类型约束）。 */
import type { McpDto } from "@rabbit/shared";

export function toMcpDto(row: {
  id: string;
  name: string;
  transport: string;
  endpoint: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): McpDto {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport as McpDto["transport"],
    endpoint: row.endpoint,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
