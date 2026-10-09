# Changelog

本项目的所有重要变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- **Sprint 0 工程脚手架（INFRA-001，2026-10-10）**：自 RabbitAITest 全量移植工程经验——
  - 九条硬性工作门禁（文档先行 / 高保真原型+人工确认+走查 / 一次建齐数据模型 / API 契约纪律 / 权限与解耦 / 范围红线 / 自动化测试门槛 / 测试与文档同步 / 远程 CI 与 Sprint 交付）
  - rules/ 研发规范 9 份（typescript / react-nextjs / database / testing / git-workflow / security / observability / ai-collaboration / engine-预留）
  - 槽位化开发环境单一事实源（scripts/rabbit-env.mjs；端口基址相对 RabbitAITest 整体偏移，同机并行零冲突）+ 一键开发栈（scripts/dev.mjs）
  - packages 四包（shared 契约 / db Prisma 基线 / api-client / ui）+ apps/web 最小骨架（Tailwind+AntD+TanStack Query、reqId 中间件、health/ready 端点、安全响应头）
  - Playwright 三类断言纪律（fixtures + 录屏/trace/自动截屏）+ 脚手架冒烟用例 + JMeter 执行器（CSV 真校验）
  - CI 门禁（changes 探测 docs-only 直通 / quality / build / migrate-replay / e2e / ci-gate 锚点，actions 钉 SHA）+ PR 模板 + Docker multi-stage + docker-compose
