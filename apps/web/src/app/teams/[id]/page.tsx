"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  App,
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  CrownOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserAddOutlined,
  EditOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { staffApi, teamApi } from "@rabbit/api-client";
import type { TeamUpdateInput } from "@rabbit/shared";

/** 任务状态 → 语义色（上游原值透传，TEAM-001 §3）。 */
function taskStatusColor(status: string | null): string {
  switch (status) {
    case "active":
      return "processing";
    case "pending":
      return "default";
    case "completed":
      return "success";
    case "failed":
      return "error";
    default:
      return "default";
  }
}

/** 团队详情（TEAM-001）：成员管理 + 任务只读 Tab + 运行面同步状态。 */
export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const detail = useQuery({
    queryKey: ["team", id],
    queryFn: () => teamApi.detail(id),
    retry: false,
  });
  const tasks = useQuery({
    queryKey: ["team", id, "tasks"],
    queryFn: () => teamApi.tasks(id),
  });
  const staffs = useQuery({
    queryKey: ["staffs"],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });

  const [tab, setTab] = useState("members");
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editForm] = Form.useForm<TeamUpdateInput>();
  const [addForm] = Form.useForm<{ employeeId: string; role: "LEADER" | "MEMBER" }>();

  const team = detail.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["team", id] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
  };

  const update = useMutation({
    mutationFn: (input: TeamUpdateInput) => teamApi.update(id, input),
    onSuccess: () => {
      message.success("已保存");
      setEditOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const removeTeam = useMutation({
    mutationFn: () => teamApi.remove(id),
    onSuccess: () => {
      message.success("团队已删除");
      router.push("/teams");
    },
  });
  const addMember = useMutation({
    mutationFn: (input: { employeeId: string; role: "LEADER" | "MEMBER" }) =>
      teamApi.addMember(id, input),
    onSuccess: () => {
      message.success("成员已加入");
      setAddOpen(false);
      addForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "添加失败"),
  });
  const removeMember = useMutation({
    mutationFn: (employeeId: string) => teamApi.removeMember(id, employeeId),
    onSuccess: () => {
      message.success("已移除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "移除失败"),
  });
  const sync = useMutation({
    mutationFn: () => teamApi.sync(id),
    onSuccess: (d) => {
      if (d.syncState === "SYNC_FAILED") {
        message.warning(`同步失败:${d.asSyncError ?? "未知原因"}`);
      } else {
        message.success(d.asTeamId ? "运行面已同步" : "已保存(尚未具备同步条件)");
      }
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "同步失败"),
  });

  const memberIds = new Set((team?.members ?? []).map((m) => m.employeeId));
  const candidates = (staffs.data?.items ?? []).filter(
    (s) => s.status === "PUBLISHED" && !memberIds.has(s.id),
  );

  return (
    <AppShell active="teams">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="team-detail-page">
        {detail.isLoading ? (
          <Skeleton avatar active paragraph={{ rows: 4 }} />
        ) : detail.isError || !team ? (
          <Empty description="团队不存在或已被删除" className="!my-16">
            <Button onClick={() => router.push("/teams")}>返回团队列表</Button>
          </Empty>
        ) : (
          <>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/teams")}
              className="!mb-4 !-ml-2 !text-rw-fg-subtle"
            >
              返回团队列表
            </Button>

            {/* 同步失败横幅（TEAM-001 §2.3：真实原因透出 + 重试） */}
            {team.syncState === "SYNC_FAILED" && (
              <div
                className="bg-rw-warning-subtle border-rw-warning text-rw-warning mb-4 flex items-center justify-between gap-4 rounded-rw-md border px-4 py-3"
                data-testid="team-sync-fail-banner"
              >
                <div className="flex items-start gap-2.5 text-[13px]">
                  <WarningOutlined className="mt-0.5" />
                  <div>
                    <p className="font-medium">AgentScope 同步失败:{team.asSyncError}</p>
                    <p className="text-rw-fg-subtle mt-0.5 text-xs">
                      本地修改已保存;团队当前以本地为准,上游可能滞后
                    </p>
                  </div>
                </div>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={sync.isPending}
                  onClick={() => sync.mutate()}
                  data-testid="team-sync-retry-btn"
                  className="!border-rw-warning !text-rw-warning"
                >
                  重试同步
                </Button>
              </div>
            )}

            {/* 团队信息头 */}
            <div className="border-rw-border bg-rw-card mb-6 rounded-rw-md border p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="font-display text-xl font-semibold tracking-tight text-rw-fg">
                      {team.name}
                    </h1>
                    {team.leaderName && (
                      <span className="bg-rw-warning-subtle text-rw-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                        <CrownOutlined />
                        TL · {team.leaderName}
                      </span>
                    )}
                    <Tag
                      bordered={false}
                      className="!m-0 !rounded-full !bg-rw-success-subtle !text-rw-success"
                    >
                      {team.memberCount} 名成员
                    </Tag>
                    {team.syncState === "SYNCED" && (
                      <span
                        className="bg-rw-success-subtle text-rw-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        data-testid="team-sync-pill"
                      >
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rw-success" />
                        运行面已同步
                      </span>
                    )}
                  </div>
                  {team.description && (
                    <p className="text-rw-fg-muted mt-2 text-sm">{team.description}</p>
                  )}
                  {team.goal && (
                    <p className="text-rw-fg-subtle mt-1.5 text-[13px]">
                      <span className="text-rw-fg-muted font-medium">目标:</span>
                      {team.goal}
                    </p>
                  )}
                  {/* 运行面状态行（TEAM-001 §3） */}
                  <div
                    className="text-rw-fg-subtle mt-3 flex flex-wrap items-center gap-2 text-xs"
                    data-testid="team-runtime-row"
                  >
                    <span>AgentScope 团队</span>
                    {team.asTeamId ? (
                      <span className="font-mono text-[11px]">{team.asTeamId}</span>
                    ) : (
                      <span>未建立(设置 TL 后自动同步)</span>
                    )}
                    {team.asSyncedAt && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">
                          {team.asSyncedAt.replace("T", " ").slice(0, 16)} 同步
                        </span>
                      </>
                    )}
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={sync.isPending}
                      onClick={() => sync.mutate()}
                      className="!h-6 !px-2 !text-xs"
                      data-testid="team-sync-btn"
                    >
                      重新同步
                    </Button>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title={`删除团队「${team.name}」?`}
                    description="本地团队将归档;AgentScope 运行面将保留存档(上游暂不支持删除)。"
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={() => removeTeam.mutate()}
                  >
                    <Button danger icon={<DeleteOutlined />} data-testid="team-delete-btn" />
                  </Popconfirm>
                </div>
              </div>
            </div>

            {/* Tab 分区（MASTER §5.3）：成员管理 | 任务（只读浅映射） */}
            <div className="border-rw-border bg-rw-card rounded-rw-md border p-6">
              <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                  { key: "members", label: `成员管理 (${team.members.length})` },
                  { key: "tasks", label: `任务 (${tasks.data?.items.length ?? 0})` },
                ]}
              />

              {tab === "members" ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-[15px] font-semibold text-rw-fg">成员列表</h2>
                    <Button
                      type="primary"
                      ghost
                      icon={<UserAddOutlined />}
                      onClick={() => setAddOpen(true)}
                      disabled={candidates.length === 0}
                      data-testid="team-add-member-btn"
                    >
                      添加成员
                    </Button>
                  </div>

                  {team.members.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="还没有成员,添加第一位数字员工"
                      className="!my-8"
                    />
                  ) : (
                    <div
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                      data-testid="team-member-list"
                    >
                      {team.members.map((m, i) => (
                        <div
                          key={m.employeeId}
                          className="animate-fade-up border-rw-border bg-rw-muted-subtle flex items-center gap-3 rounded-rw-md border px-4 py-3"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <Avatar
                            size={38}
                            className="avatar-accent !flex !shrink-0 !items-center !justify-center"
                          >
                            <span className="text-sm font-medium">
                              {m.employeeName.slice(0, 1)}
                            </span>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-rw-fg truncate text-sm font-medium">
                                {m.employeeName}
                              </span>
                              {m.role === "LEADER" ? (
                                <span className="bg-rw-warning-subtle text-rw-warning inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                                  <CrownOutlined />
                                  项目领导
                                </span>
                              ) : (
                                <span className="bg-rw-muted-subtle text-rw-fg-muted rounded-full px-2 py-0.5 text-[11px]">
                                  成员
                                </span>
                              )}
                            </div>
                            <div className="text-rw-fg-subtle mt-0.5 truncate text-xs tabular-nums">
                              {m.employeeTitle} · {m.joinedAt.slice(0, 10)} 入队
                            </div>
                          </div>
                          <Popconfirm
                            title={m.role === "LEADER" ? "移除队长?" : "移除该成员?"}
                            okText="移除"
                            cancelText="取消"
                            onConfirm={() => removeMember.mutate(m.employeeId)}
                          >
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="bg-rw-muted-subtle text-rw-fg-subtle mt-4 rounded-rw-md px-3.5 py-2.5 text-xs leading-relaxed">
                    提示:每队一名项目领导(TL);设置/更换 TL 会自动同步 AgentScope 运行面(建队/改队)。
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-rw-fg-subtle text-xs" data-testid="team-tasks-hint">
                      任务来自 AgentScope 运行面(只读浅映射);创建与分派在 AgentScope 控制台完成
                    </p>
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={tasks.isFetching}
                      onClick={() =>
                        void queryClient.invalidateQueries({ queryKey: ["team", id, "tasks"] })
                      }
                      data-testid="team-tasks-refresh"
                    >
                      刷新
                    </Button>
                  </div>

                  {tasks.data?.degraded && (
                    <div
                      className="bg-rw-warning-subtle border-rw-warning text-rw-warning mb-3 flex items-center gap-2 rounded-rw-md border px-3.5 py-2 text-xs"
                      data-testid="team-tasks-degraded"
                    >
                      <WarningOutlined />
                      AgentScope 上游暂不可用,任务列表已降级为空——稍后刷新重试
                    </div>
                  )}

                  <Table
                    data-testid="team-tasks-table"
                    rowKey="id"
                    size="small"
                    loading={tasks.isLoading}
                    locale={{
                      emptyText: team.asTeamId
                        ? "该团队在运行面还没有任务——到 AgentScope 控制台创建后回此处刷新"
                        : "团队尚未同步运行面——设置 TL 后自动建立,任务将展示在此",
                    }}
                    dataSource={tasks.data?.items ?? []}
                    pagination={false}
                    columns={[
                      {
                        title: "任务",
                        dataIndex: "title",
                        render: (t: string | null) => t ?? "(未命名)",
                      },
                      {
                        title: "状态",
                        dataIndex: "status",
                        width: 120,
                        render: (s: string | null) => (
                          <Tag bordered={false} color={taskStatusColor(s)}>
                            {s ?? "unknown"}
                          </Tag>
                        ),
                      },
                      {
                        title: "分派对象",
                        dataIndex: "assignee",
                        width: 160,
                        render: (a: string | null) => a ?? "—",
                      },
                      {
                        title: "最近更新",
                        dataIndex: "updatedAt",
                        width: 150,
                        render: (u: string | null) => (
                          <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                            {u ? u.replace("T", " ").slice(0, 16) : "—"}
                          </span>
                        ),
                      },
                    ]}
                  />
                </>
              )}
            </div>

            {/* 编辑团队 */}
            <Modal
              title="编辑团队"
              open={editOpen}
              onCancel={() => setEditOpen(false)}
              onOk={() => editForm.submit()}
              okText="保存"
              cancelText="取消"
              confirmLoading={update.isPending}
              destroyOnHidden
            >
              <Form
                form={editForm}
                layout="vertical"
                requiredMark={false}
                initialValues={{
                  name: team.name,
                  description: team.description ?? undefined,
                  goal: team.goal ?? undefined,
                }}
                onFinish={(v) => update.mutate(v)}
              >
                <Form.Item
                  name="name"
                  label="团队名称"
                  rules={[{ required: true, message: "请输入团队名称" }]}
                >
                  <Input maxLength={128} />
                </Form.Item>
                <Form.Item name="description" label="团队简介(可选)">
                  <Input maxLength={512} />
                </Form.Item>
                <Form.Item name="goal" label="团队目标(可选)" className="!mb-0">
                  <Input.TextArea rows={2} maxLength={1024} />
                </Form.Item>
              </Form>
            </Modal>

            {/* 添加成员 */}
            <Modal
              title={
                <span className="flex items-center gap-2">
                  <PlusOutlined className="text-rw-accent" />
                  添加成员
                </span>
              }
              open={addOpen}
              onCancel={() => setAddOpen(false)}
              onOk={() => addForm.submit()}
              okText="添加"
              cancelText="取消"
              confirmLoading={addMember.isPending}
              destroyOnHidden
            >
              <Form
                form={addForm}
                layout="vertical"
                requiredMark={false}
                initialValues={{ role: "MEMBER" }}
                onFinish={(v) => addMember.mutate(v)}
              >
                <Form.Item
                  name="employeeId"
                  label="数字员工"
                  rules={[{ required: true, message: "请选择员工" }]}
                >
                  <Select
                    data-testid="team-member-select"
                    placeholder="选择已发布的数字员工"
                    showSearch
                    optionFilterProp="label"
                    virtual={false}
                    options={candidates.map((s) => ({
                      value: s.id,
                      label: `${s.name}(${s.title})`,
                    }))}
                  />
                </Form.Item>
                <Form.Item
                  name="role"
                  label="角色"
                  className="!mb-0"
                  extra="项目领导(TL)每队仅一名,重复设置将自动替换;设为 TL 会同步运行面"
                >
                  <Select
                    virtual={false}
                    options={[
                      { value: "MEMBER", label: "成员" },
                      { value: "LEADER", label: "项目领导(TL)" },
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
