# 用户与组织管理

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | SYS-002 |
| 所属迭代   | sprint-sys-2（F9 尾巴收口——蓝图 F9 模块描述含、S1 未覆盖） |
| 优先级     | P1 |
| 所属模块   | sys |
| 文档状态   | Prototyped |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | User/OrgMember 表（既有） · SYSTEM_USER:* 权限点（既有登记） · SYS-001 登录 |
| 上游依据   | 蓝图 §4 F9「登录、用户/组织/权限」;马拉松收官盘点确认缺口（2026-10-23） |
| **高保真确认** | **批量待走查**：原型 `docs/design/SYS-002-user-management/` |
| 工作量估算 | 后端 1 人日 / 前端 1 人日 / 联调 0.5 人日 |

## 1. 概述

用户管理首期：`/users` 管理页——创建用户（email/姓名/角色 ADMIN|MEMBER/初始密码）、角色切换、禁用/启用、重置密码（一次性明文）、软删。组织模型默认单组织（默认组织 OWNER=admin 既有）,多组织界面后续。

**403 收口**：本功能落地后可创建 MEMBER 账号——补上全马拉松 jmx 403 场景的根因缺口（各规格豁免登记解除路径）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 用户 CRUD（创建/角色/禁用/软删）+ 重置密码（一次性明文） | ✅ | — |
| 列表（角色 pill/状态/最近登录未实现——created 代替） | ✅ | lastLoginAt 列后续 |
| MEMBER 视角：只读列表可见;写操作 403 | ✅（e2e 双视角） | — |
| 多组织管理界面 | ❌ | 多租户纵深时 |
| 组织信息编辑（名称等） | ❌ | 后续（低频） |
| 邮箱验证/找回密码流程 | ❌ | 部署形态定后 |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| SYS-002-C1 | /users 列表（email/姓名/角色 pill/状态/创建时间） |
| SYS-002-C2 | 创建用户（email 唯一/角色/初始密码或自动生成一次性展示） |
| SYS-002-C3 | 角色切换（ADMIN↔MEMBER;不能改自己——防锁死） |
| SYS-002-C4 | 禁用/启用（禁用即无法登录——login 已校验 status） |
| SYS-002-C5 | 重置密码（一次性明文返回,不改哈希策略 scrypt） |
| SYS-002-C6 | MEMBER 访问写操作 403;未登录 401 |

## 2. 业务逻辑

1. **创建**：email 唯一（软删占用同拒? ——允许复用已软删邮箱,唯一索引含软删行会撞——用 P2002 转「邮箱已被使用」;实际唯一索引在 email 列,软删行仍占——登记:软删用户邮箱不可复用,提示原文透出）;初始密码缺省自动生成（12 位）一次性返回;scrypt 哈希（复用 seed 的 hashPassword 同参——**注意**:seed 的 scrypt 参数与 login 的 verifyPassword 必须一致——login 用 verifyPassword(password, hash),来自 auth 模块,查实现复用）。
2. **角色切换**：不能修改自己的角色（防止唯一 ADMIN 自降锁死）;审计 user.role_change。
3. **禁用**：status=DISABLED——login 已有 `user.status !== "ACTIVE"` 拒绝;禁用不清会话（14 天 TTL 自然过期,登记）。**不自禁**。
7. **软删**：deletedAt;已删用户登录拒绝（login 已查 deletedAt）。

## 3. UI/UX 设计

原型 `docs/design/SYS-002-user-management/`。/users 表格（email mono/姓名/角色 Tag/状态 pill/操作:改角色·重置密码·禁用·删除）+ 创建弹窗 + 重置密码一次性明文弹窗（同 APIKEY 模式）。菜单「用户管理」（TeamOutlined? 用 UserOutlined）放管理组（ ADMIN 可见性——首期全员可见,MEMBER 点写操作 403 透出）。

## 4. 技术架构

- shared `user.ts`：userCreateInput（email zod email/role 枚举/password 可选 8-64）/userUpdateInput（role?/status?）/passwordResetDto（一次性明文）/userDto（不含 hash）;
- 密码哈希：复用 login 侧同源实现（apps/web/src/server/auth 或独立 password.ts——scrypt 参数与 verifyPassword 完全一致,单测 round-trip）;
- API：`GET/POST /api/v1/users`、`PATCH /api/v1/users/{id}`（role/status）、`POST /api/v1/users/{id}/reset-password`、`DELETE /{id}`;权限 SYSTEM_USER:*（MEMBER 对 :READ 白名单放行=列表可见,写 403 ✓ 符合能力表）;
- 审计：user.create/role_change/disable/reset_password/soft_delete;
- 前端：/users 页 + 菜单;api-client userApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| SYS-002-01 | ADMIN 创建 MEMBER（自动密码）→ 一次性明文展示 → MEMBER 登录成功 | e2e |
| SYS-002-02 | MEMBER 登录后创建团队 → 403（**全马拉松首次 403 e2e**——豁免收口） | e2e |
| SYS-002-03 | 改自己角色 → 422;禁用 MEMBER → 其登录 401 | e2e |
| SYS-002-04 | 重置密码 → 旧密码失效新密码可登录 | e2e |
| SYS-002-05 | 未认证 401/重复邮箱 422/邮箱非法 422 | jmx |
| 单测 | zod round-trip + 密码 hash/verify round-trip | — |

## 6. 基线深度对标

蓝图 F9 + rbac-permission-model（三级模型文档）——用户管理为权限模型运营面;多组织后续。

## 7. 里程碑与验收

交付清单：shared zod+密码单测 → API+jmx → /users 页+e2e（含 MEMBER 403 收口用例）→ 文档流转+**补一条 TEAM-001 jmx 403 场景**（MEMBER 账号 setup）。DoD：三类绿 + 远端 CI 绿 + push。
