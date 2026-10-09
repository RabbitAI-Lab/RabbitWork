# rules/testing.md — 自动化测试规范（JMeter 接口测试 + Playwright UI 测试）

> 由 AGENTS.md 门禁 7 引用。**硬性规定：任何功能点「开发完成」= 功能代码 + 单测 + JMeter 接口用例 + Playwright UI 用例全部交付且 CI 全绿**，缺任何一项 PR 不予合并。

## 1. 目录与命名（与规格文档编号一一对应）

```
tests/
├── api/                          # JMeter 接口自动化
│   └── {MODULE}-NNN-{slug}.jmx   #   每个功能点 ≥1 个（如 CASE-001-case-crud.jmx）
├── e2e/                          # Playwright UI 自动化
│   ├── fixtures.ts               #   公共夹具：expectNoConsoleErrors / expectApi / 自动截屏
│   └── {MODULE}-NNN-{slug}.spec.ts   # 每个界面功能点 ≥1 条
└── unit 随代码同目录 *.test.ts（Vitest）
```

规格文档 §5「测试用例」的用例表逐条映射到上述文件（编号一致）；PR 描述必须链接对应规格与测试文件。

### 1.2 覆盖单位（功能点 → 能力行 + 状态二态）

1. **最小覆盖单位 = 规格 §1.2 能力表每一行 P1 能力**：每行至少一条自动化断言——交互类能力（按钮/开关/弹窗/Tab/状态切换）必须落在 Playwright UI 层；纯契约/计算类可落 jmx 或 Vitest。仅"功能点主链路一条"不再视为达标（RabbitAITest SYS-004 预置组成员管理漏测教训）。
2. **关键状态二态显式化**：预置/自定义、只读/可写、启用/禁用、空态/有数据、有权/无权——规格 §5 用例表必须逐个出现（作为用例，或显式登记"豁免+理由"）；规格评审按此核对，未列出的二态视为规格缺陷。
3. 回归纪律不变（§5.3：Bug 先写失败用例再修复）。

> **门禁勘误先例（RabbitAITest 2026-09-27）**：jtl 校验曾以 `grep '<error>true</error>'`（XML 形态）恒不命中 CSV 输出，门禁空转漏放 8 处缺陷——本仓 `scripts/run-api-tests.sh` 已按 CSV 第 8 列 success 真校验实现；JMeter 断言要求：**预期 4xx/5xx 的采样器其状态断言必须勾选 Ignore Status（assume_success）**，否则采样器本身按状态码置失败。

## 2. JMeter 接口测试规范（tests/api/）

1. **覆盖面（每个功能点必测四类）**：
   - 正常路径（200 + 业务 `code:0` + 关键字段值）
   - 未认证 401 / 无权限 403（权限点验证）/ 资源不存在或越域 404
   - 入参校验失败 422（zod 拒绝）
   - 列表接口：分页信封 `{total, items}` 结构与排序
2. **每个采样器四项断言必备**：
   - HTTP 状态码（Response Assertion）
   - 响应体业务码 `code`（JSON Assertion，`$.code == 0`）
   - 关键业务字段（JSONPath 断言，如 `$.data.name`、`$.data.total >= 1`）
   - 响应时间上限（Duration Assertion，按 api-conventions 性能预算）
3. **环境与数据**：
   - `${BASE_URL}` 与 `${TOKEN}` 全局参数化；Token 由 setup 线程组登录获取
   - 用例**自建数据、自清理**（tearDown 删除），或使用种子测试项目，禁止依赖执行顺序
   - **同名标识单点求值**：多个采样器须引用同一逻辑名时，名字必须在 TestPlan 级 `user_defined_variables` 定义一次后引用——禁止各采样器内联 `${__time(yyyyMMddHHmmss)}` 各自求值（秒级时间戳跨秒边界即产生不同名，~5% 假红概率；RabbitAITest PR#47 实证）。
