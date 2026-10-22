"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { App, Button, Empty, Form, Input, Modal, Select, Skeleton, Switch } from "antd";
import { PlusOutlined, TeamOutlined, ArrowRightOutlined, CrownOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { staffApi, teamApi } from "@rabbit/api-client";
import type { TeamCreateInput, TeamDto } from "@rabbit/shared";

/** 同步徽标三态（TEAM-001 §2.1 状态机派生）。 */
function SyncBadge({ team }: { team: TeamDto }) {
  if (team.syncState === "SYNCED") {
    return (
      <span
        className="bg-rw-success-subtle text-rw-success inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
        data-testid={`team-sync-badge-${team.name}`}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rw-success" />
        运行面已同步
      </span>
    );
  }
  if (team.syncState === "SYNC_FAILED") {
    return (
      <span
        className="bg-rw-warning-subtle text-rw-warning inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
        data-testid={`team-sync-badge-${team.name}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rw-warning" />
        同步失败
      </span>
    );
  }
  return (
    <span
      className="bg-rw-muted-subtle text-rw-fg-muted inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
      data-testid={`team-sync-badge-${team.name}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rw-fg-subtle" />
      未同步
    </span>
  );
}

type CreateForm = TeamCreateInput & { syncToRuntime: boolean };

/** 我的团队（DS v2.1）：团队列表 + 创建（TEAM-001：可选 TL 随建同步运行面）。 */
export default function TeamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<CreateForm>();
  const leaderId = Form.useWatch("leaderEmployeeId", form);

  const list = useQuery({ queryKey: ["teams"], queryFn: () => teamApi.list({ pageSize: 50 }) });
  const staffs = useQuery({
    queryKey: ["staffs", "published"],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });
  const create = useMutation({
    mutationFn: (input: CreateForm) => teamApi.create(input),
    onSuccess: () => {
      message.success("团队已创建,去添加成员吧");
      setOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });

  // TL 候选：仅已发布员工（有运行面身份；后端同样校验）
  const leaders = (staffs.data?.items ?? []).filter((s) => s.status === "PUBLISHED");

  return (
    <AppShell active="teams">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="teams-page">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-rw-fg">
                        {t.name}
                      </span>
                      {t.leaderName && (
                        <span className="bg-rw-warning-subtle text-rw-warning inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                          <CrownOutlined />
                          {t.leaderName}
                        </span>
                      )}
                      <SyncBadge team={t} />
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
            initialValues={{ syncToRuntime: true }}
            onFinish={(v) =>
              create.mutate({
                ...v,
                // 未选 TL 时同步开关无意义（无运行面身份），按仅本地建队提交（TEAM-001 §2.2.1）
                syncToRuntime: Boolean(v.syncToRuntime && v.leaderEmployeeId),
                leaderEmployeeId: v.leaderEmployeeId || undefined,
              })
            }
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
            <Form.Item name="goal" label="团队目标(可选)">
              <Input.TextArea rows={2} placeholder="如:每周产出 5 篇优质内容" maxLength={1024} />
            </Form.Item>
            <Form.Item
              name="leaderEmployeeId"
              label="项目领导(TL,可选)"
              extra="TL 决定运行面 leaderAgentId;须为已发布数字员工,可创建后再设置"
            >
              <Select
                data-testid="team-form-leader"
                placeholder="选择已发布的数字员工"
                allowClear
                virtual={false}
                options={leaders.map((s) => ({
                  value: s.id,
                  label: `${s.name}(${s.title})`,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="syncToRuntime"
              label="同步至 AgentScope 运行面"
              valuePropName="checked"
              className="!mb-0"
              extra={
                leaderId
                  ? "创建即在运行面建立同名团队(leaderAgentId = TL);上游失败不阻塞创建"
                  : "选择 TL 后才会真正同步;当前将仅本地建队"
              }
            >
              <Switch data-testid="team-form-sync" disabled={!leaderId} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppShell>
  );
}
