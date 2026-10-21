/** tool 域 DTO/头拆分助手（TOOL-001 §2.1；路由共用,不占 route.ts 导出面）。 */
import { isSensitiveHeader, MASKED_HEADER_PLACEHOLDER, type ToolDto } from "@rabbit/shared";
import { decryptJson, encryptJson } from "@/server/secure-headers";

/** 头拆分：敏感→加密列,普通→headersJson */
export function splitHeaders(headers: Record<string, string>) {
  const plain: Record<string, string> = {};
  const secure: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    (isSensitiveHeader(k) ? secure : plain)[k] = v;
  }
  return { plain, secure };
}

export function encodeSecureHeaders(secure: Record<string, string>): string {
  return encryptJson(secure);
}

/** 敏感头只回显键名+固定掩码（键名自解密后的 payload 读取） */
export function toToolDto(row: {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string;
  headersJson: unknown;
  secureHeaders: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): ToolDto {
  const plain = (row.headersJson as Record<string, string> | null) ?? {};
  const headers: Record<string, string> = { ...plain };
  if (row.secureHeaders) {
    const secure = decryptJson<Record<string, string>>(row.secureHeaders);
    if (secure) for (const k of Object.keys(secure)) headers[k] = MASKED_HEADER_PLACEHOLDER;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    method: row.method as ToolDto["method"],
    url: row.url,
    headers,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
