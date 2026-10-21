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
import { toolApi } from "@rabbit/api-client";
import type { ToolDto } from "@rabbit/shared";

const METHOD_COLOR: Record<string, string> = {
  GET: "green",
  POST: "blue",
  PUT: "orange",
  PATCH: "cyan",
  DELETE: "red",
};

/** 工具管理页（TOOL-001 §3）：列表 + 新建/编辑 + 试运行面板。 */
export default function ToolsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<ToolDto | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{
    name: string;
    description?: string;
    method: string;
    url: string;
  }>();
  const [testing, setTesting] = useState<ToolDto | null>(null);
  const [paramsText, setParamsText] = useState("{}");
  const [result, setResult] = useState<{
    status: number;
    tookMs: number;
    truncated: boolean;
    bodyText: string;
  } | null>(null);

  const list = useQuery({ queryKey: ["tools"], queryFn: () => toolApi.list() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["tools"] });
  const create = useMutation({
    mutationFn: (v: { name: string; description?: string; method: string; url: string }) =>
      toolApi.create({ ...v, method: v.method as ToolDto["method"], headers: {} }),
    onSuccess: () => {
      message.success("工具已创建");
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });
  const update = useMutation({
    mutationFn: (v: { name: string; description?: string; method: string; url: string }) =>
      toolApi.update(editing!.id, { ...v, method: v.method as ToolDto["method"] }),
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => toolApi.remove(id),
    onSuccess: () => {
      message.success("工具已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });

  const runTest = async () => {
    if (!testing) return;
    setResult(null);
    try {
      const params = JSON.parse(paramsText || "{}") as Record<string, unknown>;
      setResult(await toolApi.testRun(testing.id, { params }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : "试运行失败");
    }
  };

  return (
    <AppShell active="tools">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="tools-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">工具</h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              HTTP 工具定义——试运行验证后绑定给数字员工使用
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
            data-testid="tool-create-btn"
          >
            新建工具
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table<ToolDto>
            data-testid="tools-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有工具——创建第一个 HTTP 工具并试运行验证"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "方法",
                dataIndex: "method",
                width: 90,
                render: (m: string) => (
                  <Tag bordered={false} color={METHOD_COLOR[m]}>
                    {m}
                  </Tag>
                ),
              },
              {
                title: "名称 / URL",
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-rw-fg">{r.name}</div>
                    <div className="truncate font-mono text-xs text-rw-fg-subtle">{r.url}</div>
                  </div>
                ),
              },
              {
                title: "操作",
                width: 200,
                align: "right",
                render: (_, r) => (
                  <>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setTesting(r);
                        setParamsText("{}");
                        setResult(null);
                      }}
                    >
                      试运行
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setEditing(r);
                        form.setFieldsValue({
                          name: r.name,
                          description: r.description ?? undefined,
                          method: r.method,
                          url: r.url,
                        });
                        setOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除该工具？"
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

        {/* 新建/编辑 */}
        <Modal
          title={editing ? `编辑工具：${editing.name}` : "新建工具"}
          open={open}
          onCancel={() => setOpen(false)}
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
            initialValues={{ method: "GET" }}
            onFinish={(v) => (editing ? update.mutate(v) : create.mutate(v))}
          >
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: "请输入名称" }]}
              >
                <Input data-testid="tool-form-name" placeholder="如：汇率查询" maxLength={128} />
              </Form.Item>
              <Form.Item name="method" label="方法" rules={[{ required: true }]}>
                <Select
                  virtual={false}
                  options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
                    value: m,
                    label: m,
                  }))}
                />
              </Form.Item>
            </div>
            <Form.Item
              name="url"
              label="URL（支持 {{参数}} 占位）"
              rules={[{ required: true, message: "请输入 URL" }]}
            >
              <Input
                data-testid="tool-form-url"
                className="font-mono text-[13px]"
                placeholder="https://api.example.com/fx?base={{币种}}"
                maxLength={512}
              />
            </Form.Item>
            <Form.Item name="description" label="简介(可选)" className="!mb-0">
              <Input placeholder="一句话说明用途" maxLength={512} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 试运行面板 */}
        <Modal
          title={testing ? `试运行：${testing.name}` : "试运行"}
          open={testing !== null}
          onCancel={() => setTesting(null)}
          footer={null}
          destroyOnHidden
          width={720}
        >
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-rw-fg-muted mb-1.5 text-xs">入参（渲染 {"{{占位}}"}）</p>
              <Input.TextArea
                data-testid="tool-testrun-params"
                rows={6}
                className="font-mono text-[13px]"
                value={paramsText}
                onChange={(e) => setParamsText(e.target.value)}
              />
              <Button
                type="primary"
                className="mt-3"
                data-testid="tool-testrun-run"
                onClick={() => void runTest()}
              >
                ▶ 试运行
              </Button>
              <p className="text-rw-fg-subtle mt-2 text-xs">
                经平台出站守卫（私网默认拒绝,TOOL_SSRF_ALLOWLIST 可放行）
              </p>
            </div>
            <div>
              <p className="text-rw-fg-muted mb-1.5 text-xs">响应</p>
              {result ? (
                <>
                  <p className="text-rw-fg-subtle mb-1 text-xs tabular-nums">
                    {result.status} · {result.tookMs}ms{result.truncated ? " · 已截断 4KB" : ""}
                  </p>
                  <pre
                    data-testid="tool-testrun-result"
                    className="bg-rw-muted-subtle text-rw-fg max-h-64 overflow-auto rounded-rw-md border border-rw-border p-3 font-mono text-xs whitespace-pre-wrap"
                  >
                    {result.bodyText}
                  </pre>
                </>
              ) : (
                <div className="bg-rw-muted-subtle rounded-rw-md border border-rw-border p-6 text-center text-xs text-rw-fg-subtle">
                  点击「试运行」查看响应
                </div>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
