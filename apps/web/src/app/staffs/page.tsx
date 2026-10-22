"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  App,
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Skeleton,
  Tag,
} from "antd";
import {
  PlusOutlined,
  RocketOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { CountNumber } from "@/components/CountNumber";
import { chatApi, staffApi } from "@rabbit/api-client";
import { PERSONA_TEMPLATES, personaTemplateByKey } from "@rabbit/shared";
import type { StaffCreateInput, StaffDto, StaffUpdateInput } from "@rabbit/shared";

type Filter = "ALL" | "PUBLISHED" | "DRAFT" | "OFFLINE";

/** STAFF-001 员工管理（DS v2.1）：统计 + 分类过滤 + 搜索 + 卡片进详情。 */
export default function StaffsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [form] = Form.useForm<StaffCreateInput>();

  const list = useQuery({ queryKey: ["staffs"], queryFn: () => staffApi.list({ pageSize: 100 }) });
  const all = list.data?.items ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staffs"] });

  const items = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return all.filter((s) => {
      const okStatus = filter === "ALL" || s.status === filter;
      const okKw =
        !kw ||
        s.name.toLowerCase().includes(kw) ||
        s.title.toLowerCase().includes(kw) ||
        s.code.toLowerCase().includes(kw);
      return okStatus && okKw;
    });
  }, [all, filter, keyword]);

  const create = useMutation({
    mutationFn: (input: StaffCreateInput) => staffApi.create(input),
    onSuccess: () => {
      message.success("员工已创建（草稿）");
      setModalOpen(false);
      form.resetFields();
      void invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffUpdateInput }) =>
      staffApi.update(id, input),
    onSuccess: () => {
      message.success("已保存");
      setModalOpen(false);
      void invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const publish = useMutation({
    mutationFn: (id: string) => staffApi.publish(id),
    onSuccess: (staff) => {
      message.success(
        staff.usedFallback
          ? `已发布（共享运行时 Agent 兜底：${staff.agentStatus}）`
          : `已发布（AgentScope：${staff.agentStatus}）`,
      );
      void invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "发布失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      message.success("已删除");
      void invalidate();
    },
  });
  const startChat = useMutation({
    mutationFn: (staffId: string) => chatApi.createConversation(staffId),
    onSuccess: (conversation) => router.push(`/chat/${conversation.id}`),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };
  const openEdit = (staff: StaffDto) => {
    setEditing(staff);
    form.setFieldsValue({
      name: staff.name,
      title: staff.title,
      personaPrompt: staff.personaPrompt,
      boundary: staff.boundary ?? undefined,
      visibility: staff.visibility,
    });
    setModalOpen(true);
  };

  const stats = [
    { label: "员工总数", value: all.length, icon: <TeamOutlined className="text-rw-accent" /> },
    {
      label: "在岗员工",
      value: all.filter((s) => s.status === "PUBLISHED").length,
      icon: <RocketOutlined className="text-rw-success" />,
    },
    {
      label: "草稿",
      value: all.filter((s) => s.status === "DRAFT").length,
      icon: <EditOutlined className="text-rw-warning" />,
    },
  ];

  return (
    <AppShell active="staffs">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="staffs-page">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              我的数字员工
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">管理你的数字员工档案,点击卡片查看详情</p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={openCreate}
            data-testid="staff-create-btn"
          >
            新建员工
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 rounded-rw-md border border-rw-border bg-rw-card px-5 py-4"
            >
              <span className="bg-rw-muted-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-rw-sm text-base [&_svg]:text-lg">
                {s.icon}
              </span>
              <div>
                <div className="font-display text-2xl font-semibold leading-tight text-rw-fg">
                  <CountNumber target={s.value} />
                </div>
                <div className="mt-0.5 text-xs text-rw-fg-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 分类过滤 + 搜索 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            data-testid="staff-filter"
            options={[
              { value: "ALL", label: `全部 (${all.length})` },
              {
                value: "PUBLISHED",
                label: `在岗 (${all.filter((s) => s.status === "PUBLISHED").length})`,
              },
              { value: "DRAFT", label: `草稿 (${all.filter((s) => s.status === "DRAFT").length})` },
              {
                value: "OFFLINE",
                label: `下线 (${all.filter((s) => s.status === "OFFLINE").length})`,
              },
            ]}
          />
          <Input
            allowClear
            prefix={<SearchOutlined className="text-rw-fg-subtle" />}
            placeholder="搜索姓名 / 岗位 / 工号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            data-testid="staff-search"
            className="!w-64"
          />
        </div>

        <div data-testid="staff-table">
          {list.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-rw-md border border-rw-border bg-rw-card p-5">
                  <Skeleton avatar active paragraph={{ rows: 2 }} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-rw-md border border-rw-border bg-rw-card">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={keyword || filter !== "ALL" ? "没有符合条件的员工" : "还没有数字员工"}
                className="!my-6"
              >
                {filter === "ALL" && !keyword && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    创建第一位员工
                  </Button>
                )}
              </Empty>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((s, i) => (
                <div
                  key={s.id}
                  data-testid={`staff-card-${s.code}`}
                  onClick={() => router.push(`/staffs/${s.id}`)}
                  className="card-hover animate-fade-up flex cursor-pointer flex-col rounded-rw-md border border-rw-border bg-rw-card p-5"
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        size={44}
                        className={`!flex !shrink-0 !items-center !justify-center ${i % 3 === 0 ? "avatar-accent" : "bg-rw-muted-subtle text-rw-fg-muted"}`}
                      >
                        <span className="text-base font-medium">{s.name.slice(0, 1)}</span>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold text-rw-fg">
                          {s.name}
                        </div>
                        <div
                          className="mt-0.5 truncate font-mono text-xs text-rw-fg-subtle"
                          title={`${s.title} · ${s.code}`}
                        >
                          {s.title} · {s.code}
                        </div>
                      </div>
                    </div>
                    <StatusPill status={s.status as "PUBLISHED" | "DRAFT" | "OFFLINE"} />
                  </div>

                  <p className="mt-3.5 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-rw-fg-muted">
                    {s.personaPrompt}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rw-fg-subtle">
                    <Tag
                      bordered={false}
                      className="!m-0 !rounded-rw-sm !bg-rw-muted-subtle !text-[11px] !text-rw-fg-muted"
                    >
                      {s.visibility === "ORG"
                        ? "组织内"
                        : s.visibility === "GALLERY"
                          ? "广场"
                          : "私有"}
                    </Tag>
                    {s.publishedAt && <span>发布于 {s.publishedAt.slice(0, 10)}</span>}
                  </div>

                  <div
                    className="mt-4 flex items-center gap-2 border-t border-rw-border pt-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.status !== "PUBLISHED" ? (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<RocketOutlined />}
                        loading={publish.isPending && publish.variables === s.id}
                        onClick={() => publish.mutate(s.id)}
                        data-testid={`staff-publish-${s.code}`}
                      >
                        发布
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        type="primary"
                        icon={<SendOutlined />}
                        loading={startChat.isPending && startChat.variables === s.id}
                        onClick={() => startChat.mutate(s.id)}
                        data-testid={`staff-chat-${s.code}`}
                      >
                        发起对话
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(s)}
                      aria-label="编辑"
                      className="!rounded-rw-sm"
                    />
                    <Popconfirm
                      title="确认删除该员工？"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => remove.mutate(s.id)}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="删除"
                        className="!rounded-rw-sm"
                      />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal
          title={
            <span className="flex items-center gap-2">
              <EditOutlined className="text-rw-accent" />
              {editing ? `编辑：${editing.name}` : "新建数字员工"}
            </span>
          }
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={() => form.submit()}
          okText={editing ? "保存" : "创建"}
          cancelText="取消"
          confirmLoading={create.isPending || update.isPending}
          destroyOnHidden
          width={560}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) =>
              editing ? update.mutate({ id: editing.id, input: values }) : create.mutate(values)
            }
          >
            {!editing && (
              <Form.Item label="从模板开始（STAFF-002）" className="!mb-4">
                <Select
                  data-testid="staff-form-template"
                  placeholder="选择预置人设模板,一键预填（可改）"
                  allowClear
                  virtual={false}
                  options={PERSONA_TEMPLATES.map((t) => ({
                    value: t.key,
                    label: `${t.name} · ${t.title}`,
                  }))}
                  onChange={(key) => {
                    const tpl = key ? personaTemplateByKey(String(key)) : undefined;
                    if (!tpl) return;
                    form.setFieldsValue({
                      title: tpl.title,
                      personaPrompt: tpl.personaPrompt,
                      boundary: tpl.boundary,
                    });
                  }}
                />
              </Form.Item>
            )}
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: "请输入姓名" }]}
              >
                <Input data-testid="staff-form-name" placeholder="如：小兔" maxLength={128} />
              </Form.Item>
              <Form.Item
                name="title"
                label="岗位"
                rules={[{ required: true, message: "请输入岗位" }]}
              >
                <Input placeholder="如：售前咨询顾问" maxLength={128} />
              </Form.Item>
            </div>
            <Form.Item
              name="personaPrompt"
              label="人设（System Prompt）"
              rules={[{ required: true, message: "请输入人设" }]}
              extra="描述这位数字员工的性格、专长与说话风格——越具体越好"
            >
              <Input.TextArea
                data-testid="staff-form-persona"
                rows={6}
                placeholder={
                  "你是……\n- 说话风格：亲切、专业\n- 擅长：产品介绍、需求梳理\n- 回答习惯：先给结论，再给依据"
                }
                showCount
                maxLength={20000}
              />
            </Form.Item>
            <Form.Item
              name="boundary"
              label="职责边界（可选）"
              extra="不回答的问题范围、转人工条件等"
            >
              <Input.TextArea
                rows={3}
                placeholder="不承诺具体价格与合同条款；遇到投诉建议转人工。"
                maxLength={20000}
              />
            </Form.Item>
            <Form.Item name="visibility" label="可见性" initialValue="PRIVATE" className="!mb-0">
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
      </div>
    </AppShell>
  );
}
