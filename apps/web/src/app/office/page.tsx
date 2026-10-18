"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { App, Button, Modal } from "antd";
import {
  ReloadOutlined,
  MessageOutlined,
  EditOutlined,
  SwapOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AppShell } from "@/components/AppShell";
import { PixiFloorPlan } from "@/components/PixiFloorPlan";
import { chatApi, staffApi } from "@rabbit/api-client";
import { OFFICE_FLOOR_COUNT, OFFICE_SEATS_PER_FLOOR, type StaffDto } from "@rabbit/shared";
import "./office.css";

/** 员工衣色（姓名哈希，与详情页 Hero 工位照同源） */
const TONE_COLORS = [
  "#0f766e",
  "#2f6fd0",
  "#a85d32",
  "#6f7b42",
  "#33507a",
  "#3d6b4f",
  "#b08325",
  "#2c3e6b",
] as const;

function toneColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TONE_COLORS[h % TONE_COLORS.length]!;
}

/** 表情动作（点击工位菜单触发，emoji 气泡 3.2s） */
const EMOTES = {
  wave: { label: "挥手", emoji: "👋" },
  think: { label: "思考", emoji: "💭" },
  laugh: { label: "大笑", emoji: "😄" },
  idea: { label: "灵感", emoji: "💡" },
  angry: { label: "生气", emoji: "💢" },
} as const;
type EmoteKey = keyof typeof EMOTES;

const seatKey = (floor: number, seat: number) => `${floor}-${seat}`;

/**
 * 办公室（OFFICE-001 v3）：楼面 × 每层 20 工位 + 顶部员工数据卡 + 中央楼层平面 + 底部 composer。
 * 2026-10-18 决策：移除原右栏「当前任务流」「实时动态」及顶部 3 张任务统计卡——
 * agentscope 平台无 Task 概念，仅暴露 agents/chats/turns/events，原模块数据均为 mock。
 * 后续 Task 域规格落地时按需重建。
 */
