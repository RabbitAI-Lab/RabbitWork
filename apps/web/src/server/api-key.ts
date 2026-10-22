/** API Key 生成与校验纯函数（OBS-003 §2;rw_live_ 前缀 + pepper sha256 摘要）。 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const APIKEY_PREFIX = "rw_live_";
/** 展示位长度（rw_live_ + 7 位） */
const PREFIX_DISPLAY_LEN = APIKEY_PREFIX.length + 7;

const PEPPER = process.env.APIKEY_PEPPER ?? "rabbitwork-apikey-pepper-dev";

export function pepperHashOf(key: string): string {
  return createHash("sha256")
    .update(PEPPER + key)
    .digest("hex");
}

export interface GeneratedKey {
  plaintext: string;
  keyPrefix: string;
  pepperHash: string;
}

export function generateApiKey(): GeneratedKey {
  const plaintext = APIKEY_PREFIX + randomBytes(24).toString("base64url");
  return {
    plaintext,
    keyPrefix: plaintext.slice(0, PREFIX_DISPLAY_LEN),
    pepperHash: pepperHashOf(plaintext),
  };
}

/** 常时比较摘要（防时序侧信道） */
export function hashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Bearer 解析（Authorization: Bearer rw_live_xxx） */
export function parseBearer(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.startsWith(APIKEY_PREFIX) && token.length > APIKEY_PREFIX.length ? token : null;
}
