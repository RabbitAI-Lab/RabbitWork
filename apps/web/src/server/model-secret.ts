/** 模型凭据加密（MODEL-001 §2.4：独立 MODEL_APIKEY_SECRET,与工具头密钥职责分离）。 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SECRET = process.env.MODEL_APIKEY_SECRET ?? "rabbitwork-model-key-dev-secret";
const KEY = scryptSync(SECRET, "rw-model-apikey-v1", 32);

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

export function decryptText(payload: string): string | null {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(parts[1]!, "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2]!, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3]!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
