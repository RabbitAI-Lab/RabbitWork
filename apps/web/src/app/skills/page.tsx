"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton } from "antd";
import { PlusOutlined, ThunderboltFilled } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { skillApi } from "@rabbit/api-client";
import type { SkillCreateInput, SkillDto } from "@rabbit/shared";

/** 技能管理页（SKILL-001 §3）：PROMPT 模板卡片 + 新建/编辑弹窗；SOP 随 SKILL-002 启用。 */
export default function SkillsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<SkillDto | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<SkillCreateInput>();

  const list = useQuery({ queryKey: ["skills"], queryFn: () => skillApi.list() });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["skills"] });
  const create = useMutation({
    mutationFn: (input: SkillCreateInput) => skillApi.create(input),
    onSuccess: () => {
      message.success("技能已创建");
      setOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SkillCreateInput }) =>
      skillApi.update(id, input),
    onSuccess: () => {
      message.success("已保存");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => skillApi.remove(id),
    onSuccess: () => {
      message.success("技能已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const openEdit = (s: SkillDto) => {
    setEditing(s);
    form.setFieldsValue({
      name: s.name,
      description: s.description ?? undefined,
      promptTemplate: s.promptTemplate ?? undefined,
    });
    setOpen(true);
  };

  return (
    <AppShell active="skills">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="skills-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">技能</h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              提示词技能（模板）——绑定给数字员工即可复用
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={openCreate}
            data-testid="skill-create-btn"
          >
            新建技能
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="skill-list">
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
                description="还没有技能——创建第一个提示词模板"
                className="!my-4"
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  新建技能
                </Button>
              </Empty>
            </div>
          ) : (
            list.data?.items.map((s, i) => (
              <div
                key={s.id}
                className="card-hover animate-fade-up flex flex-col rounded-rw-md border border-rw-border bg-rw-card p-5"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                data-testid={`skill-card-${s.name}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-rw-fg truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="bg-rw-success-subtle text-rw-success inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                    <ThunderboltFilled />
                    {s.kind}
                  </span>
                </div>
                <p className="text-rw-fg-muted min-h-10 text-[13px]">
                  {s.description || "暂无简介"}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-rw-border pt-3">
                  <span className="text-rw-fg-subtle text-xs tabular-nums">v{s.version}</span>
                  <div className="flex gap-1">
                    <Button type="text" size="small" onClick={() => openEdit(s)}>
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除该技能？"
                      description="员工的既有绑定将同时解除。"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => remove.mutate(s.id)}
                    >
                      <Button type="text" size="small" danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Modal
          title={editing ? `编辑技能：${editing.name}` : "新建技能"}
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
            onFinish={(values) =>
              editing
                ? update.mutate({ id: editing.id, input: values })
                : create.mutate({ ...values, kind: "PROMPT" })
            }
          >
            <div className="grid grid-cols-2 gap-x-4">
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: "请输入技能名称" }]}
              >
                <Input data-testid="skill-form-name" placeholder="如：周报生成" maxLength={128} />
              </Form.Item>
              <Form.Item name="description" label="简介(可选)">
                <Input placeholder="一句话说明用途" maxLength={512} />
              </Form.Item>
            </div>
            <Form.Item
              name="promptTemplate"
              label="模板正文（System 段追加）"
              rules={[{ required: true, message: "请输入模板正文" }]}
              extra="支持占位符 {{输入}} 随 SKILL-002 演进"
            >
              <Input.TextArea
                data-testid="skill-form-template"
                rows={6}
                className="font-mono text-[13px]"
                maxLength={20000}
                placeholder={"你将收到……按以下结构输出：\n一、……\n二、……"}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppShell>
  );
}