4. **执行**：`pnpm test:api`（对已启动的 jm 栈执行，校验 jtl 失败数 = 0）。
5. **CI 分片并行**：计划多时以 `--shard=N/M` round-robin 分片并行（各分片独立栈/独立 DB）。**分片安全边界：只准独立栈分片，禁止同栈共享并发**——计划间存在全局单例（系统参数等）与共用种子账号，共享 DB 会互踩；计划自身仍须遵守第 3 条「禁止依赖执行顺序」。本地默认不分片。

## 3. Playwright UI 测试规范（tests/e2e/）

### 3.1 三类断言（每条 UI 用例必须同时包含，缺一即不合规）

| #   | 断言类型         | 要求                                                                              | 实现方式                                                                                                                 |
| --- | ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **UI 断言**      | 验证界面结果：元素可见/消失、文本与状态标签、表格行数与列值、表单回显、Toast 提示 | `expect(locator).toBeVisible()/toHaveText()/toHaveCount()/toHaveValue()`                                                 |
| 2   | **Console 断言** | 页面全程**无 console.error、无未捕获 pageerror**；warning 需显式白名单登记        | fixture `expectNoConsoleErrors(page)`（收集 `page.on('console')` + `page.on('pageerror')` + 4xx/5xx xhr/fetch 留痕）     |
| 3   | **接口断言**     | 关键链路的网络请求：状态码、响应体关键字段、**请求负载**（payload 正确性）        | `expectApi(page, 'GET /api/v1/projects/*/cases*')` 封装 `page.waitForResponse`，断言 `status`、`body.data.*`、`postData` |

三类断言通过 `tests/e2e/fixtures.ts` 公共夹具提供，**禁止**各用例手写收集逻辑。

**接口断言钉方法**：`expectApi(urlGlob)` 只按 URL 匹配——集合 URL（同路径并存 GET 列表刷新与 POST/PUT 变更）在高压并发下会被他方法响应抢先匹配（RabbitAITest CI 实证：模块树 GET 刷新 200 冒充创建 POST 201）。凡捕获**集合 URL 或双方法 item URL** 的变更断言，必须传第二参钉方法：`expectApi("**/…/modules?scene=case", "POST")`。

### 3.2 编写规范

0. **期望值必须溯源规格，禁止对照实现拍期望**（RabbitAITest S1 走查教训）：曾把「预置组整组只读」的错误实现断言为正确行为（三类断言齐全但期望源头错了）。写断言前先回规格 §1.2/§3 找依据；实现与规格冲突时改实现并用例先行；「预置/只读/禁用」类语义在规格评审时必须写明作用范围。
1. 选择器优先级：`getByRole` > `getByText` > `data-testid="{module}-{name}"`；**禁止**脆弱的 CSS/XPath 选择器。
2. **用户路径完整**：功能用例必须从首页（`/`）出发，经**真实可见导航**（左侧菜单/顶栏/页面内主按钮）到达被测功能——**禁止 `page.goto` 直跳目标页**。理由：录屏供人工走查与验收，必须呈现功能入口路径。例外（可在 PR 说明）：守卫/未登录重定向类断言的「再次访问」、纯 API 无页面用例。
3. 稳定性：等待以 locator 断言为准，**禁止 `waitForTimeout` 硬等待**；每条用例独立数据（setup 创建、teardown 清理），用例间零依赖。
   - antd 5.29+ Select 虚拟列表下**可见选项无 `role=option`**——实现侧对需测试的下拉统一 `virtual={false}`；中文 2 字按钮自动插空格（确 定），按 `/^(确\s*定|OK)$/` 正则定位。
4. 登录态：使用 `authedPage` fixture（storageState 复用；随首个 SYS 认证规格加入），每条主链路用例另备一条「未登录跳转」断言。
5. 权限视角：涉及权限的功能至少两条用例（管理员视角成功 + 普通成员视角 403/隐藏）。
6. Mock 边界：UI 测试**不 mock** 业务 API（走真实服务，保证 console/接口断言真实性）；仅允许 mock 外部三方与时间。

### 3.3 录屏、Trace 与测试产物（失败必须可回放）

Playwright 全局配置（`tests/playwright.config.ts`，禁止用例级关闭）：

