/** 认证：scrypt 口令 + HMAC 会话 cookie（SYS-001 最小实现）。 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  DomainError,
  ErrCode,
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionClaims,
} from "@rabbit/shared";

const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";

export function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? "change-me-to-a-random-32-chars-secret!";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$16384$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const salt = parts[2]!;
  const expected = Buffer.from(parts[3]!, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function issueSessionCookie(claims: Omit<SessionClaims, "exp">): Promise<void> {
  const token = await signSession(claims, sessionSecret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionClaims | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, sessionSecret());
}

export async function requireUser(): Promise<SessionClaims> {
  const user = await getSessionUser();
  if (!user) throw new DomainError(ErrCode.UNAUTHENTICATED, "未登录或会话已过期");
  return user;
}

/** 权限点校验（rbac §4 最小实现：ADMIN 全量，MEMBER 只读+对话） */
export async function requirePermission(permission: string): Promise<SessionClaims> {
  const user = await requireUser();
  const allowed =
    user.role === "ADMIN" ||
    (user.role === "MEMBER" &&
      (permission.endsWith(":READ") ||
        permission === "ORG_CHAT:CREATE" ||
        permission === "ORG_CHAT:SEND"));
  if (!allowed) throw new DomainError(ErrCode.FORBIDDEN, `无权限点 ${permission}`);
  return user;
}

export function defaultOrgId(): string {
  return process.env.DEFAULT_ORG_ID ?? DEFAULT_ORG_ID;
}
