/** 工具敏感头加密（TOOL-001 §2.1；rules/security §4.2：AES-256-GCM + 主密钥环境变量）。 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SECRET = process.env.TOOL_HEADER_SECRET ?? "rabbitwork-tool-headers-dev-secret";
const KEY = scryptSync(SECRET, "rw-tool-headers-v1", 32);

/** 加密 JSON 对象 → "v1.<iv>.<tag>.<ct>"（全部 base64url） */
export function encryptJson(obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(
    ".",
  );
}

/** 解密；格式不符/密钥不符返回 null（密钥轮换场景由调用方按空值降级） */
export function decryptJson<T>(payload: string): T | null {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(parts[1]!, "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2]!, "base64url"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(parts[3]!, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}

// 掩码占位契约见 packages/shared/tool.ts MASKED_HEADER_PLACEHOLDER（单一来源）
export { MASKED_HEADER_PLACEHOLDER } from "@rabbit/shared";
