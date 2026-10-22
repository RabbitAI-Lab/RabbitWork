"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { App, Button, Empty, Form, Input, Modal, Skeleton } from "antd";
import { BookOutlined, PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { kbApi } from "@rabbit/api-client";
import type { KbCreateInput } from "@rabbit/shared";

/** 知识库列表（KNW-001 §3-A）：卡片（文档数/切片数/状态）+ 新建弹窗。 */
export default function KnowledgePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<KbCreateInput>();

  const list = useQuery({ queryKey: ["kbs"], queryFn: () => kbApi.list() });
  const create = useMutation({
    mutationFn: (input: KbCreateInput) => kbApi.create(input),
    onSuccess: () => {
      message.success("知识库已创建,去上传第一篇文档吧");
      setOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["kbs"] });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });

  return (
    <AppShell active="knowledge">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="knowledge-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              知识库
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              沉淀团队知识,绑定给数字员工后回答有据可依
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
            data-testid="kb-create-btn"
          >
            新建知识库
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="kb-list">
          {list.isLoading ? (
            [0, 1].map((i) => (
              <div key={i} className="rounded-rw-md border border-rw-border bg-rw-card p-5">
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ))
          ) : (list.data?.items.length ?? 0) === 0 ? (
            <div className="col-span-full rounded-rw-md border border-rw-border bg-rw-card p-12">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有知识库——创建第一个并上传文档"
                className="!my-4"
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
                  新建知识库
                </Button>
              </Empty>
            </div>
          ) : (
            list.data?.items.map((kb, i) => (
              <button
                key={kb.id}
                type="button"
                data-testid={`kb-card-${kb.name}`}
                onClick={() => router.push(`/knowledge/${kb.id}`)}
                className="card-hover animate-fade-up flex flex-col rounded-rw-md border border-rw-border bg-rw-card p-5 text-left"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-rw-accent-subtle text-rw-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-rw-md text-lg">
                    <BookOutlined />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-rw-fg block truncate text-[15px] font-semibold">
                      {kb.name}
                    </span>
                    <span className="text-rw-fg-subtle mt-0.5 block truncate text-xs">
                      {kb.description || "暂无描述"}
                    </span>
                  </div>
                </div>
                <div className="text-rw-fg-subtle mt-4 flex items-center justify-between border-t border-rw-border pt-3 text-xs tabular-nums">
                  <span>
                    {kb.documentCount} 篇文档 · {kb.chunkCount} 切片
                  </span>
                  <span>更新于 {kb.updatedAt.slice(0, 10)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <Modal
          title={
            <span className="flex items-center gap-2">
              <BookOutlined className="text-rw-accent" />
              新建知识库
            </span>
          }
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
              name="name"
              label="名称"
              rules={[{ required: true, message: "请输入知识库名称" }]}
            >
              <Input data-testid="kb-form-name" placeholder="如:产品手册" maxLength={128} />
            </Form.Item>
            <Form.Item name="description" label="简介(可选)" className="!mb-0">
              <Input placeholder="一句话说明知识范围" maxLength={512} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppShell>
  );
}
