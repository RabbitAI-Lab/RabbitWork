/**
 * 权限点单一来源（docs/architecture/rbac-permission-model.md §3）。
 * 格式：`{SCOPE}_{RESOURCE}:{ACTION}`，SCOPE ∈ SYSTEM/ORG/PROJECT，ACTION 为基线四动作 + 域专用动作。
 * 新增权限点规则：随首份消费它的功能规格评审入库，禁止规格外私用。
 */

export type PermissionAction =
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "PUBLISH" // 域专用：数字员工发布/下线（STAFF-001）
  | "SEND"; // 域专用：会话发消息/打断（CHAT-001）

const PERMISSION_RE =
  /^(SYSTEM|ORG|PROJECT)_[A-Z][A-Z_]*:(READ|CREATE|UPDATE|DELETE|PUBLISH|SEND)$/;

/** S0 基线 + S1 staff/chat 域权限点；后续域随规格登记。 */
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
  // staff 域（数字员工）
  "ORG_STAFF:READ",
  "ORG_STAFF:CREATE",
  "ORG_STAFF:UPDATE",
  "ORG_STAFF:DELETE",
  "ORG_STAFF:PUBLISH",
  // chat 域（会话工作台）
  "ORG_CHAT:READ",
  "ORG_CHAT:CREATE",
  "ORG_CHAT:SEND",
  // team 域（我的团队）
  "ORG_TEAM:READ",
  "ORG_TEAM:CREATE",
  "ORG_TEAM:UPDATE",
  "ORG_TEAM:DELETE",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** 校验权限点字面量合法（登记与声明处公用，写错即编译/测试期暴露）。 */
export function isValidPermission(p: string): p is Permission {
  return (PERMISSIONS as readonly string[]).includes(p) && PERMISSION_RE.test(p);
}
