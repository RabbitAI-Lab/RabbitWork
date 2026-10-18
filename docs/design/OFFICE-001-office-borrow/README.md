# OFFICE-001 v2 · 局部借鉴 PixOffice（高保真原型）

| 元信息项 | 内容 |
| -------- | ---- |
| 文档编号 | OFFICE-001 |
| 原型版本 | v2（局部借鉴） |
| 所属模块 | office |
| 关联参考 | <https://www.pixoffice.online/office/> |
| 优先级   | P0（按用户指示） |
| 状态     | **Implemented** |
| 高保真确认 | 2026-10-18 · 用户在原型走查后通过「通过，进到规格 + 实现」确认（人工 · 不可下放 AI · rules/ai-collaboration §5） |
| 实现位置 | `apps/web/src/app/office/page.tsx` + `apps/web/src/app/office/office.css` |
| e2e 用例 | `tests/e2e/OFFICE-001-v2-office-borrow.spec.ts` |

## 1. 改造范围（用户已确认）

> 用户决策（2026-10-18）：「局部借鉴：顶部卡 + 右栏任务流 + composer（推荐）」

**借鉴三件事**：

1. 顶部 5 张横向数据卡（进行中 / 已完成 / 待处理 / AI员工 / 系统资源）
2. 右栏「当前任务流」+「实时动态」两段
3. 底部 chat composer（粘性，可发送）

**保留（不重做）**：

- 立体办公楼（`iso-building`、`iso-tile` 等已沉淀组件）
- 楼层切换（1F / 2F / 3F）
- Q 版小人 + 工位网格（保持 RabbitWork 风格不染 PixOffice 多彩人偶）

**不借鉴**：

- PixOffice 的左栏「主页/任务中心/AI员工/场景控制/插件/协议」等全套导航——沿用现有 AppShell
- PixOffice 的「团队成员」头像列——`AppShell` 底部已含
- 多彩衣色——RabbitWork 走单绿强调

## 2. 原型内容

`prototype.html` 单文件自包含（Tailwind CDN + 嵌入 DS v2.1 tokens），可直接 `open file://` 浏览器走查。包含：

- 侧栏 AppShell（与现状一致，未改动）
- 标题行 + 描述 + 刷新按钮（与现状一致）
- ★ 顶部 5 数据卡（新增）
- 三列：立体办公楼占位 / 工位网格 / ★ 右栏任务流+实时动态
- ★ 底部 chat composer（新增）

主题切换按钮（页面右上角）：`☀ 切亮色 / ☾ 切暗色` —— **必须同时走查亮暗双主题**（DS v2.1 / rules/design-system §2.6）。

### 走查参考截图（已产出）

| 主题 | 文件 |
| ---- | ---- |
| 暗色 | `office-v2-proto-dark.png`（1440×900） |
| 亮色 | `office-v2-proto-light.png`（1440×900） |

> 本地起服务走查：`cd docs/design/OFFICE-001-office-borrow && python3 -m http.server 8765` → `http://localhost:8765/prototype.html`

## 3. 走查要点（按 design-system §3 + rules/testing §1.2）

走查登记表（人工 walk-through + 实现后实拍走查）：

| 批 | 走查项 | 状态 | 笔记 |
| -- | ------ | ---- | ---- |
| ① | 顶部 5 卡宽度自适应，无溢出/截断 | ✅ | 1440 满行 5 列；1100 → 3+2；<1024 → 2+2+1；<768 → 单列堆叠 |
| ② | 右侧任务流 4 卡进度条颜色与状态徽章语义一致 | ✅ | RUNNING 蓝、PENDING 紫/橙、IDLE 灰；pill 形状+色与状态一一对应 |
| ③ | 实时动态 feed 时间戳格式统一（HH:MM） | ✅ | 同源 mono 数字体，未截断；行间 dashed border 区分 |
| ④ | chat composer focus 态翠绿环 + 输入框空态 placeholder | ✅ | `--rw-ring` 3px 翠绿外环 + accent 边色；提交 toast「已收到：…」后清空 |
| ⑤ | 暗色主题无裸色穿透（无任何黑底白字/白底黑字） | ✅ | dark/light 双截图走查通过 |
| ⑥ | 桌面 ≥1280 截图三态：默认 / hover / active | ✅ | stat-card hover 变翠绿边 + 浮起 1px；click 已加 :active scale 0.97 |
| ⑦ | 缩窄窗口（1100px 边界）右栏任务流不挤压 | ✅ | 三列 → 单列堆叠；右栏任务流独立 overflow-y-auto |

## 4. 勘误登记

原型与最终实现的差异回填这里（rules/design-system §3 / design/README §2.5）：

| 编号 | 内容 | 决议 |
| ---- | ---- | ---- |
| 勘误 1 | 左侧「立体办公楼」宽度从原型占位 56px → 真实 180px 列宽，让 iso-building 真实占位（不挤） | 接受 |
| 勘误 2 | 顶部「AI 员工」数字连真实数据：从 `all.filter(status==PUBLISHED).length` 推在线数；mock 数据 6/6 是 seed 不全时的临时态 | 接受，待 M2 seed 加 5 个 staff 后即显现 6/6 |
| 勘误 3 | 顶部 5 卡 `grid-cols-5/3/2/1`（<1280 / <1024 / <768）响应式断点与原型 lg:3 xl:5 一致 | 接受 |
| 勘误 4 | Composer 提交做 UI 兜底（toast「已收到」+ 清空）；任务域 API 暂无（M2 落地后接入真实路由） | 接受，提交处注释「待 M2 任务域接入」 |

## 5. 后续

- 实现完成（2026-10-18）
- Sprint 收尾需做（rules/git-workflow §8）：
  - 走查三对三（本节清单 vs 实现）
  - pnpm lint / pnpm typecheck / pnpm test 全绿本地
  - commit + push 远程，CI 远端全绿
  - sprint-overview 交付表更新
- e2e 用例（`tests/e2e/OFFICE-001-v2-office-borrow.spec.ts`）远端 CI 跑（本地 dev 模式已通过 DOM 查询验证全部 testid 存在）
- **未实现（去向后置）**：
  - 任务 / 动态 / 系统资源真实 API（M2 任务域规格）
  - 当前 mock 集中在 `apps/web/src/app/office/page.tsx` 顶部 `MOCK_TASKS / MOCK_FEED`，M2 落地一次性替换
- **未覆盖（待 M2）**：
  - JMeter 接口用例 `tests/api/OFFICE-001-*.jmx`（无 API 变更）
  - Vitest 单测 `page.test.ts`（mock 数据为静态常量，本期未抽取函数）
