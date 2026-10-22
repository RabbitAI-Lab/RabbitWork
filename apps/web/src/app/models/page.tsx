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
import { CrownFilled, PlusOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { modelApi } from "@rabbit/api-client";
import type { ModelDto, ModelVerifyResultDto } from "@rabbit/shared";

const PROTOCOL_COLOR: Record<string, string> = {
  openai_chat_completions: "green",
  anthropic: "orange",
  gemini: "blue",
};

function statusColor(s: string): string {
  switch (s) {
    case "VERIFIED":
      return "success";
    case "FAILED":
      return "error";
    case "VERIFYING":
      return "processing";
    default:
      return "default";
  }
}

/** 模型配置页（MODEL-001 §3）：列表 + 注册/编辑 + 一键验证 + 默认互斥。 */
export default function ModelsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<ModelDto | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{
    name: string;
    protocol: string;
    baseUrl: string;
    modelId: string;
    apiKey: string;
    isDefault?: boolean;
  }>();
  const [verifying, setVerifying] = useState<ModelDto | null>(null);
  const [verifyResult, setVerifyResult] = useState<ModelVerifyResultDto | null>(null);

  const list = useQuery({ queryKey: ["models"], queryFn: () => modelApi.list() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["models"] });

  const create = useMutation({
    mutationFn: (v: Parameters<typeof modelApi.create>[0]) => modelApi.create(v),
    onSuccess: () => {
      message.success("模型已注册——记得一键验证凭据");
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "注册失败"),
  });
  const update = useMutation({
    mutationFn: (v: Parameters<typeof modelApi.update>[1]) => modelApi.update(editing!.id, v),
    onSuccess: () => {
      message.success("已保存（连接参数变更后状态回到未验证）");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => modelApi.remove(id),
    onSuccess: () => {
      message.success("模型已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => modelApi.setDefault(id),
    onSuccess: () => {
      message.success("已设为默认模型");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "设置失败"),
  });
  const verify = useMutation({
    mutationFn: (id: string) => modelApi.verify(id),
    onSuccess: (r) => {
      setVerifyResult(r);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "验证失败"),
  });

  return (
    <AppShell active="models">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="models-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">模型</h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              协议化模型配置——一键验证凭据与连通后即可作为对话默认模型
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
            data-testid="model-create-btn"
          >
            注册模型
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table<ModelDto>
            data-testid="models-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有模型——注册第一个并验证连通"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "协议",
                dataIndex: "protocol",
                width: 200,
                render: (p: string) => (
                  <Tag bordered={false} color={PROTOCOL_COLOR[p]}>
                    {p}
                  </Tag>
                ),
              },
              {
                title: "名称 / 型号",
                render: (_, r) => (
                  <div className="flex min-w-0 items-center gap-2">
                    {r.isDefault && <CrownFilled className="shrink-0 text-rw-warning" />}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-rw-fg">
                        {r.name}
                        {r.isDefault && (
                          <span className="text-rw-fg-subtle ml-1 text-xs">默认</span>
                        )}
                      </div>
                      <div className="truncate font-mono text-xs text-rw-fg-subtle">
                        {r.modelId}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                title: "状态",
                dataIndex: "status",
                width: 130,
                render: (s: string) => (
                  <Tag bordered={false} color={statusColor(s)}>
                    {s}
                  </Tag>
                ),
              },
              {
                title: "操作",
                width: 260,
                align: "right",
                render: (_, r) => (
                  <>
                    <Button
                      type="text"
                      size="small"
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => {
                        setVerifying(r);
                        setVerifyResult(null);
                      }}
                    >
                      验证
                    </Button>
                    {!r.isDefault && (
                      <Button
                        type="text"
                        size="small"
                        onClick={() => setDefault.mutate(r.id)}
                        data-testid={`model-set-default-${r.name}`}
                      >
                        设默认
                      </Button>
                    )}
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setEditing(r);
                        form.setFieldsValue({
                          name: r.name,
                          protocol: r.protocol,
                          baseUrl: r.baseUrl,
                          modelId: r.modelId,
                          apiKey: r.apiKey,
                        });
                        setOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除该模型？"
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
            expandable={{
              rowExpandable: (r) => r.status === "FAILED" && Boolean(r.lastError),
              expandedRowRender: (r) => (
                <p
                  className="bg-rw-danger-subtle text-rw-danger rounded-rw-md px-4 py-3 font-mono text-xs"
                  data-testid="model-error-detail"
                >
                  {r.lastError}
                </p>
              ),
            }}
          />
        </div>

        <Modal
          title={editing ? `编辑模型：${editing.name}` : "注册模型"}
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
            initialValues={{ protocol: "openai_chat_completions" }}
            onFinish={(v) =>
              editing
                ? update.mutate({ ...v, protocol: v.protocol as "openai_chat_completions" })
                : create.mutate({ ...v, protocol: v.protocol as "openai_chat_completions" })
            }
          >
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: "请输入名称" }]}
              >
                <Input
                  data-testid="model-form-name"
                  placeholder="如：主力对话模型"
                  maxLength={128}
                />
              </Form.Item>
              <Form.Item name="protocol" label="协议" rules={[{ required: true }]}>
                <Select
                  virtual={false}
                  options={[
                    { value: "openai_chat_completions", label: "openai_chat_completions" },
                    { value: "anthropic", label: "anthropic" },
                    { value: "gemini", label: "gemini" },
                  ]}
                />
              </Form.Item>
            </div>
            <Form.Item
              name="baseUrl"
              label="Base URL（http(s)）"
              rules={[{ required: true, message: "请输入 Base URL" }]}
            >
              <Input
                data-testid="model-form-baseurl"
                className="font-mono text-[13px]"
                placeholder="https://api.openai.com/v1"
                maxLength={512}
              />
            </Form.Item>
            <Form.Item
              name="modelId"
              label="模型 ID"
              rules={[{ required: true, message: "请输入模型 ID" }]}
            >
              <Input
                data-testid="model-form-modelid"
                className="font-mono text-[13px]"
                placeholder="gpt-4o-mini"
                maxLength={128}
              />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label="API Key（AES-GCM 加密存储,永不回显明文）"
              rules={[{ required: true, message: "请输入 API Key" }]}
              className="!mb-0"
            >
              <Input.Password
                data-testid="model-form-apikey"
                placeholder={editing ? "••••••••（不改则沿用）" : "sk-..."}
                maxLength={512}
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={verifying ? `一键验证：${verifying.name}` : "一键验证"}
          open={verifying !== null}
          onCancel={() => setVerifying(null)}
          footer={null}
          destroyOnHidden
          width={640}
        >
          {verifyResult ? (
            <>
              <p className="mb-2 text-sm">
                {verifyResult.status === "VERIFIED" ? (
                  <span className="text-rw-success font-medium">✓ 验证通过</span>
                ) : (
                  <span className="text-rw-danger font-medium">✗ 验证失败</span>
                )}
                <span className="text-rw-fg-subtle ml-2 text-xs tabular-nums">
                  耗时 {verifyResult.tookMs}ms
                </span>
              </p>
              <pre
                data-testid="model-verify-result"
                className="bg-rw-muted-subtle text-rw-fg max-h-64 overflow-auto rounded-rw-md border border-rw-border p-3 font-mono text-xs whitespace-pre-wrap"
              >
                {verifyResult.error ?? verifyResult.replySnippet ?? "（空回复）"}
              </pre>
            </>
          ) : (
            <div className="py-6 text-center">
              <Button
                type="primary"
                loading={verify.isPending}
                data-testid="model-verify-run"
                onClick={() => verifying && verify.mutate(verifying.id)}
              >
                发起验证（最小对话请求,经出站守卫）
              </Button>
              <p className="text-rw-fg-subtle mt-2 text-xs">
                将按协议发送一次 max_tokens=1 的最小对话——验证凭据、连通与型号有效性
              </p>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
