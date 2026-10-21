"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Empty, Skeleton, Table, Tabs, Tag } from "antd";
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

  const stats = useQuery({ queryKey: ["runs", "stats"], queryFn: () => obsApi.runStats() });
  const runs = useQuery({
    queryKey: ["runs", "list", filter],
    queryFn: () => obsApi.runs({ status: filter || undefined, pageSize: 20 }),
  });

  const counts = runs.data?.counts ?? {};

  return (
    <AppShell active="runs">
      <div className="mx-auto max-w-5xl px-8 py-8" data-testid="runs-page">
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

        {/* 留痕列表 */}
        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
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
