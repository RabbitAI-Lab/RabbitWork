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

/** 办公室（OFFICE-001 v2）：楼层平面 × 每层 20 工位；员工可自由切换工位。 */
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
  const bySeat = useMemo(
    () => new Map(seated.map((s) => [seatKey(s.deskFloor!, s.deskSeat!), s])),
    [seated],
  );
  const floorCount = (f: number) => seated.filter((s) => s.deskFloor === f).length;

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
      <div className="mx-auto max-w-6xl px-8 py-8" data-testid="office-page">
        {/* 页头 */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              办公室
            </h1>
            <p className="text-rw-fg-subtle mt-1 text-sm">
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

        <div className="flex items-start gap-5">
          {/* 左：立体办公楼 + 待安排 */}
          <aside className="w-56 shrink-0 space-y-4">
            <div
              className="border-rw-border bg-rw-card rounded-rw-md border p-4"
              data-testid="office-floors"
            >
              <div className="text-rw-fg-muted mb-3 text-xs font-medium">
                办公楼 · 点击楼层查看平面
              </div>
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

            <div
              className="border-rw-border bg-rw-card rounded-rw-md border p-3"
              data-testid="office-waiting"
            >
              <div className="text-rw-fg-muted mb-2 flex items-center justify-between text-xs">
                <span>待安排就座</span>
                <span className="font-mono tabular-nums">{waiting.length}</span>
              </div>
              {waiting.length === 0 ? (
                <p className="text-rw-fg-subtle py-2 text-center text-xs">全员就座 🎉</p>
              ) : (
                waiting.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicker({ staff: s })}
                    data-testid={`office-waiting-${s.code}`}
                    className="text-rw-fg-muted hover:bg-rw-muted-subtle hover:text-rw-fg mb-1 flex w-full cursor-pointer items-center gap-2 rounded-rw-sm px-2 py-1.5 text-left text-[13px] transition-colors duration-[140ms] ease-out last:mb-0"
                  >
                    <UserAddOutlined className="text-rw-accent shrink-0 text-xs" />
                    <span className="truncate">{s.name}</span>
                    <span className="text-rw-fg-subtle ml-auto shrink-0 text-[11px]">
                      {s.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* 右：当前楼层平面 */}
          <section
            className="border-rw-border bg-rw-card animate-fade-up min-w-0 flex-1 rounded-rw-md border p-5"
            aria-label={`${floor}F 楼层平面`}
            data-testid="office-floor-plan"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold text-rw-fg">
                {floor}F 楼层平面
              </h2>
              <span className="text-rw-fg-subtle font-mono text-xs tabular-nums">
                {floorCount(floor)} / {OFFICE_SEATS_PER_FLOOR} 工位在用
              </span>
            </div>
            {staffs.isLoading ? (
              <p className="text-rw-fg-subtle py-16 text-center text-sm">楼层加载中…</p>
            ) : (
              <div className="iso-floor-plate grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
                {(Array.from({ length: OFFICE_SEATS_PER_FLOOR }, (_, i) => i + 1) as number[]).map(
                  (seat) => {
                    const staff = bySeat.get(seatKey(floor, seat));
                    return (
                      <SeatTile
                        key={seat}
                        seat={seat}
                        staff={staff}
                        menuOpen={staff ? menuStaff?.id === staff.id : false}
                        emoteKey={staff && emote?.staffId === staff.id ? emote.key : null}
                        chatPending={
                          staff ? enterDesk.isPending && enterDesk.variables === staff.id : false
                        }
                        onOpenMenu={setMenuStaff}
                        onStartChat={(s) => enterDesk.mutate(s.id)}
                        onOpenProfile={(s) => router.push(`/staffs/${s.id}`)}
                        onSwapDesk={(s) => {
                          setMenuStaff(null);
                          setPicker({ staff: s });
                        }}
                        onEmote={playEmote}
                        onAssign={() => setPicker({ staff: null })}
                      />
                    );
                  },
                )}
              </div>
            )}
          </section>
        </div>
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
        <span className="text-rw-fg-subtle absolute left-2 top-1.5 z-[2] font-mono text-[10px] tabular-nums">
          {String(seat).padStart(2, "0")}
        </span>
        {active && (
          <span
            className="bg-rw-success absolute right-2 top-2 z-[2] h-1.5 w-1.5 animate-pulse-dot rounded-full"
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
              className="text-rw-fg-subtle hover:text-rw-accent flex cursor-pointer flex-col items-center gap-1 transition-colors duration-[140ms] ease-out"
            >
              <UserAddOutlined className="text-lg" />
              <span className="text-[11px]">虚位以待</span>
            </button>
          </div>
        )}

        {staff && (
          <div className="flex items-center justify-between gap-1 px-1 pb-0.5">
            <span className="truncate text-[12px] font-medium text-rw-fg">{staff.name}</span>
            <span className="text-rw-fg-subtle shrink-0 text-[10px]">
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
          <p className="text-rw-fg-muted mb-1 text-xs">选择要安排的员工：</p>
          {candidates.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPickedStaff(s)}
              className="border-rw-border hover:border-rw-accent hover:bg-rw-accent-subtle flex w-full cursor-pointer items-center justify-between rounded-rw-sm border px-3 py-2 text-left transition-colors duration-[140ms] ease-out"
            >
              <span className="text-[13px] font-medium text-rw-fg">{s.name}</span>
              <span className="text-rw-fg-subtle text-xs">{s.title}</span>
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
                className={`cursor-pointer rounded-rw-sm px-3 py-1 font-mono text-xs transition-colors duration-[140ms] ease-out ${
                  f === floor
                    ? "bg-rw-accent-subtle font-medium text-rw-accent"
                    : "text-rw-fg-muted hover:bg-rw-muted-subtle"
                }`}
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
                    className={`rounded-rw-sm border px-1 py-2 text-center font-mono text-xs tabular-nums transition-all duration-[140ms] ease-out ${
                      isSelf
                        ? "border-rw-accent bg-rw-accent-subtle font-semibold text-rw-accent"
                        : free
                          ? "border-rw-border hover:border-rw-accent hover:bg-rw-accent-subtle text-rw-fg-muted cursor-pointer"
                          : "border-rw-border bg-rw-muted-subtle text-rw-fg-subtle cursor-not-allowed"
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
          <p className="text-rw-fg-subtle mt-3 text-center font-mono text-[11px]">
            {loading ? "分配中…" : "灰色为已占用 · 点击空位确认"}
          </p>
        </>
      )}
    </Modal>
  );
}
