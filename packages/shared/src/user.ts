/** user 域 zod（SYS-002 用户管理;F9 尾巴收口）。 */
import { z } from "zod";

export const USER_ROLES = ["ADMIN", "MEMBER"] as const;
export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;

export const userCreateInput = z.object({
  email: z.string().trim().toLowerCase().email().max(256),
  name: z.string().trim().min(1).max(128),
  role: z.enum(USER_ROLES).default("MEMBER"),
  /** 初始密码可选——缺省自动生成 12 位,一次性明文返回 */
  password: z.string().trim().min(8).max(64).optional(),
});
export type UserCreateInput = z.infer<typeof userCreateInput>;

export const userUpdateInput = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  name: z.string().trim().min(1).max(128).optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateInput>;

export const userDto = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userDto>;

/** 创建/重置密码响应：明文仅此一次 */
export const passwordRevealDto = z.object({ password: z.string() });
export type PasswordRevealDto = z.infer<typeof passwordRevealDto>;

/** 自动生成 12 位密码（首期字母数字,避免易混淆字符） */
export function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