export default function OfficePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [floor, setFloor] = useState(1);
  const [menuStaff, setMenuStaff] = useState<StaffDto | null>(null);
  const [picker, setPicker] = useState<{ staff: StaffDto | null } | null>(null); // null=关闭；{staff}=换座；{staff:null}=安排模式
  const [emote, setEmote] = useState<{ staffId: string; key: EmoteKey } | null>(null);
  const emoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const staffs = useQuery({
    queryKey: ["staffs"],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });
  const all = staffs.data?.items ?? [];
  const seated = all.filter((s) => s.deskFloor != null && s.deskSeat != null);
  const waiting = all.filter((s) => s.deskFloor == null || s.deskSeat == null);
  const bySeat = useMemo(() => {
    const base = new Map(seated.map((s) => [seatKey(s.deskFloor!, s.deskSeat!), s]));
    // DEV-ONLY 演示桥：通过 ?withMock=1 在 auth 卡死时也能验证 Pixi 渲染
    if (typeof window !== "undefined" && window.location.search.includes("withMock=1")) {
      const mockStaff = (
        id: string,
        code: string,
        name: string,
        title: string,
        seat: number,
      ): StaffDto => ({
        id,
        orgId: "mock-org",
        code,
        name,
        title,
        personaPrompt: "",
        boundary: null,
        avatarUrl: null,
        status: "PUBLISHED",
        visibility: "PRIVATE",
        asAgentId: null,
        asAgentKey: null,
        publishedAt: null,
        deskFloor: floor, // 跟随当前 floor，使 mock 在 1F/2F/3F 都生效
        deskSeat: seat,
        createdAt: "",
        updatedAt: "",
      });
      const MOCK: Record<number, StaffDto> = {
        1: mockStaff("m1", "P001", "李研", "前端开发", 1),
        6: mockStaff("m2", "P002", "陈书", "内容运营", 6),
        11: mockStaff("m3", "P003", "赵审", "法务合规", 11),
        16: mockStaff("m4", "P004", "刘市", "客户成功", 16),
      };
      for (const [seat, s] of Object.entries(MOCK)) {
        base.set(`${floor}-${Number(seat)}`, s);
      }
    }
    return base;
  }, [seated, floor]);
  const floorCount = (f: number) => seated.filter((s) => s.deskFloor === f).length;
  const onlineCount = all.filter((s) => s.status === "PUBLISHED").length;

  // ─── 顶部数据卡（仅保留 AI 员工在线/总数） ───
  const stats = useMemo(
    () => ({
      staffsOnline: onlineCount,
      staffsTotal: all.length,
    }),
    [onlineCount, all.length],
  );

  // 点击工位:复用该员工最近会话,没有则新建
  const enterDesk = useMutation({
    mutationFn: async (employeeId: string) => {
      const existing = await chatApi.listConversations({ employeeId, page: 1 });
      const latest = existing.items.find((c) => c.status === "ACTIVE") ?? existing.items[0];
      return latest ?? (await chatApi.createConversation(employeeId));
    },
    onSuccess: (c) => router.push(`/chat/${c.id}`),
    onSettled: () => setMenuStaff(null),
  });

  const assignDesk = useMutation({
    mutationFn: ({ staffId, f, seat }: { staffId: string; f: number; seat: number }) =>
      staffApi.assignDesk(staffId, { floor: f, seat }),
    onSuccess: (staff) => {
      message.success(
        `${staff.name} 已就座 ${staff.deskFloor}F-${String(staff.deskSeat).padStart(2, "0")}`,
      );
      setPicker({ staff: null });
      if (staff.deskFloor) setFloor(staff.deskFloor);
      void queryClient.invalidateQueries({ queryKey: ["staffs"] });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "工位分配失败"),
  });

  // Esc / 点击空白关闭工位菜单
  useEffect(() => {
    if (!menuStaff) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target;
      if (t instanceof Element && t.closest(".desk-menu, .rw-seat-hit")) return;
      setMenuStaff(null);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setMenuStaff(null);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuStaff]);

  useEffect(
    () => () => {
      if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current);
    },
    [],
  );

  function playEmote(staffId: string, key: EmoteKey) {
    setEmote({ staffId, key });
    if (emoteTimerRef.current) clearTimeout(emoteTimerRef.current);
    emoteTimerRef.current = setTimeout(() => setEmote(null), 3200);
  }

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["staffs"] });

  return (
    <AppShell active="office">
      <div className="rw-office-shell" data-testid="office-page">
        {/* ── 页头：标题 + 刷新 ── */}
        <div className="rw-office-header">
          <div>
            <h1 className="rw-office-title">办公室</h1>
            <p className="rw-office-subtitle">
              楼层平面 · 每层 {OFFICE_SEATS_PER_FLOOR} 个工位 · 点击工位可发起对话或更换座位
            </p>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={refresh}
            loading={staffs.isFetching}
            data-testid="office-refresh"
          >
            刷新
          </Button>
        </div>

        {/* ── 顶部数据卡（仅 AI 员工在线/总数） ── */}
        <div className="rw-stats-row">
          {/* <div className="rw-stat-card" data-testid="office-stat-staffs">
            <div className="rw-stat-label">AI 员工</div>
            <div className="rw-stat-value">
              {stats.staffsOnline}
              <span className="rw-stat-value-sub"> / {stats.staffsTotal}</span>
            </div>
            <div className="rw-stat-hint">在线人数</div>
          </div> */}
        </div>

        {/* ── 两列主体：左 立体办公楼+待安排 ｜ 中 工位网格 ── */}
        <div className="rw-office-main">
          {/* 左：立体办公楼 + 待安排 */}
          <aside className="rw-office-left">
            <div className="rw-card" data-testid="office-floors">
              <div className="rw-card-eyebrow">办公楼 · 点击楼层查看平面</div>
              <div className="iso-building">
                <div className="iso-roof" aria-hidden="true" />
                {(Array.from({ length: OFFICE_FLOOR_COUNT }, (_, i) => i + 1) as number[]).map(
                  (f) => {
                    const active = f === floor;
                    const used = floorCount(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFloor(f)}
                        data-testid={`office-floor-${f}`}
                        aria-current={active ? "true" : undefined}
                        aria-label={`${f}F，${used} / ${OFFICE_SEATS_PER_FLOOR} 工位在用`}
                        className={`iso-floor-btn ${active ? "is-active" : ""} ${used > 0 ? "" : "opacity-80"}`}
                      >
                        <span className="iso-floor-label">
                          <span className="floor-no">{f}F</span>
                          <span className="floor-count">
                            {used}/{OFFICE_SEATS_PER_FLOOR}
                          </span>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="rw-card" data-testid="office-waiting">
              <div className="rw-card-eyebrow rw-card-eyebrow-flex">
                <span>待安排就座</span>
                <span className="font-mono tabular-nums">{waiting.length}</span>
              </div>
              {waiting.length === 0 ? (
                <p className="rw-card-empty">全员就座 🎉</p>
              ) : (
                waiting.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicker({ staff: s })}
                    data-testid={`office-waiting-${s.code}`}
                    className="rw-waiting-row"
                  >
                    <UserAddOutlined className="rw-text-accent shrink-0 text-xs" />
                    <span className="truncate">{s.name}</span>
                    <span className="rw-text-subtle ml-auto shrink-0 text-[11px]">{s.title}</span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* 中：当前楼层平面 */}
          <section
            className="rw-card rw-floor-plan-card animate-fade-up"
            aria-label={`${floor}F 楼层平面`}
            data-testid="office-floor-plan"
          >
            <div className="rw-floor-plan-header">
              <h2 className="rw-floor-plan-title">{floor}F 楼层平面</h2>
              <span className="rw-text-subtle font-mono text-xs tabular-nums">
                {floorCount(floor)} / {OFFICE_SEATS_PER_FLOOR} 工位在用
              </span>
            </div>
            <div className="rw-pixi-floor-wrap" data-testid="office-pixi-floor-wrap">
              {staffs.isLoading ? (
                <p className="rw-text-subtle py-8 text-center text-sm">楼层加载中…</p>
              ) : null}
              <PixiFloorPlan
                floor={floor}
                bySeat={bySeat}
                onSeatClick={(seat, staff) => {
                  if (staff) {
                    enterDesk.mutate(staff.id);
                  } else {
                    setPicker({ staff: null });
                  }
                }}
              />
            </div>
          </section>

          {/* 注：2026-10-18 移除右栏任务流 + 实时动态（agentscope 无 Task 数据源），后续按需重建 */}
        </div>
        {/* 注：2026-10-18 移除底部 chat composer（办公室页只保留"看 + 安排工位"功能） */}
      </div>

      {/* 工位选择器：换座（pickerStaff 指定员工）/ 空位安排（先选员工） */}
      {picker && (
        <DeskPickerModal
          staff={picker.staff}
          candidates={picker.staff ? null : waiting}
          bySeat={bySeat}
          onClose={() => setPicker(null)}
          onPick={(staffId, f, seat) => assignDesk.mutate({ staffId, f, seat })}
          loading={assignDesk.isPending}
        />
      )}
    </AppShell>
  );
}

/** 工位地台（平面网格 + 伪立体三面台）：占用=小人+名牌；空=虚线矮台。 */
function SeatTile({
  seat,
  staff,
  menuOpen,
  emoteKey,
  chatPending,
  onOpenMenu,
  onStartChat,
  onOpenProfile,
  onSwapDesk,
  onEmote,
  onAssign,
}: {
  seat: number;
  staff?: StaffDto;
  menuOpen: boolean;
  emoteKey: EmoteKey | null;
  chatPending: boolean;
  onOpenMenu: (s: StaffDto) => void;
  onStartChat: (s: StaffDto) => void;
  onOpenProfile: (s: StaffDto) => void;
  onSwapDesk: (s: StaffDto) => void;
  onEmote: (staffId: string, key: EmoteKey) => void;
  onAssign: () => void;
}) {
  const active = staff?.status === "PUBLISHED";
  const anim = !staff
    ? ""
    : !active
      ? "agent-away"
      : emoteKey
        ? `agent-emote-${emoteKey}`
        : "agent-idle";
  return (
    <div
      className={`iso-pad animate-fade-up ${menuOpen ? "z-20" : ""} ${staff ? "" : "is-empty"}`}
      id={staff ? `desk-${staff.id}` : undefined}
      data-testid={staff ? `office-seat-${staff.deskFloor}f-${seat}` : `office-seat-empty-${seat}`}
      style={{ animationDelay: `${Math.min(seat, 8) * 40}ms` }}
    >
      <div className="pad-body relative flex h-full flex-col p-2">
        <span className="rw-text-subtle absolute left-2 top-1.5 z-[2] font-mono text-[10px] tabular-nums">
          {String(seat).padStart(2, "0")}
        </span>
        {active && (
          <span
            className="rw-bg-success absolute right-2 top-2 z-[2] h-1.5 w-1.5 animate-pulse-dot rounded-full"
            aria-label="在岗"
          />
        )}

        {staff ? (
          <div className="rw-seat-wrap">
            <div
              className="desk-furniture rw-seat"
              style={
                {
                  "--agent-tone": toneColor(staff.name),
                  "--agent-anim-delay": `${(seat * 0.61) % 4}s`,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              <span className="desk-chair" />
              <span className={`desk-agent ${anim}`}>
                <span className="agent-hair" />
                <span className="agent-head">
                  <span className="agent-eye agent-eye-left" />
                  <span className="agent-eye agent-eye-right" />
                  <span className="agent-mouth" />
                  <span className="agent-blush agent-blush-left" />
                  <span className="agent-blush agent-blush-right" />
                </span>
                <span className="agent-body">
                  <span className="agent-arm agent-arm-left" />
                  <span className="agent-arm agent-arm-right" />
                </span>
                {emoteKey && active && (
                  <span className="agent-emote-bubble" key={emoteKey}>
                    {EMOTES[emoteKey].emoji}
                  </span>
                )}
                {!active && <span className="agent-emote-bubble agent-zzz">💤</span>}
              </span>
              <span className="desk-top" />
              <span className="desk-keyboard" />
              <span className="desk-leg desk-leg-left" />
              <span className="desk-leg desk-leg-right" />
              <span className="desk-monitor">
                <span className="monitor-glow" />
              </span>
              <span className="desk-mug" />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4">
            <button
              type="button"
              onClick={onAssign}
              aria-label={`安排员工就座 工位 ${seat}`}
              className="rw-text-subtle hover:rw-text-accent flex cursor-pointer flex-col items-center gap-1 transition-colors duration-[140ms] ease-out"
            >
              <UserAddOutlined className="text-lg" />
              <span className="text-[11px]">虚位以待</span>
            </button>
          </div>
        )}

        {staff && (
          <div className="flex items-center justify-between gap-1 px-1 pb-0.5">
            <span className="rw-text-fg truncate text-[12px] font-medium">{staff.name}</span>
            <span className="rw-text-subtle shrink-0 text-[10px]">
              {active ? staff.title.slice(0, 4) : "离岗"}
            </span>
          </div>
        )}
      </div>

      {staff && (
        <button
          type="button"
          className="rw-seat-hit absolute inset-0 z-[3] cursor-pointer rounded-rw-md"
          onClick={() => onOpenMenu(staff)}
          aria-label={`${staff.name} 的工位 ${staff.deskFloor}F-${seat}`}
        />
      )}

      {staff && menuOpen && (
        <div className="desk-menu z-[4]">
          <div className="desk-menu-head">
            <strong>{staff.name}</strong>
            <span>{staff.title}</span>
          </div>
          {active && (
            <button
              type="button"
              className="desk-menu-btn"
              disabled={chatPending}
              onClick={() => onStartChat(staff)}
            >
              <MessageOutlined />
              {chatPending ? "进入中…" : "发起对话"}
            </button>
          )}
          <button type="button" className="desk-menu-btn" onClick={() => onOpenProfile(staff)}>
            <EditOutlined />
            查看资料
          </button>
          <button type="button" className="desk-menu-btn" onClick={() => onSwapDesk(staff)}>
            <SwapOutlined />
            更换工位
          </button>
          {active && (
            <div className="desk-menu-emotes">
              <div className="desk-menu-emotes-title">表情动作</div>
              <div className="desk-emote-grid">
                {(Object.keys(EMOTES) as EmoteKey[]).map((key) => (
                  <button
                    type="button"
                    key={key}
                    className="desk-emote-chip"
                    onClick={() => onEmote(staff.id, key)}
                  >
                    {EMOTES[key].emoji} {EMOTES[key].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 工位选择弹窗：换座模式（staff 指定）直接选位；安排模式（staff=null）先选员工再选位。 */
function DeskPickerModal({
  staff,
  candidates,
  bySeat,
  onClose,
  onPick,
  loading,
}: {
  staff: StaffDto | null;
  candidates: StaffDto[] | null;
  bySeat: Map<string, StaffDto>;
  onClose: () => void;
  onPick: (staffId: string, floor: number, seat: number) => void;
  loading: boolean;
}) {
  const [pickedStaff, setPickedStaff] = useState<StaffDto | null>(null);
  const [floor, setFloor] = useState(1);
  const target = staff ?? pickedStaff;
  useEffect(() => {
    if (staff?.deskFloor) setFloor(staff.deskFloor);
    setPickedStaff(null);
  }, [staff]);

  return (
    <Modal
      open={staff != null || candidates != null}
      title={target ? `为 ${target.name} 选择工位` : "安排员工就座"}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={640}
    >
      {!target && candidates && candidates.length > 0 && (
        <div className="mb-4 space-y-1.5" data-testid="desk-picker-candidates">
          <p className="rw-text-muted mb-1 text-xs">选择要安排的员工：</p>
          {candidates.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPickedStaff(s)}
              className="rw-waiting-pick-btn"
            >
              <span className="rw-text-fg text-[13px] font-medium">{s.name}</span>
              <span className="rw-text-subtle text-xs">{s.title}</span>
            </button>
          ))}
        </div>
      )}

      {target && (
        <>
          <div className="mb-3 flex items-center gap-2">
            {(Array.from({ length: OFFICE_FLOOR_COUNT }, (_, i) => i + 1) as number[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFloor(f)}
                className={`rw-floor-tab ${f === floor ? "rw-floor-tab-active" : "rw-floor-tab-idle"}`}
              >
                {f}F
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2" data-testid="desk-picker-grid">
            {(Array.from({ length: OFFICE_SEATS_PER_FLOOR }, (_, i) => i + 1) as number[]).map(
              (seat) => {
                const occupant = bySeat.get(seatKey(floor, seat));
                const isSelf = occupant?.id === target.id;
                const free = !occupant;
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={!free && !isSelf}
                    onClick={() => onPick(target.id, floor, seat)}
                    data-testid={`desk-pick-${floor}f-${seat}`}
                    className={`rw-floor-seat ${
                      isSelf
                        ? "rw-floor-seat-self"
                        : free
                          ? "rw-floor-seat-free"
                          : "rw-floor-seat-taken"
                    }`}
                  >
                    {String(seat).padStart(2, "0")}
                    <span className="mt-0.5 block truncate text-[10px] font-sans">
                      {isSelf ? "当前" : occupant ? occupant.name : "空位"}
                    </span>
                  </button>
                );
              },
            )}
          </div>
          <p className="rw-text-subtle mt-3 text-center font-mono text-[11px]">
            {loading ? "分配中…" : "灰色为已占用 · 点击空位确认"}
          </p>
        </>
      )}
    </Modal>
  );
}
