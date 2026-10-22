"use client";

import { useState } from "react";
import { Empty, Skeleton, Table, Tabs, Tag } from "antd";
import { auditApi, authApi } from "@rabbit/api-client";
import type { AuditLogDto } from "@rabbit/shared";
import { useQuery } from "@tanstack/react-query";
import { ReloadOutlined } from "@ant-design/icons";
import { AppShell } from "@/components/AppShell";
import { obsApi } from "@rabbit/api-client";
import type { RunDto } from "@rabbit/shared";

/** 运行状态 → 语义色（上游状态机原值透传，OBS-001 §3）。 */
function runStatusColor(s: string): string {
  switch (s) {
    case "SUCCEEDED":
      return "success";
    case "STREAMING":
      return "processing";
    case "STARTED":
      return "default";
    case "FAILED":
      return "error";
    case "INTERRUPTED":
      return "warning";
    default:
      return "default";
  }
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtTokens(n: number | null): string {
  if (n == null) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** 统计卡（MASTER §5.2：数字 count-up 同语义——此处以 tabular-nums 直显，数字滚动随 OBS-002 看板页统一做） */
function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div
      className="rounded-rw-md border border-rw-border bg-rw-card p-5"
      data-testid="runs-stat-card"
    >
      <p className="text-xs text-rw-fg-muted">{label}</p>
      <p
        data-testid="runs-stat-value"
        className={`font-display mt-1 text-[26px] font-semibold tabular-nums ${
          tone === "success" ? "text-rw-success" : "text-rw-fg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const FILTERS = [
  { key: "", label: "全部" },
  { key: "SUCCEEDED", label: "成功" },
  { key: "FAILED", label: "失败" },
  { key: "INTERRUPTED", label: "已中断" },
] as const;

/** 运行观测（OBS-001）：页头最小看板 + RunRecord 留痕列表。 */
export default function RunsPage() {
  const [filter, setFilter] = useState<string>("");
  const [pageTab, setPageTab] = useState("runs");

  const stats = useQuery({ queryKey: ["runs", "stats"], queryFn: () => obsApi.runStats() });
  const usage = useQuery({ queryKey: ["usage", "daily"], queryFn: () => obsApi.usage(14) });
  const auditLogs = useQuery({
    queryKey: ["audit", "logs"],
    queryFn: () => auditApi.logs(1, 30),
    retry: false,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me, staleTime: 60_000, retry: false });
  const runs = useQuery({
    queryKey: ["runs", "list", filter],
    queryFn: () => obsApi.runs({ status: filter || undefined, pageSize: 20 }),
  });

  const counts = runs.data?.counts ?? {};

  return (
    <AppShell active="runs">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="runs-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              运行观测
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              对话执行留痕(RunRecord)与最小看板——失败原因逐条透出
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-rw-sm px-3 text-sm text-rw-fg-muted transition-colors duration-[140ms] ease-out hover:bg-rw-muted-subtle hover:text-rw-fg"
            onClick={() => {
              void stats.refetch();
              void runs.refetch();
            }}
            data-testid="runs-refresh"
          >
            <ReloadOutlined /> 刷新
          </button>
        </div>

        {/* 页头统计看板（OBS-001 §2.2 口径） */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.isLoading ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-rw-md border border-rw-border bg-rw-card p-5">
                <Skeleton active paragraph={{ rows: 1 }} title={{ width: "60%" }} />
              </div>
            ))
          ) : (
            <>
              <StatCard label="今日调用" value={String(stats.data?.todayCount ?? 0)} />
              <StatCard
                label="成功率(7日)"
                value={stats.data?.successRate7d != null ? `${stats.data.successRate7d}%` : "—"}
                tone="success"
              />
              <StatCard
                label="平均时长"
                value={
                  stats.data?.avgDurationMs7d != null
                    ? fmtDuration(stats.data.avgDurationMs7d)
                    : "—"
                }
              />
              <StatCard label="Token 消耗(7日)" value={fmtTokens(stats.data?.tokens7d ?? 0)} />
            </>
          )}
        </div>

        {/* 页面级 Tab（OBS-002）：运行｜用量｜审计 */}
        <div className="mb-6">
          <Tabs
            activeKey={pageTab}
            onChange={setPageTab}
            items={[
              { key: "runs", label: "运行" },
              { key: "usage", label: "用量" },
              { key: "audit", label: "审计" },
            ]}
          />
        </div>

        {pageTab === "usage" ? (
          <UsagePanel usage={usage} />
        ) : pageTab === "audit" ? (
          <AuditPanel logs={auditLogs} isAdmin={me.data?.role === "ADMIN"} />
        ) : null}

        {/* 留痕列表（运行 Tab 内容） */}
        <div
          className={`rounded-rw-md border border-rw-border bg-rw-card p-6 ${pageTab === "runs" ? "" : "hidden"}`}
        >
          <Tabs
            activeKey={filter}
            onChange={setFilter}
            items={FILTERS.map((f) => ({
              key: f.key,
              label: `${f.label} ${f.key === "" ? (counts.total ?? 0) : (counts[f.key] ?? 0)}`,
            }))}
          />

          <Table<RunDto>
            data-testid="runs-table"
            rowKey="id"
            size="small"
            loading={runs.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有运行记录——发起第一轮对话后,这里会留下执行留痕"
                  className="!my-8"
                />
              ),
            }}
            dataSource={runs.data?.items ?? []}
            pagination={{ pageSize: 20, size: "small", showSizeChanger: false }}
            columns={[
              {
                title: "状态",
                dataIndex: "status",
                width: 130,
                render: (s: RunDto["status"]) => (
                  <Tag bordered={false} color={runStatusColor(s)}>
                    {s}
                  </Tag>
                ),
              },
              {
                title: "员工 · 会话",
                render: (_, r) => (
                  <span className="text-[13px]">
                    {r.employeeName} · <span className="text-rw-accent">{r.conversationTitle}</span>
                  </span>
                ),
              },
              {
                title: "时长",
                dataIndex: "durationMs",
                width: 90,
                align: "right",
                render: (v: number | null) => (
                  <span className="tabular-nums text-[13px]">{fmtDuration(v)}</span>
                ),
              },
              {
                title: "Token(in/out)",
                width: 130,
                align: "right",
                render: (_, r) => (
                  <span className="tabular-nums text-[13px] text-rw-fg-muted">
                    {fmtTokens(r.tokenIn)} / {fmtTokens(r.tokenOut)}
                  </span>
                ),
              },
              {
                title: "开始时间",
                dataIndex: "startedAt",
                width: 150,
                align: "right",
                render: (v: string) => (
                  <span className="tabular-nums text-[13px] text-rw-fg-subtle">
                    {v.replace("T", " ").slice(5, 16)}
                  </span>
                ),
              },
            ]}
            expandable={{
              rowExpandable: (r) => r.status === "FAILED" && Boolean(r.error),
              expandedRowRender: (r) => (
                <p
                  className="rounded-rw-md bg-rw-danger-subtle px-4 py-3 font-mono text-xs text-rw-danger"
                  data-testid="run-error-detail"
                >
                  {r.error}
                </p>
              ),
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}

/** 用量面板（OBS-002 §3-D：14 天纯 CSS 条形 + Top5 员工）。 */
function UsagePanel({
  usage,
}: {
  usage: {
    isLoading: boolean;
    data?: {
      days: Array<{ day: string; runs: number; tokenIn: number; tokenOut: number }>;
      topEmployees: Array<{
        employeeId: string;
        employeeName: string;
        runs: number;
        tokenTotal: number;
      }>;
    };
  };
}) {
  if (usage.isLoading) {
    return (
      <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }
  const days = usage.data?.days ?? [];
  const max = Math.max(...days.map((d) => d.tokenIn + d.tokenOut), 1);
  return (
    <div className="space-y-6" data-testid="usage-panel">
      <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
        <h3 className="font-display text-rw-fg mb-4 text-[15px] font-semibold">
          近 14 天 Token 消耗
        </h3>
        {days.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="还没有用量——发起第一轮对话后按天聚合"
            className="!my-8"
          />
        ) : (
          <div className="flex h-40 items-end gap-1.5" data-testid="usage-bars">
            {days.map((d) => (
              <div
                key={d.day}
                title={`${d.day} · 入${fmtK(d.tokenIn)} 出${fmtK(d.tokenOut)} · ${d.runs} 次`}
                className="bg-rw-accent min-w-0 flex-1 rounded-t-[4px] transition-opacity duration-[140ms] ease-out hover:opacity-70"
                style={{ height: `${Math.max(((d.tokenIn + d.tokenOut) / max) * 100, 2)}%` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
        <h3 className="font-display text-rw-fg mb-4 text-[15px] font-semibold">
          Top 员工（14 天）
        </h3>
        <Table
          data-testid="usage-top-table"
          rowKey="employeeId"
          size="small"
          pagination={false}
          locale={{ emptyText: "暂无数据" }}
          dataSource={usage.data?.topEmployees ?? []}
          columns={[
            { title: "员工", dataIndex: "employeeName" },
            {
              title: "次数",
              dataIndex: "runs",
              width: 100,
              align: "right",
              render: (n: number) => <span className="tabular-nums text-[13px]">{n}</span>,
            },
            {
              title: "Token 合计",
              dataIndex: "tokenTotal",
              width: 130,
              align: "right",
              render: (n: number) => <span className="tabular-nums text-[13px]">{fmtK(n)}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function auditActionColor(action: string): string {
  if (action.includes("failed") || action.includes("delete")) return "error";
  if (action.startsWith("auth.")) return "warning";
  return "default";
}

/** 审计面板（OBS-002 §3-E：仅 ADMIN）。 */
function AuditPanel({
  logs,
  isAdmin,
}: {
  logs: { isLoading: boolean; data?: { items: AuditLogDto[]; total: number }; isError: boolean };
  isAdmin: boolean;
}) {
  if (!isAdmin) {
    return (
      <div
        className="rounded-rw-md border border-rw-border bg-rw-card p-12"
        data-testid="audit-forbidden"
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="审计日志仅管理员可查看"
          className="!my-4"
        />
      </div>
    );
  }
  return (
    <div className="rounded-rw-md border border-rw-border bg-rw-card p-6" data-testid="audit-panel">
      <Table
        data-testid="audit-table"
        rowKey="id"
        size="small"
        loading={logs.isLoading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无审计记录"
              className="!my-8"
            />
          ),
        }}
        dataSource={logs.data?.items ?? []}
        pagination={{ pageSize: 30, size: "small", showSizeChanger: false }}
        columns={[
          {
            title: "时间",
            dataIndex: "createdAt",
            width: 150,
            render: (v: string) => (
              <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                {v.replace("T", " ").slice(5, 16)}
              </span>
            ),
          },
          {
            title: "动作",
            dataIndex: "action",
            width: 180,
            render: (a: string) => (
              <Tag bordered={false} color={auditActionColor(a)}>
                {a}
              </Tag>
            ),
          },
          {
            title: "操作者",
            dataIndex: "actorId",
            width: 120,
            render: (v: string | null) =>
              v ? <span className="font-mono text-xs">{v.slice(0, 8)}…</span> : "—",
          },
          {
            title: "目标",
            render: (_, r) => (
              <span className="font-mono text-xs">
                {r.targetId?.slice(0, 12) ?? "—"}
                {r.targetType ? ` (${r.targetType})` : ""}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
