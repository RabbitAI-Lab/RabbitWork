"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Input, Modal, Skeleton, Table, Tabs, Tag } from "antd";
import { CheckOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { handoffApi, type HandoffRow } from "@rabbit/api-client";

function statusColor(s: string): string {
  switch (s) {
    case "PENDING":
      return "warning";
    case "HANDLING":
      return "processing";
    case "RESOLVED":
      return "success";
    default:
      return "default";
  }
}

/** 人工接管工作台（CHAT-003 §3）。 */
export default function HandoffsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [filter, setFilter] = useState("");
  const [resolving, setResolving] = useState<HandoffRow | null>(null);
  const [conclusion, setConclusion] = useState("");

  const list = useQuery({
    queryKey: ["handoffs", filter],
    queryFn: () => handoffApi.list({ status: filter || undefined }),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["handoffs"] });
  const claim = useMutation({
    mutationFn: (id: string) => handoffApi.claim(id),
    onSuccess: () => {
      message.success("已认领（HANDLING）");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "认领失败"),
  });
  const resolve = useMutation({
    mutationFn: (input: { id: string; conclusion?: string }) =>
      handoffApi.resolve(input.id, input.conclusion),
    onSuccess: () => {
      message.success("已解决——会话恢复对话");
      setResolving(null);
      setConclusion("");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "解决失败"),
  });

  return (
    <AppShell active="handoffs">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="handoffs-page">
        <div className="mb-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
            人工接管
          </h1>
          <p className="mt-1 text-sm text-rw-fg-subtle">
            转人工会话在此认领与解决——解决后员工恢复自动回复
          </p>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Tabs
            activeKey={filter}
            onChange={setFilter}
            items={[
              { key: "", label: "待处理" },
              { key: "HANDLING", label: "处理中" },
              { key: "RESOLVED", label: "已解决" },
            ]}
          />
          <Table<HandoffRow>
            data-testid="handoffs-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="没有待处理的接管——对话页「转人工」后出现在这里"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={{ pageSize: 20, size: "small", showSizeChanger: false }}
            columns={[
              {
                title: "状态",
                dataIndex: "status",
                width: 110,
                render: (s: string) => (
                  <Tag bordered={false} color={statusColor(s)}>
                    {s}
                  </Tag>
                ),
              },
              {
                title: "会话 / 原因",
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-rw-fg">{r.conversationTitle}</div>
                    <div className="truncate text-xs text-rw-fg-subtle">{r.reason ?? "—"}</div>
                  </div>
                ),
              },
              {
                title: "发起",
                dataIndex: "createdAt",
                width: 140,
                render: (v: string) => (
                  <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                    {v.replace("T", " ").slice(5, 16)}
                  </span>
                ),
              },
              {
                title: "操作",
                width: 170,
                align: "right",
                render: (_, r) =>
                  r.status === "RESOLVED" ? (
                    <span className="text-rw-fg-subtle text-xs">{r.conclusion ?? "已解决"}</span>
                  ) : (
                    <>
                      {r.status === "PENDING" && (
                        <Button
                          type="text"
                          size="small"
                          icon={<UserSwitchOutlined />}
                          onClick={() => claim.mutate(r.id)}
                        >
                          认领
                        </Button>
                      )}
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => {
                          setResolving(r);
                          setConclusion("");
                        }}
                      >
                        解决
                      </Button>
                    </>
                  ),
              },
            ]}
          />
        </div>

        <Modal
          title={resolving ? `解决接管：${resolving.conversationTitle}` : "解决接管"}
          open={resolving !== null}
          onCancel={() => setResolving(null)}
          onOk={() =>
            resolving && resolve.mutate({ id: resolving.id, conclusion: conclusion || undefined })
          }
          okText="解决并恢复会话"
          cancelText="取消"
          confirmLoading={resolve.isPending}
          destroyOnHidden
        >
          <p className="text-rw-fg-subtle mb-2 text-xs">
            结论可选;会写入会话系统消息并恢复自动回复
          </p>
          <Input.TextArea
            data-testid="handoff-conclusion-input"
            rows={3}
            maxLength={1024}
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="如：已按流程退款"
          />
        </Modal>
      </div>
    </AppShell>
  );
}
