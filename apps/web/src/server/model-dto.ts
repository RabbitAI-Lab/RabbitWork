/** model 域 DTO 映射（MODEL-001;apiKey 恒掩码）。 */
import { MASKED_APIKEY_PLACEHOLDER, type ModelDto } from "@rabbit/shared";

export function toModelDto(row: {
  id: string;
  name: string;
  protocol: string;
  baseUrl: string;
  modelId: string;
  status: string;
  isDefault: boolean;
  lastError: string | null;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ModelDto {
  return {
    id: row.id,
    name: row.name,
    protocol: row.protocol as ModelDto["protocol"],
    baseUrl: row.baseUrl,
    modelId: row.modelId,
    apiKey: MASKED_APIKEY_PLACEHOLDER,
    status: row.status as ModelDto["status"],
    isDefault: row.isDefault,
    lastError: row.lastError,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
