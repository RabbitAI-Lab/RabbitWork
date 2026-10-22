"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton, Tabs } from "antd";
import {
  ArrowLeftOutlined,
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  RocketOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useEffect, useState, type CSSProperties } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { CountNumber } from "@/components/CountNumber";
import { ResourceBindings } from "@/components/ResourceBindings";
import { chatApi, staffApi } from "@rabbit/api-client";
import type { StaffUpdateInput } from "@rabbit/shared";
import "../../office/office.css";

/** 员工衣色（与办公室工位同源：姓名哈希取色） */
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

/** 员工详情（参照 StaffDeck DashboardPage 布局）：Hero 工位照 + 指标行 + 工作数据/会话记录 Tabs。 */
export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm<StaffUpdateInput>();

  const staffQ = useQuery({
    queryKey: ["staff-detail", id],
    queryFn: async () => {
      // list 接口含全量字段,取单条
      const page = await staffApi.list({ pageSize: 100 });
      return page.items.find((s) => s.id === id) ?? null;
    },
    retry: false,
  });
  const stats = useQuery({
    queryKey: ["staff-stats", id],
    queryFn: () => staffApi.stats(id),
    retry: false,
  });
  const conversations = useQuery({
    queryKey: ["conversations", id],
    queryFn: () => chatApi.listConversations({ employeeId: id }),
    retry: false,
  });

  const staff = staffQ.data;

  useEffect(() => {
    if (staff && editOpen) {
      form.setFieldsValue({
        name: staff.name,
        title: staff.title,
        personaPrompt: staff.personaPrompt,
        boundary: staff.boundary ?? undefined,
        visibility: staff.visibility,
      });
    }
  }, [staff, editOpen, form]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-detail", id] });
    void queryClient.invalidateQueries({ queryKey: ["staffs"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-stats", id] });
  };

  const update = useMutation({
    mutationFn: (input: StaffUpdateInput) => staffApi.update(id, input),
    onSuccess: () => {
      message.success("档案已保存");
      setEditOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const publish = useMutation({
    mutationFn: () => staffApi.publish(id),
    onSuccess: (s) => {
      message.success(
        s.usedFallback
          ? `已发布（共享运行时 Agent 兜底）`
          : `已发布（AgentScope：${s.agentStatus}）`,
      );
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "发布失败"),
  });
  const remove = useMutation({
    mutationFn: () => staffApi.remove(id),
    onSuccess: () => {
      message.success("员工已删除");
      void queryClient.invalidateQueries({ queryKey: ["staffs"] });
      router.push("/staffs");
    },
  });
  const startChat = useMutation({
    mutationFn: async () => {
      const existing = await chatApi.listConversations({ employeeId: id, page: 1 });
      const latest = existing.items.find((c) => c.status === "ACTIVE") ?? existing.items[0];
      return latest ?? (await chatApi.createConversation(id));
    },
    onSuccess: (c) => router.push(`/chat/${c.id}`),
  });

  const s = stats.data;
  const successRate = s && s.runTotal > 0 ? Math.round((s.runSucceeded / s.runTotal) * 100) : null;

  return (
    <AppShell active="staffs">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="staff-detail-page">
        {staffQ.isLoading ? (
          <Skeleton avatar active paragraph={{ rows: 4 }} />
        ) : !staff ? (
          <Empty description="员工不存在或已被删除" className="!my-16">
            <Button onClick={() => router.push("/staffs")}>返回员工列表</Button>
          </Empty>
        ) : (
          <>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/staffs")}
              className="!mb-4 !-ml-2 !text-rw-fg-subtle"
            >
              返回员工列表
            </Button>

            {/* Hero:工位照 + 档案头（参照 StaffDeck DashboardPage） */}
            <div className="border-rw-border bg-rw-card animate-fade-up mb-6 rounded-rw-md border p-6">
              <div className="flex flex-wrap items-start gap-8">
                {/* 迷你工位照:复用办公室 Q 版小人（衣服色与工位一致） */}
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <div
                    className="desk-furniture hero-desk"
                    style={
                      {
                        "--agent-tone": toneColor(staff.name),
                        "--agent-anim-delay": "0.6s",
                      } as CSSProperties
                    }
                    aria-hidden="true"
                  >
                    <span className="desk-chair" />
                    <span
                      className={`desk-agent ${staff.status === "PUBLISHED" ? "agent-idle" : "agent-away"}`}
                    >
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
                      {staff.status !== "PUBLISHED" && (
                        <span className="agent-emote-bubble agent-zzz">💤</span>
                      )}
                    </span>
                    <span className="desk-top" />
                    <span className="desk-keyboard" />
                    <span className="desk-leg desk-leg-left" />
                    <span className="desk-leg desk-leg-right" />
                    <span className="desk-monitor">
                      <span className="monitor-glow" />
                    </span>
                    <span className="desk-mug" />
                    <span className="desk-plate">{staff.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {staff.status === "PUBLISHED" ? (
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={startChat.isPending}
                        onClick={() => startChat.mutate()}
                        data-testid="staff-detail-chat"
                      >
                        去对话
                      </Button>
                    ) : (
                      <Button
                        type="primary"
                        ghost
                        icon={<RocketOutlined />}
                        loading={publish.isPending}
                        onClick={() => publish.mutate()}
                      >
                        发布上岗
                      </Button>
                    )}
                    <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                      编辑资料
                    </Button>
                  </div>
                </div>

                {/* 档案信息列 */}
                <div className="flex min-w-[280px] flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-end gap-2.5">
                    <h1 className="font-display text-[22px] font-semibold leading-none tracking-tight text-rw-fg">
                      {staff.name}
                    </h1>
                    <span className="text-[13px] leading-none text-rw-fg-muted">{staff.title}</span>
                    <StatusPill status={staff.status as "PUBLISHED" | "DRAFT" | "OFFLINE"} />
                  </div>

                  <div className="text-rw-fg-muted flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    <span className="font-mono">工号 {staff.code}</span>
                    {staff.deskFloor != null && staff.deskSeat != null && (
                      <span className="rounded-rw-sm bg-rw-muted-subtle px-2 py-0.5 font-mono tabular-nums">
                        工位 {staff.deskFloor}F-{String(staff.deskSeat).padStart(2, "0")}
                      </span>
                    )}
                    <span>
                      {staff.visibility === "ORG"
                        ? "组织内"
                        : staff.visibility === "GALLERY"
                          ? "广场"
                          : "私有"}
                    </span>
                    <span className="tabular-nums">创建于 {staff.createdAt.slice(0, 10)}</span>
                    {staff.publishedAt && (
                      <span className="tabular-nums">上岗于 {staff.publishedAt.slice(0, 10)}</span>
                    )}
                    {staff.asAgentId && (
                      <span className="rounded-rw-sm bg-rw-accent-subtle px-2 py-0.5 font-mono text-[11px] text-rw-accent">
                        {staff.asAgentKey ?? staff.asAgentId}
                      </span>
                    )}
                  </div>

                  <p
                    className="m-0 line-clamp-2 max-w-[680px] text-[13px] leading-[22px] text-rw-fg-muted"
                    data-testid="staff-persona-summary"
                  >
                    {staff.personaPrompt}
                  </p>

                  {/* Hero 指标行 */}
                  <div className="flex w-full max-w-[514px] gap-3" data-testid="staff-hero-metrics">
                    <HeroMetric label="会话" value={s?.conversationCount ?? 0} />
                    <HeroMetric label="运行" value={s?.runTotal ?? 0} />
                    <HeroMetric label="成功率" value={successRate ?? 0} suffix="%" accent />
                    <HeroMetric
                      label="失败/打断"
                      value={(s?.runFailed ?? 0) + (s?.runInterrupted ?? 0)}
                    />
                  </div>
                </div>

                {/* 危险操作 */}
                <div className="flex shrink-0 flex-col justify-start">
                  <Popconfirm
                    title="删除该员工？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => remove.mutate()}
                  >
                    <Button danger icon={<DeleteOutlined />} aria-label="删除" />
                  </Popconfirm>
                </div>
              </div>
            </div>

            {/* Tabs:工作数据 / 会话记录 */}
            <Tabs
              centered
              defaultActiveKey="work"
              items={[
                {
                  key: "work",
                  label: "工作数据",
                  children: (
                    <div className="border-rw-border bg-rw-card animate-fade-up rounded-rw-md border p-6">
                      <div
                        className="grid grid-cols-2 gap-3 md:grid-cols-4"
                        data-testid="staff-stats"
                      >
                        <StatCard label="会话数" value={s ? String(s.conversationCount) : "—"} />
                        <StatCard label="运行次数" value={s ? String(s.runTotal) : "—"} />
                        <StatCard
                          label="成功次数"
                          value={s ? String(s.runSucceeded) : "—"}
                          accent
                        />
                        <StatCard
                          label="失败 / 打断"
                          value={s ? `${s.runFailed} / ${s.runInterrupted}` : "—"}
                        />
                      </div>
                      <div className="bg-rw-muted-subtle text-rw-fg-muted mt-4 grid gap-3 rounded-rw-md p-4 text-xs sm:grid-cols-3">
                        <div className="flex items-center justify-between">
                          <span>输入 token</span>
                          <span className="font-mono font-medium text-rw-fg tabular-nums">
                            {s ? s.tokenIn.toLocaleString() : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>输出 token</span>
                          <span className="font-mono font-medium text-rw-fg tabular-nums">
                            {s ? s.tokenOut.toLocaleString() : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>最近活跃</span>
                          <span className="font-mono font-medium text-rw-fg tabular-nums">
                            {s?.lastActiveAt ? s.lastActiveAt.slice(0, 16).replace("T", " ") : "—"}
                          </span>
                        </div>
                      </div>
                      {staff.boundary && (
                        <>
                          <h2 className="text-rw-fg mb-3 mt-6 flex items-center gap-2 text-[15px] font-semibold">
                            <CrownOutlined className="text-rw-warning" />
                            职责边界
                          </h2>
                          <div className="bg-rw-warning-subtle text-rw-warning rounded-rw-md p-4 text-[13px] leading-relaxed">
                            {staff.boundary}
                          </div>
                        </>
                      )}
                    </div>
                  ),
                },
                {
                  key: "skills",
                  label: "技能配置",
                  children: <ResourceBindings staffId={id} type="SKILL" />,
                },
                {
                  key: "knowledge",
                  label: "知识库",
                  children: <ResourceBindings staffId={id} type="KNOWLEDGE" />,
                },
                {
                  key: "logs",
                  label: "会话记录",
                  children: (
                    <div className="border-rw-border bg-rw-card animate-fade-up rounded-rw-md border p-6">
                      <h2 className="text-rw-fg mb-4 text-[15px] font-semibold">会话记录</h2>
                      {(conversations.data?.items.length ?? 0) === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="还没有对话"
                          className="!my-6"
                        />
                      ) : (
                        <div className="space-y-2.5">
                          {conversations.data?.items.map((c, i) => (
                            <button
                              key={c.id}
                              type="button"
                              data-testid={`staff-conv-${i}`}
                              onClick={() => router.push(`/chat/${c.id}`)}
                              className="border-rw-border bg-rw-muted-subtle hover:border-rw-accent hover:bg-rw-accent-subtle animate-fade-up flex w-full items-center gap-3 rounded-rw-sm border px-4 py-3 text-left transition-colors duration-[140ms] ease-out"
                              style={{ animationDelay: `${i * 40}ms` }}
                            >
                              <MessageOutlined className="text-rw-fg-subtle shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-rw-fg">
                                  {c.title}
                                </div>
                                <div className="text-rw-fg-subtle mt-0.5 text-xs tabular-nums">
                                  最近消息 {c.lastMessageAt?.slice(0, 16).replace("T", " ") ?? "—"}
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                                  c.status === "ACTIVE"
                                    ? "bg-rw-accent-subtle text-rw-accent"
                                    : "bg-rw-muted-subtle text-rw-fg-subtle"
                                }`}
                              >
                                {c.status === "ACTIVE" ? "进行中" : "空闲"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            {/* 编辑档案 */}
            <Modal
              title="编辑档案"
              open={editOpen}
              onCancel={() => setEditOpen(false)}
              onOk={() => form.submit()}
              okText="保存"
              cancelText="取消"
              confirmLoading={update.isPending}
              destroyOnHidden
              width={560}
            >
              <Form
                form={form}
                layout="vertical"
                requiredMark={false}
                onFinish={(v) => update.mutate(v)}
              >
                <div className="grid grid-cols-2 gap-x-4">
                  <Form.Item
                    name="name"
                    label="姓名"
                    rules={[{ required: true, message: "请输入姓名" }]}
                  >
                    <Input maxLength={128} />
                  </Form.Item>
                  <Form.Item
                    name="title"
                    label="岗位"
                    rules={[{ required: true, message: "请输入岗位" }]}
                  >
                    <Input maxLength={128} />
                  </Form.Item>
                </div>
                <Form.Item
                  name="personaPrompt"
                  label="人设（System Prompt）"
                  rules={[{ required: true, message: "请输入人设" }]}
                >
                  <Input.TextArea rows={6} showCount maxLength={20000} />
                </Form.Item>
                <Form.Item name="boundary" label="职责边界（可选）">
                  <Input.TextArea rows={3} maxLength={20000} />
                </Form.Item>
                <Form.Item name="visibility" label="可见性" className="!mb-0">
                  <Select
                    virtual={false}
                    options={[
                      { value: "PRIVATE", label: "私有（仅创建者）" },
                      { value: "ORG", label: "组织内" },
                      { value: "GALLERY", label: "广场（复用）" },
                    ]}
                  />
                </Form.Item>
              </Form>
            </Modal>
          </>
        )}
      </div>
    </AppShell>
  );
}

function HeroMetric({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-rw-muted-subtle flex flex-1 items-end gap-1.5 rounded-rw-md px-4 py-2">
      <strong
        className={`font-display text-[16px] font-semibold leading-none tabular-nums ${accent ? "text-rw-success" : "text-rw-fg"}`}
      >
        <CountNumber target={value} />
        {suffix}
      </strong>
      <span className="text-rw-fg-muted text-xs leading-none">{label}</span>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-rw-muted-subtle rounded-rw-sm px-3.5 py-3">
      <div
        className={`font-display text-lg font-semibold leading-tight tabular-nums ${accent ? "text-rw-success" : "text-rw-fg"}`}
      >
        {value}
      </div>
      <div className="text-rw-fg-subtle mt-0.5 text-[11px]">{label}</div>
    </div>
  );
}
