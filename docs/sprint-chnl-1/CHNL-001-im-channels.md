# 渠道接入（IM Webhook 骨架）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | CHNL-001 |
| 所属迭代   | sprint-chnl-1（蓝图 S9+ 压轴） |
| 优先级     | P1 |
| 所属模块   | chnl |
| 文档状态   | Implemented（2026-10-23；单测 113 / e2e 50 / jmx 13 计划全绿；走查待人工——蓝图功能清单收官） |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | conversations/messages 链路 · 员工发布 |
| 上游依据   | 蓝图 §4 F8/§6 S9+（评估 AgentScope channels 直用 vs 平台侧网关）;**上游 channels 端点 404（2026-10-23 实测）→ 平台侧网关骨架** |
| **高保真确认** | **批量待走查**：原型 `docs/design/CHNL-001-im-channels/` |
| 工作量估算 | 后端 1 人日 / 前端 0.5 人日 / 联调 0.5 人日 |

## 1. 概述

平台侧渠道网关骨架：渠道配置（飞书/钉钉/企微 webhook token）CRUD + **通用 webhook 接收端点**（`/api/open/v1/channels/{token}/messages`——外部 IM 机器人回调进来,按渠道绑定员工建/续会话并发消息）。出站回复（平台→IM）留 R-OUTBOUND（需各 IM 开放平台凭据,外部依赖最强——骨架只落会话,回复经 Web 查看）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 渠道 CRUD（platform 枚举/token 绑定员工/启用） | ✅ | — |
| 通用 webhook 接收（token 鉴权→消息落会话） | ✅ | — |
| IM 适配器解析（飞书事件/钉钉/企微各自的回调协议） | ✅（宽松归一:提取 text/user 字段,未识别原样入库 detail） | 各平台签名校验 R-SIGNATURE |
| 出站回复（平台→IM 推送） | ❌ | R-OUTBOUND（需 IM 开放平台凭据） |
| 平台签名验证（飞书 encrypt key 等） | ❌ | R-SIGNATURE |
| AgentScope channels 直用 | ❌ | 上游 404 实证 |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| CHNL-001-C1 | /channels 列表+新建/编辑/删除（platform pill/token mono/绑定员工/启用 Switch） |
| CHNL-001-C2 | webhook 接收：合法 token+text → 201+会话消息落库 |
| CHNL-001-C3 | 伪造/失效 token 404;停用渠道 404 |
| CHNL-001-C4 | 同一 external user 复用会话（origin=CHANNEL,originRef=channelId:extUserId） |
| CHNL-001-C5 | 审计联动（chnl.message）;未登录管理面 401 |

## 2. 业务逻辑

- token：`rw_ch_`+24B base64url（一次性展示,同 APIKEY 模式;库存 pepper 摘要）;
- 接收端点鉴权不走 session（/api/open 分支已放行）——token 摘要匹配+enabled;
- 消息归一：优先 `text`（string）,次 `{message:{content}}`（钉钉）、`{event:{message:{content}}}`（飞书）——宽进严出,未识别形态 422 提示;
- 会话：originRef=`chnl:{channelId}:{extUserId??anonymous}` 找最近一条复用,无则建;
- 员工未发布 → 422 透出。

## 3. UI/UX 设计

原型 `docs/design/CHNL-001-im-channels/`（形态同 TOOL-002 MCP 页）。菜单「渠道」。webhook URL 展示+复制（明文 token 一次性弹窗同 APIKEY）。

## 4. 技术架构

- shared `channel.ts`：platform 枚举（feishu/dingtalk/wecom）/channelCreateInput/channelDto/channelMessageInput（归一入参:任意 JSON,服务端提取）;
- `apps/web/src/server/channel-token.ts`（rw_ch_ 生成/校验——复用 APIKEY pepper 模式独立前缀）;
- API：`GET/POST /api/v1/channels`、`PATCH/DELETE /{id}`;`POST /api/open/v1/channels/{token}/messages`（无 session,token 鉴权）;权限 ORG_RESOURCE:*;
- 前端：/channels 页 + 菜单;api-client channelApi。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| CHNL-001-01 | 建渠道（绑定已发布员工）→ webhook token 发消息 → 201+会话落库 | e2e |
| CHNL-001-02 | 同 extUserId 二次消息 → 复用同一会话 | e2e |
| CHNL-001-03 | 伪造 token 404;停用后 404;无 text 422 | jmx/e2e |
| CHNL-001-04 | 管理面未登录 401 | jmx |

## 6. 基线深度对标

蓝图「评估直用 vs 平台侧网关」——上游无 channels（404 实证）→ 平台侧网关;出站推送与签名校验登记 R-OUTBOUND/R-SIGNATURE（真实 IM 凭据到位后启用）。

## 7. 里程碑与验收

交付清单：channel-token 纯函数 → 管理面 API+jmx → webhook 接收端点 → /channels 页+e2e → 文档流转。DoD：三类绿 + 远端 CI 绿 + push。
