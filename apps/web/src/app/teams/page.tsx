"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { App, Button, Empty, Form, Input, Modal, Skeleton } from "antd";
import { PlusOutlined, TeamOutlined, ArrowRightOutlined, CrownOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { teamApi } from "@rabbit/api-client";
import type { TeamCreateInput } from "@rabbit/shared";

/** 我的团队（DS v2.1）:团队列表 + 创建。 */
export default function TeamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<TeamCreateInput>();

  const list = useQuery({ queryKey: ["teams"], queryFn: () => teamApi.list({ pageSize: 50 }) });
  const create = useMutation({
    mutationFn: (input: TeamCreateInput) => teamApi.create(input),
    onSuccess: () => {
      message.success("团队已创建,去添加成员吧");
      setOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });

  return (
    <AppShell active="teams">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="teams-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              我的团队
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              组建数字员工团队,指定项目领导(TL)协同工作
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
            data-testid="team-create-btn"
          >
            新建团队
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="team-list">
          {list.isLoading ? (
            [0, 1].map((i) => (
              <div key={i} className="rounded-rw-md border border-rw-border bg-rw-card p-5">
                <Skeleton avatar active paragraph={{ rows: 2 }} />
              </div>
            ))
          ) : (list.data?.items.length ?? 0) === 0 ? (
            <div className="col-span-full rounded-rw-md border border-rw-border bg-rw-card p-12">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有团队——组建第一支数字员工团队"
                className="!my-4"
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
                  新建团队
                </Button>
              </Empty>
            </div>
          ) : (
            list.data?.items.map((t, i) => (
              <button
                key={t.id}
                type="button"
                data-testid={`team-card-${t.name}`}
                onClick={() => router.push(`/teams/${t.id}`)}
                className="card-hover animate-fade-up group flex flex-col rounded-rw-md border border-rw-border bg-rw-card p-5 text-left"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-rw-accent-subtle text-rw-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-rw-md text-lg">
                    <TeamOutlined />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-rw-fg">
                        {t.name}
                      </span>
                      {t.leaderName && (
                        <span className="bg-rw-warning-subtle text-rw-warning inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                          <CrownOutlined />
                          {t.leaderName}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-rw-fg-subtle">
                      {t.description || t.goal || "暂无描述"}
                    </div>
                  </div>
                  <ArrowRightOutlined className="text-rw-fg-subtle shrink-0 transition-colors duration-[140ms] ease-out group-hover:text-rw-accent" />
                </div>
                <div className="border-rw-border text-rw-fg-subtle mt-4 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="tabular-nums">{t.memberCount} 名成员</span>
                  <span className="tabular-nums">创建于 {t.createdAt.slice(0, 10)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <Modal
          title={
            <span className="flex items-center gap-2">
              <TeamOutlined className="text-rw-accent" />
              新建团队
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
              label="团队名称"
              rules={[{ required: true, message: "请输入团队名称" }]}
            >
              <Input data-testid="team-form-name" placeholder="如:内容创作组" maxLength={128} />
            </Form.Item>
            <Form.Item name="description" label="团队简介(可选)">
              <Input placeholder="一句话说明团队的职责" maxLength={512} />
            </Form.Item>
            <Form.Item name="goal" label="团队目标(可选)" className="!mb-0">
              <Input.TextArea rows={2} placeholder="如:每周产出 5 篇优质内容" maxLength={1024} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppShell>
  );
}