| 项             | 配置                                                | 说明                                                                    |
| -------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| **录屏 video** | `video: 'on-with-retry'`（size 1280×720）           | **每条 UI 用例必须留有录屏证据**；重试全过程保留，最终失败的视频必留存  |
| Trace          | `trace: 'retain-on-failure'`                        | 失败自动保留 trace，可离线回放（Trace Viewer）逐帧查看 DOM/网络/console |
| 截图           | `screenshot: 'only-on-failure'`                     | 失败即时现场                                                            |
| HTML 报告      | `reporter: [['html', { open: 'never' }], ['list']]` | 报告内嵌每条用例的 video/trace/截图入口                                 |

产物管理：

1. 本地产物目录 `test-results/`、`playwright-report/`（gitignore）；CI 作为 **artifact 上传**：HTML 报告 always，video/trace/截图 on-failure。
2. CI 产物保留 30 天；PR 失败时在检查摘要附报告链接——**评审失败的 UI 用例必须看录屏/trace 定位，禁止只看断言消息**。
3. Bug 单必须附失败用例的录屏或 trace 链接（复现证据链）。
4. **录屏首帧即用户路径起点**：视频必须从首页/登录页开始并包含导航点击过程（§3.2.2）；录屏看不到「从哪进入」视为不合规，走查打回。

### 3.6 UI 截屏（每条 UI 用例必备）

1. **自动截屏**：fixtures 对每条 UI 用例结束时自动整页截屏（无论成败），存 `test-results/screenshots/<用例名>.png`，与录屏/trace 一同作为走查与人工评审证据（已内置于 `tests/e2e/fixtures.ts` 的 page fixture）。
2. **视觉快照与还原度比对**：页面多时为每个有高保真原型的页面产出稳定态截图 + 多模态还原度比对（GLM-4.x-Flash，`similarity ≥80` pass）——工具链（visual-diff.mjs / VISUAL 用例）按 RabbitAITest 先例随首个 UI 迭代移植；比对报告入 PR，走查以该报告为客观输入，人工确认仍不可省略。
3. 截屏缺失的 UI 用例视为交付不完整（与录屏同等要求）。

### 3.4 执行与 CI

- 本地：`pnpm test:e2e`（global-setup 自动起本槽位 embedded PG + migrate + seed；web 以生产构建 `next start` 拉起——构建缺失时自动补构建，源码变更后须重跑 `pnpm --filter web build`）。
- 重试策略：CI `retries: 2`（仅 CI；本地 `retries: 0` 保持失败敏感——本地偶现即视为不稳定用例，必须修复或标记）。
- 并行：CI 按 worker 并行执行；用例数据独立（§3.2）保证可并行，禁止用例间共享状态。分片扩展时每分片独立栈/独立 DB（§2.5 同口径）。
- CI：PR 触发全量 e2e；失败即阻塞合并。
- **Release Gate**：主链路 E2E + 全量 tests/ 绿。

### 3.4.2 修复循环的环境复用（效率铁律）

逐条修复 × 每轮重建环境的循环**预计或实际超过 30 分钟**，必须切换为环境复用模式，禁止每轮重复 initdb/迁移/起栈：

1. **持久化 e2e 库**：设 `E2E_DATABASE_URL`（及需要 Redis 时 `E2E_REDIS_URL`）指向常驻库后，global-setup 检测到即跳过建库直接复用（常驻库维护工具 `pg-e2e.mjs` 按 RabbitAITest 先例随首个迭代移植）；批量模式再省：连修 3-4 条跑一次。
2. **代价与边界**：持久库有脏数据累积——用例必须数据隔离（§3.2 第 3 条，本就是规范）；**收尾必须跑一次全新口径**（不带 E2E_* 的 `pnpm test:e2e`）与 CI 一致；跑全新口径前杀本槽位 PG 残留（`lsof -ti :$RABBIT_E2E_PG_PORT | xargs kill -9`，否则端口冲突）。
3. **dev 与 e2e 并行**：`next dev` 会写坏生产构建 `.next`——并行时先做槽位专属 web 构建副本（`/tmp/rabbitwork-e2e-root-s{slot}`，e2e-web-copy 工具随需移植），代码变更后重跑（过期副本掩盖改动的教训）。
4. **通用化**：任何修复-验证循环超 30 分钟先审查固定开销（重建/全量跑/重启），能增量就增量、能复用就复用；互不依赖的问题并行修。
5. **复用库的隐性全局态**：用户计数等全局累积资源跨轮增长可能撞产品上限——排查口径：先数库再怀疑产品；**禁止依赖宿主机常驻服务端口**，用例目标一律走 `tests/e2e/env.ts` 推导（随槽位），不许硬编码。

