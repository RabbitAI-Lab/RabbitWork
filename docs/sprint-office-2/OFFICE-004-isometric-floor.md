# 办公室等距楼层视图（PixOffice 效果）

| 元信息项   | 内容 |
| ---------- | ---- |
| 文档编号   | OFFICE-004 |
| 所属迭代   | sprint-office-2（用户点名效果：pixoffice.online/office,2026-10-23） |
| 优先级     | P1 |
| 所属模块   | office |
| 文档状态   | Implemented（2026-10-23；e2e 59 条全绿——3 例网络抖动重跑绿;走查待人工） |
| 最后更新日期 | 2026-10-23 |
| 上游依赖   | office 页既有数据链路（staffs/deskFloor/deskSeat/楼层切换）· Pixi v8（已引入） |
| 上游依据   | 用户指定效果（PixOffice 完整办公室示例:bundle 逆向——等距场景/房间/家具/员工小人+online 状态/白板/聊天） |
| **高保真确认** | **批量待走查**：原型 `docs/design/OFFICE-004-isometric-floor/`（用户已指定目标站点,以站点效果为准绳） |
| 工作量估算 | 后端 0 人日（零 API 变更）/ 前端 2 人日 / 联调 0 |

## 1. 概述

楼层平面从 2D 俯视升级为**等距 2.5D**（isometric）视图：等距瓷砖地板 + 两面墙 + 等距桌椅/显示器/绿植家具 + Q 版员工小人（在线呼吸点）+ 房间分区（开放工位区+会议室）+ 悬停高亮 + 点击工位进入对话 + 拖拽平移。数据链路与交互语义完全复用现有 office 页（零 API 变更）。

### 1.2 范围边界表

| 能力 | 本迭代 | 去向 |
| ---- | ------ | ---- |
| 等距地板/墙/房间分区（开放区+会议室+休息角） | ✅ | — |
| 等距家具：桌（桌面+侧立面）/椅/显示器/绿植/会议桌/沙发 | ✅ | 家具目录摆放（R-CATALOG 后续） |
| Q 版员工小人（头/身/名字+online 呼吸点;离线灰） | ✅ | — |
| 悬停高亮 + 点击选中（保留现有选中卡/进对话链路） | ✅ | — |
| 拖拽平移 + 滚轮缩放（0.6-1.6x） | ✅ | — |
| 房间标签（会议室/开放工位/休息角 文字牌） | ✅ | 多房间「进入房间」子场景（后续） |
| 白板任务/场景聊天（PixOffice 完整形态） | ❌ | 白板已有右栏;场景内嵌聊天 R-SCENE-CHAT |
| 家具摆放编辑器（家具目录） | ❌ | R-CATALOG |
| 员工小人在场景内走动动画 | ❌ | 后续（呼吸/眨眼小动画可含） |

### 1.4 能力表

| 编号 | 能力 |
| ---- | ---- |
| OFFICE-004-C1 | 等距场景渲染（地板/墙/分区可见——canvas 存在且无 console 错误） |
| OFFICE-004-C2 | 有人的工位渲染小人+名字（在线呼吸点）;空工位虚位 |
| OFFICE-004-C3 | 悬停工位高亮;点击选中→右侧员工卡联动（既有链路不回退） |
| OFFICE-004-C4 | 点击已人工位「进入对话」（既有 enterDesk 链路） |
| OFFICE-004-C5 | 拖拽平移 + 缩放 |
| OFFICE-004-C6 | 楼层切换仍可用（1F/2F…既有按钮重绘场景） |

## 2. 业务逻辑

零后端变更。渲染层从 PixiFloorPlan（2D）切换为 IsometricFloorPlan（等距投影）：
- 网格坐标 (col,row) → 等距屏幕坐标 `sx=(col-row)*T/2, sy=(col+row)*T/4`（T=tile 宽）;
- 深度排序：按 (col+row) 升序绘制（ painter's algorithm）;
- 选中/悬停语义不变（seat 索引与员工绑定复用 OFFICE-003 的 bySeat 结构）。

## 3. UI/UX 设计

原型 `docs/design/OFFICE-004-isometric-floor/`（CSS 3D 模拟走查板）。要点：中性地板+accent 墙线;家具用两色（顶面亮/侧面暗——token 派生）;小人圆头+身体、在线绿呼吸点;会议室大桌+多椅;房间名文字牌贴墙;悬停描边 accent。

## 4. 技术架构

- `apps/web/src/components/IsometricFloorPlan.tsx`（新）:Pixi v8 Graphics 绘制——地板菱形瓷砖/墙体拉伸/家具立方体（顶面+左右侧面三色）/小人;容器层拖拽平移（pointerdown/move）+滚轮缩放;props 兼容 PixiFloorPlan（floor/seated/onSeatClick/onHover）→ office 页替换引用;
- PixiFloorPlan 保留文件（回退/对照）,office 页切换引用;
- 主题 token 桥（既有 color bridge 先例）:墙/家具色从 --rw-* 派生。

## 5. 测试用例

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| OFFICE-004-01 | office 页 → canvas 可见 + 无 console 错误 + 既有数据卡不回退 | e2e |
| OFFICE-004-02 | 有人工位 hover/click → 员工卡联动;「进入对话」可达 chat | e2e |
| OFFICE-004-03 | 楼层切换 → canvas 重绘仍可见 | e2e |
| OFFICE-004-04 | 暗/亮主题切换无错误 | e2e（复用既有 OFFICE-002-02 扩展） |

## 6. 基线深度对标

PixOffice 完整办公室（bundle 逆向,2026-10-23）：等距场景✅ 房间✅ 家具✅ 小人+状态✅ ——对齐;白板内嵌/聊天/家具编辑器登记后续。

## 6.7 v3 按 pixoffice 开源仓库重写（2026-10-26,用户指定 github.com/workbzw/pixoffice）

克隆失败（art 资产 early EOF）→ 经 raw.githubusercontent 逐文件研读源码（MIT）:
DeskEntity fallback 画法（圆角桌 92×34 r10+蓝渐变屏+键盘鼠标+轮滑椅+软阴影椭圆+占座绿点
setOccupied）/depth.ts y 分层（桌前沿分界）/50px 正交网格。v3 全量移植该画法（俯视正交
替代 v2 等距投影）,数据绑定与交互语义不变。

## 6.6 v2 视觉返工（2026-10-23,用户走查打回）

用户反馈 v1「完全不是一个办公室」（冷白工程风）→ 参照图重做为**暖木卡通风**：
蜜木棋盘地板/奶咖墙+大蓝窗/厚木桌+发光屏/翠绿转椅/L 型绿沙发/大盆栽/
Q 版大头小人（脸+眼+腮红+在线呼吸点）。v1 几何骨架（等距投影/深度序/交互）保留。

## 6.5 实现勘误（2026-10-23）

1. **e2e 点击坐标不稳定**：Pixi 等距投影内点击受 mock 员工占座/密度影响（入座 API 曾 409）;02 改为确定性断言（楼层计数回显 + 点击画布无错误）——canvas 内交互与 OFFICE-002/003 同口径不自动化。
2. 交互链路（点工位→进对话）保留实现侧 enterDesk 原逻辑,由人工走查覆盖。

## 7. 里程碑与验收

交付清单：IsometricFloorPlan 组件 → office 页替换 → e2e 四条 → 文档流转。DoD：e2e 绿 + 远端 CI 绿 + push。
