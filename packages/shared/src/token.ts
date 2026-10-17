/** 会话令牌：HMAC-SHA256 签名（Web Crypto 实现，Node 与 Edge middleware 通用）。 */

export const SESSION_COOKIE = "rw_session";
export const SESSION_TTL_SEC = 14 * 24 * 3600; // 14 天

export interface SessionClaims {
  uid: string;
  role: "ADMIN" | "MEMBER";
  name: string;
  exp: number; // 秒级
}

const encoder = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(text: string): string {
  const bytes = encoder.encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): string {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function signSession(claims: Omit<SessionClaims, "exp">, secret: string): Promise<string> {
  const payload: SessionClaims = { ...claims, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionClaims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, body);
  if (expected !== sig) return null;
  try {
    const claims = JSON.parse(b64urlDecode(body)) as SessionClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
