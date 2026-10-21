# sprint-team-1 — 团队协作接 AgentScope（浅映射）

> 从蓝图 M5（原排期 S9+）经产品决策提前（2026-10-21）。

## 交付范围

| 文档 | 主题 | 状态 |
| ---- | ---- | ---- |
| [TEAM-001-agentscope-team-sync](./TEAM-001-agentscope-team-sync.md) | 团队 CRUD 同步 AgentScope teams + 任务只读视图 | Implemented（2026-10-21 本地三腿全绿：单测 54 / e2e 10 / jmx；待远端 CI） |

## 验收标准

1. TEAM-001 能力表（§1.4 C1-C10）逐条可演示；
2. 单测 / JMeter（TEAM-001 jmx）/ Playwright（TEAM-001 spec）三类全绿，远端 CI 全绿；
3. 高保真原型逐项走查登记（design/TEAM-001-agentscope-team-sync/README.md）。

## 遗留项与风险

- R-TASK-SHAPE：agent-tasks 上游形状待实例有数据后复核（规格 §4.1）；
- 上游无 DELETE 端点：本地删除留档语义（规格 §2.2.3），上游支持删除后重估；
- jmx 403 场景豁免（无 MEMBER 种子账号，规格 §5.2）——用户管理域落地后补。
