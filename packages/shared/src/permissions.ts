/**
 * 权限点单一来源（docs/architecture/rbac-permission-model.md §3）。
 * 格式：`{SCOPE}_{RESOURCE}:{ACTION}`，SCOPE ∈ SYSTEM/ORG/PROJECT，ACTION ∈ READ/CREATE/UPDATE/DELETE（+域专用动作）。
 * 新增权限点规则：随首份消费它的功能规格评审入库，禁止规格外私用。
 */

export type PermissionAction = "READ" | "CREATE" | "UPDATE" | "DELETE";

const PERMISSION_RE = /^(SYSTEM|ORG|PROJECT)_[A-Z][A-Z_]*:(READ|CREATE|UPDATE|DELETE)$/;

/** S0 基线权限点（系统域最小集）；业务权限点随域规格登记。 */
export const PERMISSIONS = [
  "SYSTEM_USER:READ",
  "SYSTEM_USER:CREATE",
  "SYSTEM_USER:UPDATE",
  "SYSTEM_USER:DELETE",
  "SYSTEM_PARAM:READ",
  "SYSTEM_PARAM:UPDATE",
  "ORG_PROJECT:READ",
  "ORG_PROJECT:CREATE",
  "ORG_PROJECT:UPDATE",
  "ORG_PROJECT:DELETE",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** 校验权限点字面量合法（登记与声明处公用，写错即编译/测试期暴露）。 */
export function isValidPermission(p: string): p is Permission {
  return (PERMISSIONS as readonly string[]).includes(p) && PERMISSION_RE.test(p);
}
