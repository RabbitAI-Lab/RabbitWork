"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Switch,
  Table,
  Tag,
} from "antd";
import { CopyOutlined, KeyOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { authApi, userApi } from "@rabbit/api-client";
import type { UserDto } from "@rabbit/shared";

/** 用户管理页（SYS-002 §3）。 */
export default function UsersPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ email: string; name: string; role: string; password?: string }>();
  const [reveal, setReveal] = useState<{ title: string; password: string } | null>(null);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    staleTime: 60_000,
    retry: false,
  });

  const list = useQuery({ queryKey: ["users"], queryFn: () => userApi.list() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: (v: { email: string; name: string; role: string; password?: string }) =>
      userApi.create({ ...v, role: v.role as "MEMBER" }),
    onSuccess: (u) => {
      setReveal({ title: u.email, password: u.password });
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; data: Parameters<typeof userApi.update>[1] }) =>
      userApi.update(input.id, input.data),
    onSuccess: () => {
      message.success("已保存");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const resetPwd = useMutation({
    mutationFn: (id: string) => userApi.resetPassword(id),
    onSuccess: (r, id) => {
      const email = list.data?.items.find((u) => u.id === id)?.email ?? "";
      setReveal({ title: email, password: r.password });
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "重置失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      message.success("已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });

  const myId = me.data?.id;

  return (
    <AppShell active="users">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="users-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              用户管理
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              组织成员与角色——初始密码仅创建时展示一次
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
            data-testid="user-create-btn"
          >
            创建用户
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table<UserDto>
            data-testid="users-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="没有用户"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "邮箱 / 姓名",
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] text-rw-fg">{r.email}</div>
                    <div className="text-xs text-rw-fg-subtle">
                      {r.name}
                      {r.id === myId && "（我）"}
                    </div>
                  </div>
                ),
              },
              {
                title: "角色",
                dataIndex: "role",
                width: 100,
                render: (v: string) => (
                  <Tag bordered={false} color={v === "ADMIN" ? "success" : "default"}>
                    {v}
                  </Tag>
                ),
              },
              {
                title: "启用",
                dataIndex: "status",
                width: 80,
                render: (v: string, r) => (
                  <Switch
                    size="small"
                    checked={v === "ACTIVE"}
                    disabled={r.id === myId}
                    onChange={(nv) =>
                      update.mutate({ id: r.id, data: { status: nv ? "ACTIVE" : "DISABLED" } })
                    }
                  />
                ),
              },
              {
                title: "创建",
                dataIndex: "createdAt",
                width: 120,
                render: (v: string) => (
                  <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                    {v.slice(0, 10)}
                  </span>
                ),
              },
              {
                title: "操作",
                width: 220,
                align: "right",
                render: (_, r) =>
                  r.id === myId ? (
                    <span className="text-rw-fg-subtle text-xs">自己（保护）</span>
                  ) : (
                    <>
                      <Button
                        type="text"
                        size="small"
                        onClick={() =>
                          update.mutate({
                            id: r.id,
                            data: { role: r.role === "ADMIN" ? "MEMBER" : "ADMIN" },
                          })
                        }
                      >
                        {r.role === "ADMIN" ? "降为成员" : "升为管理员"}
                      </Button>
                      <Button type="text" size="small" onClick={() => resetPwd.mutate(r.id)}>
                        重置密码
                      </Button>
                      <Popconfirm
                        title="删除该用户？"
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                        onConfirm={() => remove.mutate(r.id)}
                      >
                        <Button type="text" size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </>
                  ),
              },
            ]}
          />
        </div>

        <Modal
          title="创建用户"
          open={open}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
          okText="创建"
          cancelText="取消"
          confirmLoading={create.isPending}
          destroyOnHidden
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(v) => create.mutate(v)}
          >
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "邮箱格式不正确" },
              ]}
            >
              <Input
                data-testid="user-form-email"
                placeholder="zhang@company.com"
                maxLength={256}
              />
            </Form.Item>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
              <Input data-testid="user-form-name" placeholder="张三" maxLength={128} />
            </Form.Item>
            <Form.Item name="role" label="角色" initialValue="MEMBER">
              <Select
                virtual={false}
                options={[
                  { value: "MEMBER", label: "MEMBER（成员:只读+对话）" },
                  { value: "ADMIN", label: "ADMIN（管理员:全量）" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="初始密码(可选)"
              className="!mb-0"
              extra="留空自动生成——创建后一次性展示"
            >
              <Input.Password placeholder="8-64 位" maxLength={64} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 一次性密码展示 */}
        <Modal
          title={
            <span className="flex items-center gap-2">
              <KeyOutlined className="text-rw-accent" />
              密码仅此一次展示——{reveal?.title}
            </span>
          }
          open={reveal !== null}
          onCancel={() => setReveal(null)}
          footer={
            <Button type="primary" onClick={() => setReveal(null)}>
              我已保存,关闭
            </Button>
          }
          destroyOnHidden
        >
          <p className="text-rw-warning mb-2 text-xs">⚠ 关闭后无法再查看,请立即复制交付给用户</p>
          <div
            className="bg-rw-accent-subtle text-rw-accent rounded-rw-md px-4 py-3 font-mono text-sm break-all"
            data-testid="password-reveal"
          >
            {reveal?.password}
          </div>
          <Button
            icon={<CopyOutlined />}
            className="mt-3"
            onClick={() => {
              if (reveal) {
                void navigator.clipboard.writeText(reveal.password);
                message.success("已复制");
              }
            }}
          >
            复制
          </Button>
        </Modal>
      </div>
    </AppShell>
  );
}
