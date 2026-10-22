"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Form, Input, Modal, Popconfirm, Skeleton, Table, Tag } from "antd";
import { CopyOutlined, KeyOutlined, PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiKeyApi } from "@rabbit/api-client";
import type { ApiKeyCreatedDto } from "@rabbit/shared";

/** API Key 管理（OBS-003 §3）：列表 + 创建（明文一次性展示）+ 吊销。 */
export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreatedDto | null>(null);
  const [form] = Form.useForm<{ name: string; expiresInDays?: number }>();

  const list = useQuery({ queryKey: ["apikeys"], queryFn: () => apiKeyApi.list() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["apikeys"] });
  const create = useMutation({
    mutationFn: (v: { name: string; expiresInDays?: number }) => apiKeyApi.create(v),
    onSuccess: (k) => {
      setCreated(k);
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => {
      message.success("已吊销（立即生效）");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "吊销失败"),
  });

  return (
    <AppShell active="office">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="apikeys-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              API Key
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              rw_live_ 密钥用于开放 API（Bearer）——明文仅创建时展示一次
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
            data-testid="apikey-create-btn"
          >
            创建 Key
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table
            data-testid="apikey-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有 API Key——创建第一个接入开放 API"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "名称",
                render: (_, r) => (
                  <span className="text-[13px] font-medium text-rw-fg">{r.name}</span>
                ),
              },
              {
                title: "Key",
                dataIndex: "keyPrefix",
                width: 160,
                render: (p: string) => <span className="font-mono text-xs">{p}…</span>,
              },
              {
                title: "状态",
                dataIndex: "revokedAt",
                width: 110,
                render: (rv: string | null) =>
                  rv ? (
                    <Tag bordered={false} color="default">
                      已吊销
                    </Tag>
                  ) : (
                    <Tag bordered={false} color="success">
                      有效
                    </Tag>
                  ),
              },
              {
                title: "最后使用",
                dataIndex: "lastUsedAt",
                width: 150,
                render: (v: string | null) => (
                  <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                    {v ? v.replace("T", " ").slice(5, 16) : "—"}
                  </span>
                ),
              },
              {
                title: "操作",
                width: 100,
                align: "right",
                render: (_, r) =>
                  r.revokedAt ? null : (
                    <Popconfirm
                      title="吊销该 Key？"
                      description="使用此 Key 的集成将立即失去访问。"
                      okText="吊销"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => revoke.mutate(r.id)}
                    >
                      <Button type="text" size="small" danger>
                        吊销
                      </Button>
                    </Popconfirm>
                  ),
              },
            ]}
          />
        </div>

        <Modal
          title="创建 API Key"
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
              <Input data-testid="apikey-form-name" placeholder="如：CI 渠道" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="expiresInDays"
              label="有效期(天,可选)"
              className="!mb-0"
              extra="留空即永久;建议 90 天轮换"
            >
              <Input type="number" min={1} max={3650} placeholder="90" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 一次性明文展示（OBS-003 §3-B） */}
        <Modal
          title={
            <span className="flex items-center gap-2">
              <KeyOutlined className="text-rw-accent" />
              Key 已创建——请立即复制
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
          <p className="text-rw-warning mb-2 text-xs">⚠ 关闭后将无法再次查看</p>
          <div
            className="bg-rw-accent-subtle text-rw-accent rounded-rw-md break-all px-4 py-3 font-mono text-sm"
            data-testid="apikey-plaintext"
          >
            {created?.plaintext}
          </div>
          <Button
            icon={<CopyOutlined />}
            className="mt-3"
            onClick={() => {
              if (created) {
                void navigator.clipboard.writeText(created.plaintext);
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