### 3.5 断言与 fixture 质量（源自 RabbitProjects/RabbitAITest 实践教训）

1. **断言作用域化**：接口断言只针对本用例触发的请求（URL 模式圈定），console 断言异常必须定位到本用例操作——全局断言会把别人页面的错误算进本用例造成误报；确需豁免的 console 噪声显式登记白名单并注明来源。
2. **fixture 一律自造**：测试所需文件（图片/CSV）由测试代码生成或随测试资产提交，**禁止依赖本机路径残留**。
3. **限流与 429 容错**：CI 环境触发服务端限流时，用例按策略「allow + 重试」处理并在结果中标注，不得静默放宽断言。
4. **console 断言是后端 500 的探测器**：历史上有 API 500 仅被「e2e 控制台零错误断言」破获（前端静默吞掉的失败请求）——console 断言从第一天接入，禁止延后。
5. **录屏脚本容错**：批量录屏/取证脚本对空响应等异常要重试与降级。

### 3.5.1 时序健壮性（假红根治协议）

**「重跑就好」是处置失败不是修复**：共享 runner（GitHub ubuntu-latest）CPU/IO 波动可达 ±45%，它不制造缺陷、只放大用例里潜伏的时序敏感写法。凡偶发失败，必须归因到下列四类之一并修用例，禁止以「方差」为由重跑合入：

1. **状态翻转必须等强信号**：断言「X 已从 A 态变为 B 态」时，等待对象必须是状态变更响应（`waitForResponse` 对应端点）或**仅在该态渲染的元素**（消失/出现双向断言）；**禁止用子串文本当状态**。接口 2xx 但业务 `skipped` 类响应须在断言中带原因失败，不许裸 `toBeTruthy()` 收 undefined。
2. **重负载链路显式 `test.setTimeout`**：含两阶段以上的主链路用例，默认 60s 用例级超时会**先于断言超时杀测试且重试同样中招**——统一 `test.setTimeout(180_000)`，断言超时与之匹配。
3. **轮询禁用固定次数上限收尾**：终态等待用「条件退出 + 总时限兜底」（轮询至终态，超时报真实状态而非循环计满）；固定 N 次循环在慢机上要么提前断言失败要么白等。
4. **自动跳转竞态**：产品在「触发→终态」窗口内可能自动跳页，把测试等待中的元素直接卸载。依赖当前页面的后续断言，须在触发性操作后**显式 `page.goto` 回目标页锁定**，禁止与自动跳转共用随机时序。

新增/修改 e2e 用例在 PR 自查时过一遍本节；review 时对「waitForResponse 状态翻转 / setTimeout 重负载 / 轮询条件退出」三项显式打勾。

## 4. 单元测试（Vitest）

1. 域服务/内核（变量渲染、断言提取、状态机）必须有分支级单测；UI 组件只测纯逻辑（hooks/utils）。
2. `packages/shared` 的 zod schema 附 round-trip 单测（合法/非法样例各一组）。
3. 覆盖率：核心域 ≥ 70%（Release Gate），PR 内新增代码行覆盖 ≥ 80%（覆盖率门禁接入时按 §5.1「第一天真跑」清零存量）。

## 5. 与文档体系的联动

1. 规格 §5 用例表 = 自动化用例的清单来源，编号一一对应（`CASE-001-03` ↔ spec 内 test('CASE-001-03 …')）。
2. 用例新增/变更必须与功能同 PR；「先合功能后补测试」不允许。
3. Bug 修复必须附「回归用例」：先写失败用例复现，再修复转绿（prevent regression）。
