# 员工广场（画廊资源复用）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | STAFF-003 |
| 所属迭代   | sprint-staff-3（蓝图 S9+ 批次） |
| 优先级     | P2 |
| 所属模块   | staff |
| 文档状态   | Prototyped |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | visibility=GALLERY 列与枚举（既有） · STAFF-001 CRUD |
| 上游依据   | 蓝图 §6 S9+：员工广场（画廊资源复用/复制不动原件） |
| **高保真确认** | **批量待走查**：原型 `docs/design/STAFF-003-staff-gallery/` |
| 工作量估算 | 后端 0.5 人日 / 前端 1 人日 / 联调 0 |

## 1. 概述

`/gallery` 员工广场：展示全组织 visibility=GALLERY 且已发布的员工卡（头像/岗位/人设摘要/使用次数）,一键「复制到我的员工」——深拷贝为 PRIVATE 新员工（原件不动）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 广场列表（GALLERY+PUBLISHED 卡墙+搜索） | ✅ | — |
| 复制（深拷贝名称/岗位/人设/边界 → PRIVATE DRAFT） | ✅ | — |
| 使用次数统计 | ✅ | 复制时 copyCount+1（资源发起者列已有? ——digital_employees 无此列——用 AuditLog 聚合? 首期:复制源 id 存 AuditLog detail,广场卡显示「被复制 N 次」经 audit count——轻量口径登记） |
| 作者收益/署名体系 | ❌ | 远期 |
| 跨组织共享 | ❌ | 多租户纵深时 |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| STAFF-003-C1 | /gallery 卡墙（搜索/空态） |
| STAFF-003-C2 | 复制 → 我的新员工（DRAFT,名字加「-副本」,跳详情可编辑发布） |
| STAFF-003-C3 | 被复制次数展示（audit 聚合） |
| STAFF-003-C4 | 未登录 401/跳转 |

## 2. 业务逻辑

复制 = 新建 PRIVATE/DRAFT 员工（name=`${源.name}-副本`,title/personaPrompt/boundary 深拷贝;code 自动生成）+ audit `staff.copy`（detail.sourceId）——原件只读不动。被复制次数 = auditLogs count(action=staff.copy AND detail.sourceId=源id)——jsonb path 查询 Prisma 不支持索引,数据量小可全表过滤（登记 R-COPY-COUNT 性能口径）。

## 3. UI/UX 设计

原型 `docs/design/STAFF-003-staff-gallery/`。卡墙 3 列（头像/名/岗位/人设摘要 2 行/被复制数）;「复制」主按钮。菜单「广场」。

## 4. 技术架构

- API：`GET /api/v1/gallery`（GALLERY+PUBLISHED 列表+copyCounts）;`POST /api/v1/gallery/{id}/copy`;权限 ORG_STAFF:READ/CREATE;
- 前端：`/gallery` 页 + 菜单;api-client galleryApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| STAFF-003-01 | 发布 GALLERY 员工 → 广场可见 → 复制 → 新 DRAFT 私有员工存在,原样保留 | e2e |
| STAFF-003-02 | 被复制次数随复制递增 | e2e |
| STAFF-003-03 | 未认证 401 / 不存在 404 | jmx |

## 6. 基线深度对标

蓝图「画廊资源复用/复制不动原件」——全量对齐;署名收益远期。

## 7. 里程碑与验收

交付清单：API+jmx → /gallery 页+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
