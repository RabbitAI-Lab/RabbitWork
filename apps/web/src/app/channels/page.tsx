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
  Switch,
  Table,
  Tag,
} from "antd";
import { CopyOutlined, KeyOutlined, PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { channelApi, staffApi } from "@rabbit/api-client";
import type { ChannelDto } from "@rabbit/shared";
import type { ChannelRow } from "@rabbit/api-client";

const PLATFORM_COLOR: Record<string, string> = {
  feishu: "green",
  dingtalk: "blue",
  wecom: "orange",
};

const PLATFORM_LABEL: Record<string, string> = {
  feishu: "飞书",
  dingtalk: "钉钉",
  wecom: "企微",
};

/** 渠道接入页（CHNL-001 §3）：IM webhook 渠道管理 + token 一次性展示。 */
export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<ChannelDto | null>(null);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<(ChannelRow & { token: string }) | null>(null);
  const [form] = Form.useForm<{ name: string; platform: string; employeeId: string }>();

  const list = useQuery({ queryKey: ["channels"], queryFn: () => channelApi.list() });
  const staffs = useQuery({
    queryKey: ["staffs", "published"],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["channels"] });

  const create = useMutation({
    mutationFn: (v: { name: string; platform: string; employeeId: string }) =>
      channelApi.create({ ...v, platform: v.platform as "feishu" }),
    onSuccess: (c) => {
      setCreated(c);
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; data: Partial<{ name: string; enabled: boolean }> }) =>
      channelApi.update(input.id, input.data),
    onSuccess: () => invalidate(),
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => channelApi.remove(id),
    onSuccess: () => {
      message.success("渠道已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });

  const employees = (staffs.data?.items ?? []).filter((s) => s.status === "PUBLISHED");
  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? id.slice(0, 8);

  return (
    <AppShell active="channels">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="channels-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              渠道接入
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              IM 机器人 webhook——外部消息进入绑定员工的会话（回复经平台查看,出站推送随 IM 凭据接入）
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
            data-testid="channel-create-btn"
          >
            新建渠道
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table<ChannelDto>
            data-testid="channels-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有渠道——创建第一个并配置到 IM 机器人"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "平台",
                dataIndex: "platform",
                width: 100,
                render: (p: string) => (
                  <Tag bordered={false} color={PLATFORM_COLOR[p]}>
                    {PLATFORM_LABEL[p] ?? p}
                  </Tag>
                ),
              },
              {
                title: "名称 / 绑定员工",
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-rw-fg">{r.name}</div>
                    <div className="text-xs text-rw-fg-subtle">→ {empName(r.employeeId)}</div>
                  </div>
                ),
              },
              {
                title: "启用",
                dataIndex: "enabled",
                width: 80,
                render: (v: boolean, r) => (
                  <Switch
                    size="small"
                    checked={v}
                    onChange={(nv) => update.mutate({ id: r.id, data: { enabled: nv } })}
                  />
                ),
              },
              {
                title: "最近消息",
                dataIndex: "lastMessageAt",
                width: 140,
                render: (v: string | null) => (
                  <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                    {v ? v.replace("T", " ").slice(5, 16) : "—"}
                  </span>
                ),
              },
              {
                title: "操作",
                width: 120,
                align: "right",
                render: (_, r) => (
                  <Popconfirm
                    title="删除该渠道？"
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={() => remove.mutate(r.id)}
                  >
                    <Button type="text" size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        </div>

        <Modal
          title="新建渠道"
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
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
              <Input data-testid="channel-form-name" placeholder="如：售后客服群" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="platform"
              label="平台"
              initialValue="feishu"
              rules={[{ required: true }]}
            >
              <Select
                virtual={false}
                options={[
                  { value: "feishu", label: "飞书" },
                  { value: "dingtalk", label: "钉钉" },
                  { value: "wecom", label: "企业微信" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="employeeId"
              label="绑定员工（消息进入该员工会话）"
              rules={[{ required: true, message: "请选择员工" }]}
              className="!mb-0"
            >
              <Select
                virtual={false}
                placeholder="选择已发布员工"
                showSearch
                optionFilterProp="label"
                options={employees.map((s) => ({ value: s.id, label: `${s.name}(${s.title})` }))}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* token 一次性展示（同 APIKEY 模式） */}
        <Modal
          title={
            <span className="flex items-center gap-2">
              <KeyOutlined className="text-rw-accent" />
              渠道已创建——webhook 地址与 token
            </span>
          }
          open={created !== null}
          onCancel={() => setCreated(null)}
          footer={
            <Button type="primary" onClick={() => setCreated(null)}>
              我已保存,关闭
            </Button>
          }
          destroyOnHidden
        >
          <p className="text-rw-warning mb-1 text-xs">⚠ token 仅此一次展示</p>
          <div className="bg-rw-accent-subtle text-rw-accent rounded-rw-md mb-3 break-all px-3 py-2 font-mono text-xs">
            POST /api/open/v1/channels/{created?.token}/messages
          </div>
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              if (created) {
                void navigator.clipboard.writeText(created.token);
                message.success("token 已复制");
              }
            }}
          >
            复制 token
          </Button>
          <p className="text-rw-fg-subtle mt-3 text-xs">
            消息体宽松兼容：{"{text, user}"} / 钉钉 {"{text:{content}, senderStaffId}"} / 飞书
            event.message.content
          </p>
        </Modal>
      </div>
    </AppShell>
  );
}
