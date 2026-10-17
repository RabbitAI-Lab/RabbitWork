"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, Skeleton, Tag, Tooltip } from "antd";
import { ArrowRightOutlined, PlusOutlined, CoffeeOutlined } from "@ant-design/icons";
import { AppShell } from "@/components/AppShell";
import { chatApi, staffApi } from "@rabbit/api-client";

/** 办公室（DS v2.1）：数字员工工位墙——点击工位进入对话；语义 token + L2/L3 动效。 */
export default function OfficePage() {
  const router = useRouter();
  const staffs = useQuery({ queryKey: ["staffs"], queryFn: () => staffApi.list({ pageSize: 100 }) });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => chatApi.listConversations({}),
  });

  const onDuty = (staffs.data?.items ?? []).filter((s) => s.status === "PUBLISHED");
  const drafts = (staffs.data?.items ?? []).filter((s) => s.status !== "PUBLISHED");

  // 点击工位:复用该员工最近会话,没有则新建
  const enterDesk = useMutation({
    mutationFn: async (employeeId: string) => {
      const existing = await chatApi.listConversations({ employeeId, page: 1 });
      const latest = existing.items.find((c) => c.status === "ACTIVE") ?? existing.items[0];
      return latest ?? (await chatApi.createConversation(employeeId));
    },
    onSuccess: (conversation) => router.push(`/chat/${conversation.id}`),
  });

  const lastByEmployee = new Map(
    (conversations.data?.items ?? []).map((c) => [c.employeeId, c]),
  );

  return (
    <AppShell active="office">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="office-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">办公室</h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              {staffs.isLoading
                ? "工位加载中…"
                : `${onDuty.length} 位数字员工在岗${drafts.length > 0 ? ` · ${drafts.length} 位待发布` : ""}`
              },点击工位开始工作
            </p>
          </div>
          <Link
            href="/staffs"
            className="flex items-center gap-1.5 rounded-rw-sm bg-rw-accent px-4 py-2 text-sm font-medium text-rw-accent-fg transition-colors duration-[140ms] ease-out hover:bg-rw-accent-hover active:scale-[0.96]"
            data-testid="office-manage-btn"
          >
            管理数字员工
            <ArrowRightOutlined className="text-xs" />
          </Link>
        </div>

        {staffs.isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-rw-md border border-rw-border bg-rw-card p-5">
                <Skeleton avatar active paragraph={{ rows: 2 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="office-desks">
            {onDuty.map((s, i) => {
              const last = lastByEmployee.get(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => enterDesk.mutate(s.id)}
                  data-testid={`office-desk-${s.code}`}
                  disabled={enterDesk.isPending}
                  className="card-hover animate-fade-up group flex flex-col rounded-rw-md border border-rw-border bg-rw-card p-5 text-left disabled:opacity-60"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                >
                  {/* 显示器工位 */}
                  <div className="flex items-center gap-3.5">
                    <span className="border-rw-border bg-rw-muted-subtle relative flex shrink-0 items-center justify-center rounded-rw-md border p-1">
                      <Avatar size={40} className="avatar-accent !flex !items-center !justify-center">
                        <span className="text-base font-medium">{s.name.slice(0, 1)}</span>
                      </Avatar>
                      <span className="border-rw-card bg-rw-success animate-pulse-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-rw-fg">{s.name}</div>
                      <div className="mt-0.5 truncate text-xs text-rw-fg-subtle">{s.title}</div>
                    </div>
                    <CoffeeOutlined className="text-rw-fg-subtle shrink-0 transition-colors duration-[140ms] group-hover:text-rw-accent" />
                  </div>

                  <div className="bg-rw-muted-subtle mt-4 flex items-center justify-between rounded-rw-sm px-3 py-2">
                    <span className="truncate text-xs text-rw-fg-subtle">
                      {last ? `最近对话 · ${last.lastMessageAt?.slice(5, 16).replace("T", " ") ?? "—"}` : "还没有对话记录"}
                    </span>
                    <span className="text-rw-accent shrink-0 text-xs font-medium opacity-0 transition-opacity duration-[200ms] ease-out group-hover:opacity-100">
                      进入工位 →
                    </span>
                  </div>
                </button>
              );
            })}

            {/* 空工位:招聘新员工 */}
            <Link
              href="/staffs"
              data-testid="office-desk-empty"
              className="animate-fade-up flex min-h-[132px] flex-col items-center justify-center gap-2.5 rounded-rw-md border-2 border-dashed border-rw-border-strong text-rw-fg-subtle transition-colors duration-[140ms] ease-out hover:border-rw-accent hover:text-rw-accent"
            >
              <PlusOutlined className="text-xl" />
              <span className="text-sm">招聘新的数字员工</span>
            </Link>
          </div>
        )}

        {drafts.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-rw-fg-subtle">
            <span>待发布(不在岗):</span>
            {drafts.map((s) => (
              <Tooltip key={s.id} title={`${s.title} · ${s.code}`}>
                <Link href="/staffs">
                  <Tag bordered={false} className="!m-0 cursor-pointer !rounded-full !bg-rw-muted-subtle !text-rw-fg-muted hover:!bg-rw-accent-subtle hover:!text-rw-accent">
                    {s.name}
                  </Tag>
                </Link>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
