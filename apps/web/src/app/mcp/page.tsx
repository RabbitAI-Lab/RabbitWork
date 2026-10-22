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
  Table,
  Tag,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { mcpApi } from "@rabbit/api-client";
import type { McpDto } from "@rabbit/shared";

const TRANSPORT_COLOR: Record<string, string> = {
  streamable_http: "green",
  sse: "orange",
  builtin: "default",
};

/** MCP 服务配置页（TOOL-002 §3）：列表 + 新建/编辑 + 连通性测试。 */
export default function McpPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<McpDto | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; transport: string; endpoint: string }>();
  const [testing, setTesting] = useState<McpDto | null>(null);
  const [result, setResult] = useState<{ status: number; tookMs: number; bodyText: string } | null>(
    null,
  );

  const list = useQuery({ queryKey: ["mcps"], queryFn: () => mcpApi.list() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["mcps"] });
  const create = useMutation({
    mutationFn: (v: { name: string; transport: string; endpoint: string }) =>
      mcpApi.create({ ...v, transport: v.transport as "streamable_http", config: {} }),
    onSuccess: () => {
      message.success("MCP 服务已注册");
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "注册失败"),
  });
  const update = useMutation({
    mutationFn: (v: { name: string; transport: string; endpoint: string }) =>
      mcpApi.update(editing!.id, { ...v, transport: v.transport as "streamable_http" }),
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mcpApi.remove(id),
    onSuccess: () => {
      message.success("已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });
  const test = useMutation({
    mutationFn: (id: string) => mcpApi.test(id),
    onSuccess: (r) => setResult(r),
    onError: (e) => message.error(e instanceof Error ? e.message : "测试失败"),
  });

  return (
    <AppShell active="mcp">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="mcp-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              MCP 服务
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              注册 MCP 服务器并验证连通性——运行时消费随执行引擎接入
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
            data-testid="mcp-create-btn"
          >
            注册 MCP 服务
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table<McpDto>
            data-testid="mcp-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有 MCP 服务——注册第一个并测试连通"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "传输",
                dataIndex: "transport",
                width: 140,
                render: (t: string) => (
                  <Tag bordered={false} color={TRANSPORT_COLOR[t]}>
                    {t}
                  </Tag>
                ),
              },
              {
                title: "名称 / endpoint",
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-rw-fg">{r.name}</div>
                    <div className="truncate font-mono text-xs text-rw-fg-subtle">{r.endpoint}</div>
                  </div>
                ),
              },
              {
                title: "操作",
                width: 210,
                align: "right",
                render: (_, r) => (
                  <>
                    <Button
                      type="text"
                      size="small"
                      disabled={r.transport === "builtin"}
                      onClick={() => {
                        setTesting(r);
                        setResult(null);
                      }}
                    >
                      测试
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setEditing(r);
                        form.setFieldsValue({
                          name: r.name,
                          transport: r.transport,
                          endpoint: r.endpoint,
                        });
                        setOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除该 MCP 服务？"
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
          title={editing ? `编辑：${editing.name}` : "注册 MCP 服务"}
          open={open}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
          okText={editing ? "保存" : "注册"}
          cancelText="取消"
          confirmLoading={create.isPending || update.isPending}
          destroyOnHidden
          width={560}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ transport: "streamable_http" }}
            onFinish={(v) => (editing ? update.mutate(v) : create.mutate(v))}
          >
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
              <Input data-testid="mcp-form-name" placeholder="如：文档知识 MCP" maxLength={128} />
            </Form.Item>
            <Form.Item name="transport" label="传输" rules={[{ required: true }]}>
              <Select
                virtual={false}
                options={[
                  { value: "streamable_http", label: "streamable_http" },
                  { value: "sse", label: "sse" },
                  { value: "builtin", label: "builtin（内置）" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="endpoint"
              label="endpoint（http(s)）"
              rules={[{ required: true, message: "请输入 endpoint" }]}
              className="!mb-0"
            >
              <Input
                data-testid="mcp-form-endpoint"
                className="font-mono text-[13px]"
                placeholder="https://mcp.example.com/mcp"
                maxLength={512}
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={testing ? `连通性测试：${testing.name}` : "连通性测试"}
          open={testing !== null}
          onCancel={() => setTesting(null)}
          footer={null}
          destroyOnHidden
          width={640}
        >
          {result ? (
            <>
              <p className="text-rw-fg-subtle mb-1 text-xs tabular-nums">
                {result.status} · {result.tookMs}ms
              </p>
              <pre
                data-testid="mcp-test-result"
                className="bg-rw-muted-subtle text-rw-fg max-h-64 overflow-auto rounded-rw-md border border-rw-border p-3 font-mono text-xs whitespace-pre-wrap"
              >
                {result.bodyText || "（空响应体）"}
              </pre>
            </>
          ) : (
            <div className="py-6 text-center">
              <Button
                type="primary"
                loading={test.isPending}
                data-testid="mcp-test-run"
                onClick={() => testing && test.mutate(testing.id)}
              >
                发起连通性测试
              </Button>
              <p className="text-rw-fg-subtle mt-2 text-xs">经平台出站守卫（私网默认拒绝）</p>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
