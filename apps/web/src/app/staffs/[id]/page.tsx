"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { App, Avatar, Button, Descriptions, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton, Tag } from "antd";
import {
  ArrowLeftOutlined,
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  RocketOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { chatApi, staffApi } from "@rabbit/api-client";
import type { StaffUpdateInput } from "@rabbit/shared";

/** 员工详情（DS v2.1）:档案 + 运行时映射 + 数据统计 + 会话记录。 */
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
      message.success(s.usedFallback ? `已发布（共享运行时 Agent 兜底）` : `已发布（AgentScope：${s.agentStatus}）`);
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
    mutationFn: () => chatApi.createConversation(id),
    onSuccess: (c) => router.push(`/chat/${c.id}`),
  });

  const s = stats.data;
  const successRate = s && s.runTotal > 0 ? Math.round((s.runSucceeded / s.runTotal) * 100) : null;

  return (
    <AppShell active="staffs">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="staff-detail-page">
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

            {/* 档案头 */}
            <div className="mb-6 rounded-rw-md border border-rw-border bg-rw-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar size={64} className="avatar-accent !flex !shrink-0 !items-center !justify-center">
                    <span className="text-2xl font-medium">{staff.name.slice(0, 1)}</span>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="font-display text-xl font-semibold tracking-tight text-rw-fg">{staff.name}</h1>
                      <StatusPill status={staff.status as "PUBLISHED" | "DRAFT" | "OFFLINE"} />
                      <Tag bordered={false} className="!m-0 !rounded-full !bg-rw-muted-subtle !text-rw-fg-muted">
                        {staff.visibility === "ORG" ? "组织内" : staff.visibility === "GALLERY" ? "广场" : "私有"}
                      </Tag>
                    </div>
                    <p className="mt-1 text-sm text-rw-fg-subtle">
                      {staff.title} · <span className="font-mono">工号 {staff.code}</span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {staff.status === "PUBLISHED" ? (
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={startChat.isPending}
                      onClick={() => startChat.mutate()}
                    >
                      发起对话
                    </Button>
                  ) : (
                    <Button type="primary" ghost icon={<RocketOutlined />} loading={publish.isPending} onClick={() => publish.mutate()}>
                      发布
                    </Button>
                  )}
                  <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                    编辑档案
                  </Button>
                  <Popconfirm title="删除该员工？" okText="删除" cancelText="取消" onConfirm={() => remove.mutate()}>
                    <Button danger icon={<DeleteOutlined />} aria-label="删除" />
                  </Popconfirm>
                </div>
              </div>

              <Descriptions
                className="mt-5"
                column={3}
                size="small"
                items={[
                  { key: "created", label: "创建时间", children: staff.createdAt.slice(0, 19).replace("T", " ") },
                  { key: "published", label: "发布时间", children: staff.publishedAt?.slice(0, 19).replace("T", " ") ?? "—" },
                  {
                    key: "agent",
                    label: "运行时映射",
                    children: staff.asAgentId ? (
                      <span className="rounded-rw-sm bg-rw-accent-subtle px-2 py-0.5 font-mono text-xs text-rw-accent">
                        {staff.asAgentKey ?? staff.asAgentId}
                      </span>
                    ) : (
                      "未发布"
                    ),
                  },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              {/* 档案:人设与边界 */}
              <div className="lg:col-span-3 space-y-5">
                <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
                  <h2 className="mb-3 text-[15px] font-semibold text-rw-fg">人设（System Prompt）</h2>
                  <div className="whitespace-pre-wrap rounded-xl bg-rw-muted-subtle p-4 text-[13px] leading-relaxed text-rw-fg-muted" data-testid="staff-persona-full">
                    {staff.personaPrompt}
                  </div>
                  {staff.boundary && (
                    <>
                      <h2 className="mb-3 mt-5 text-[15px] font-semibold text-rw-fg">职责边界</h2>
                      <div className="rounded-rw-sm bg-rw-warning-subtle text-rw-warning whitespace-pre-wrap p-4 text-[13px] leading-relaxed/80">
                        {staff.boundary}
                      </div>
                    </>
                  )}
                </div>

                {/* 会话记录 */}
                <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
                  <h2 className="mb-4 text-[15px] font-semibold text-rw-fg">会话记录</h2>
                  {(conversations.data?.items.length ?? 0) === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有对话" className="!my-6" />
                  ) : (
                    <div className="space-y-2.5">
                      {conversations.data?.items.map((c, i) => (
                        <button
                          key={c.id}
                          type="button"
                          data-testid={`staff-conv-${i}`}
                          onClick={() => router.push(`/chat/${c.id}`)}
                          className="animate-fade-up border-rw-border bg-rw-muted-subtle hover:border-rw-accent hover:bg-rw-accent-subtle flex w-full items-center gap-3 rounded-rw-sm border px-4 py-3 text-left transition-colors duration-[140ms] ease-out"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <MessageOutlined className="text-rw-fg-subtle shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-rw-fg">{c.title}</div>
                            <div className="mt-0.5 text-xs text-rw-fg-subtle">
                              最近消息 {c.lastMessageAt?.slice(0, 16).replace("T", " ") ?? "—"}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                              c.status === "ACTIVE" ? "bg-rw-accent-subtle text-rw-accent" : "bg-rw-muted-subtle text-rw-fg-subtle"
                            }`}
                          >
                            {c.status === "ACTIVE" ? "进行中" : "空闲"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 右列:数据统计 */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
                  <h2 className="mb-4 text-[15px] font-semibold text-rw-fg">工作数据</h2>
                  <div className="grid grid-cols-2 gap-3" data-testid="staff-stats">
                    <StatCard label="会话数" value={s ? String(s.conversationCount) : "—"} />
                    <StatCard label="运行次数" value={s ? String(s.runTotal) : "—"} />
                    <StatCard label="成功率" value={successRate != null ? `${successRate}%` : "—"} accent />
                    <StatCard
                      label="失败 / 打断"
                      value={s ? `${s.runFailed} / ${s.runInterrupted}` : "—"}
                    />
                  </div>
                  <div className="mt-3 space-y-2 rounded-xl bg-rw-muted-subtle p-3.5 text-xs text-rw-fg-muted">
                    <div className="flex items-center justify-between">
                      <span>输入 token</span>
                      <span className="font-medium text-rw-fg">{s ? s.tokenIn.toLocaleString() : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>输出 token</span>
                      <span className="font-medium text-rw-fg">{s ? s.tokenOut.toLocaleString() : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>最近活跃</span>
                      <span className="font-medium text-rw-fg">
                        {s?.lastActiveAt ? s.lastActiveAt.slice(0, 16).replace("T", " ") : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-rw-fg">
                    <CrownOutlined className="text-rw-warning" />
                    所属团队
                  </h2>
                  <p className="rounded-xl bg-rw-muted-subtle px-3.5 py-2.5 text-xs leading-relaxed text-rw-fg-subtle">
                    团队归属展示与能力配置（模型/知识/技能/工具绑定）随 S3+ 能力域落地,当前档案以人设与对话为主。
                  </p>
                </div>
              </div>
            </div>

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
              <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => update.mutate(v)}>
                <div className="grid grid-cols-2 gap-x-4">
                  <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
                    <Input maxLength={128} />
                  </Form.Item>
                  <Form.Item name="title" label="岗位" rules={[{ required: true, message: "请输入岗位" }]}>
                    <Input maxLength={128} />
                  </Form.Item>
                </div>
                <Form.Item name="personaPrompt" label="人设（System Prompt）" rules={[{ required: true, message: "请输入人设" }]}>
                  <Input.TextArea rows={6} showCount maxLength={20000} />
                </Form.Item>
                <Form.Item name="boundary" label="职责边界（可选）">
                  <Input.TextArea rows={3} maxLength={20000} />
                </Form.Item>
                <Form.Item name="visibility" label="可见性" className="!mb-0">
                  <Select
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-rw-sm bg-rw-muted-subtle px-3.5 py-3">
      <div className={`font-display text-lg font-semibold leading-tight tabular-nums ${accent ? "text-rw-success" : "text-rw-fg"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-rw-fg-subtle">{label}</div>
    </div>
  );
}
