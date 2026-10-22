/** 渠道 token（CHNL-001 §2.1:rw_ch_ 前缀 + pepper sha256 摘要,同 APIKEY 模式独立前缀）。 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { CHANNEL_TOKEN_PREFIX } from "@rabbit/shared";

const PEPPER =
  process.env.CHANNEL_TOKEN_PEPPER ?? process.env.APIKEY_PEPPER ?? "rabbitwork-channel-dev";

export function channelTokenHashOf(token: string): string {
  return createHash("sha256")
    .update(PEPPER + token)
    .digest("hex");
}

export function generateChannelToken(): { plaintext: string; tokenHash: string } {
  const plaintext = CHANNEL_TOKEN_PREFIX + randomBytes(24).toString("base64url");
  return { plaintext, tokenHash: channelTokenHashOf(plaintext) };
}

export function channelHashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
