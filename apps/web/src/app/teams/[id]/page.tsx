"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { App, Avatar, Button, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton, Tag } from "antd";
import { ArrowLeftOutlined, CrownOutlined, PlusOutlined, DeleteOutlined, UserAddOutlined, EditOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { staffApi, teamApi } from "@rabbit/api-client";
import type { TeamUpdateInput } from "@rabbit/shared";

/** 团队详情:信息编辑 + 成员管理(TL/成员,对齐 StaffDeck TeamDetail 语义)。 */
export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const detail = useQuery({ queryKey: ["team", id], queryFn: () => teamApi.detail(id), retry: false });
  const staffs = useQuery({ queryKey: ["staffs"], queryFn: () => staffApi.list({ pageSize: 100 }) });

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editForm] = Form.useForm<TeamUpdateInput>();
  const [addForm] = Form.useForm<{ employeeId: string; role: "LEADER" | "MEMBER" }>();

  useEffect(() => {
    if (detail.data && editOpen) {
      editForm.setFieldsValue({
        name: detail.data.name,
        description: detail.data.description ?? undefined,
        goal: detail.data.goal ?? undefined,
      });
    }
  }, [detail.data, editOpen, editForm]);

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
    mutationFn: (input: { employeeId: string; role: "LEADER" | "MEMBER" }) => teamApi.addMember(id, input),
    onSuccess: (d) => {
      message.success(d.members.length > 0 ? "成员已加入" : "已加入");
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

  const team = detail.data;
  const memberIds = new Set((team?.members ?? []).map((m) => m.employeeId));
  const candidates = (staffs.data?.items ?? []).filter((s) => s.status === "PUBLISHED" && !memberIds.has(s.id));

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

            {/* 团队信息头 */}
            <div className="mb-6 rounded-rw-md border border-rw-border bg-rw-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="font-display text-xl font-semibold tracking-tight text-rw-fg">{team.name}</h1>
                    {team.leaderName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rw-warning-subtle px-2.5 py-1 text-xs font-medium text-rw-warning">
                        <CrownOutlined />
                        TL · {team.leaderName}
                      </span>
                    )}
                    <Tag bordered={false} className="!m-0 !rounded-full !bg-rw-success-subtle !text-rw-success">
                      {team.memberCount} 名成员
                    </Tag>
                  </div>
                  {team.description && <p className="mt-2 text-sm text-rw-fg-muted">{team.description}</p>}
                  {team.goal && (
                    <p className="mt-1.5 text-[13px] text-rw-fg-subtle">
                      <span className="font-medium text-rw-fg-muted">目标:</span>
                      {team.goal}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                    编辑
                  </Button>
                  <Popconfirm title="删除该团队?" okText="删除" cancelText="取消" onConfirm={() => removeTeam.mutate()}>
                    <Button danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            </div>

            {/* 成员管理 */}
            <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有成员,添加第一位数字员工" className="!my-8" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="team-member-list">
                  {team.members.map((m, i) => (
                    <div
                      key={m.employeeId}
                      className="animate-fade-up flex items-center gap-3 rounded-rw-md border border-rw-border bg-rw-muted-subtle px-4 py-3"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <Avatar
                        size={38}
                        className="avatar-accent !flex !shrink-0 !items-center !justify-center"
                      >
                        <span className="text-sm font-medium">{m.employeeName.slice(0, 1)}</span>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-rw-fg">{m.employeeName}</span>
                          {m.role === "LEADER" ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rw-warning-subtle px-2 py-0.5 text-[11px] font-medium text-rw-warning">
                              <CrownOutlined />
                              项目领导
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-rw-muted-subtle px-2 py-0.5 text-[11px] text-rw-fg-muted">成员</span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs tabular-nums text-rw-fg-subtle">
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

              <p className="mt-4 rounded-rw-md bg-rw-muted-subtle px-3.5 py-2.5 text-xs leading-relaxed text-rw-fg-subtle">
                提示:每队一名项目领导(TL);团队级协作运行时(AgentScope teams 任务分派/竞标)将在 S6+ 接入,当前为组织管理层。
              </p>
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
              <Form form={editForm} layout="vertical" requiredMark={false} onFinish={(v) => update.mutate(v)}>
                <Form.Item name="name" label="团队名称" rules={[{ required: true, message: "请输入团队名称" }]}>
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
              title={<span className="flex items-center gap-2"><PlusOutlined className="text-rw-accent" />添加成员</span>}
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
                <Form.Item name="employeeId" label="数字员工" rules={[{ required: true, message: "请选择员工" }]}>
                  <Select
                    data-testid="team-member-select"
                    placeholder="选择已发布的数字员工"
                    showSearch
                    optionFilterProp="label"
                    options={candidates.map((s) => ({ value: s.id, label: `${s.name}(${s.title})` }))}
                  />
                </Form.Item>
                <Form.Item name="role" label="角色" className="!mb-0" extra="项目领导(TL)每队仅一名,重复设置将自动替换">
                  <Select
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
