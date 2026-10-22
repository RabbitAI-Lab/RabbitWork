"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { App, Button, Empty, Input, Popconfirm, Skeleton, Table, Tabs, Tag, Upload } from "antd";
import { ArrowLeftOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { kbApi } from "@rabbit/api-client";
import type { KbDocumentDto, KbRetrieveHitDto } from "@rabbit/shared";

function docStatusColor(s: KbDocumentDto["status"]): string {
  switch (s) {
    case "READY":
      return "success";
    case "INGESTING":
      return "processing";
    case "FAILED":
      return "error";
    default:
      return "default";
  }
}

/** 知识库详情（KNW-001 §3-B）：Tab 文档（上传/列表/失败原因）+ 检索调试。 */
export default function KbDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState("docs");
  const [query, setQuery] = useState("");
  const [retrieving, setRetrieving] = useState(false);

  const list = useQuery({
    queryKey: ["kb", id],
    queryFn: () => kbApi.list(),
    select: (d) => d.items.find((k) => k.id === id),
  });
  const docs = useQuery({
    queryKey: ["kb", id, "documents"],
    queryFn: () => kbApi.documents(id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["kb", id, "documents"] });
    void queryClient.invalidateQueries({ queryKey: ["kbs"] });
    void queryClient.invalidateQueries({ queryKey: ["kb", id] });
  };

  const upload = useMutation({
    mutationFn: (file: File) => kbApi.upload(id, file),
    onSuccess: (doc) => {
      message.success(`已摄取:${doc.title}(${doc.chunkCount} 切片)`);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "上传失败"),
  });
  const removeDoc = useMutation({
    mutationFn: (docId: string) => kbApi.removeDocument(id, docId),
    onSuccess: () => {
      message.success("文档已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });

  const kb = list.data;

  const runRetrieve = async () => {
    if (!query.trim()) return;
    setRetrieving(true);
    setResults(null);
    try {
      const r = await kbApi.retrieve(id, { query, topK: 8 });
      setResults(r);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "检索失败");
    } finally {
      setRetrieving(false);
    }
  };
  const [results, setResults] = useState<{
    items: KbRetrieveHitDto[];
    total: number;
    tookMs: number;
  } | null>(null);

  return (
    <AppShell active="knowledge">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="kb-detail-page">
        {list.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : !kb ? (
          <Empty description="知识库不存在或已被删除" className="!my-16">
            <Button onClick={() => router.push("/knowledge")}>返回知识库列表</Button>
          </Empty>
        ) : (
          <>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/knowledge")}
              className="text-rw-fg-subtle !mb-4 !-ml-2"
            >
              返回知识库列表
            </Button>

            <div className="border-rw-border bg-rw-card mb-6 rounded-rw-md border p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-semibold tracking-tight text-rw-fg">
                    {kb.name}
                  </h1>
                  {kb.description && (
                    <p className="text-rw-fg-muted mt-2 text-sm">{kb.description}</p>
                  )}
                  <p className="text-rw-fg-subtle mt-1.5 text-xs tabular-nums">
                    {kb.documentCount} 篇文档 · {kb.chunkCount} 切片 · 关键词检索（向量检索随 AI
                    Provider 接入）
                  </p>
                </div>
                <Upload
                  accept=".md,.txt"
                  showUploadList={false}
                  maxCount={1}
                  beforeUpload={(file) => {
                    upload.mutate(file);
                    return false; // 手动控制上传（api-client 走 fetch）
                  }}
                >
                  <Button
                    type="primary"
                    ghost
                    icon={<UploadOutlined />}
                    data-testid="kb-upload-btn"
                  >
                    上传文档
                  </Button>
                </Upload>
              </div>
            </div>

            <div className="border-rw-border bg-rw-card rounded-rw-md border p-6">
              <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                  { key: "docs", label: `文档 (${docs.data?.total ?? 0})` },
                  { key: "retrieve", label: "检索调试" },
                ]}
              />

              {tab === "docs" ? (
                <Table<KbDocumentDto>
                  data-testid="kb-docs-table"
                  rowKey="id"
                  size="small"
                  loading={docs.isLoading}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="还没有文档——上传 .md/.txt(≤2MB,UTF-8)开始沉淀知识"
                        className="!my-8"
                      />
                    ),
                  }}
                  dataSource={docs.data?.items ?? []}
                  pagination={false}
                  columns={[
                    { title: "文档", dataIndex: "title" },
                    {
                      title: "状态",
                      dataIndex: "status",
                      width: 120,
                      render: (s: KbDocumentDto["status"]) => (
                        <Tag bordered={false} color={docStatusColor(s)}>
                          {s}
                        </Tag>
                      ),
                    },
                    {
                      title: "切片",
                      dataIndex: "chunkCount",
                      width: 90,
                      align: "right",
                      render: (n: number) => <span className="tabular-nums text-[13px]">{n}</span>,
                    },
                    {
                      title: "上传时间",
                      dataIndex: "createdAt",
                      width: 150,
                      align: "right",
                      render: (v: string) => (
                        <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                          {v.replace("T", " ").slice(5, 16)}
                        </span>
                      ),
                    },
                    {
                      title: "",
                      width: 60,
                      render: (_, r) => (
                        <Popconfirm
                          title="删除该文档?"
                          description="切片将一并删除。"
                          okText="删除"
                          okButtonProps={{ danger: true }}
                          cancelText="取消"
                          onConfirm={() => removeDoc.mutate(r.id)}
                        >
                          <Button type="text" size="small" danger>
                            🗑
                          </Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                  expandable={{
                    rowExpandable: (r) => r.status === "FAILED" && Boolean(r.error),
                    expandedRowRender: (r) => (
                      <p
                        className="bg-rw-danger-subtle text-rw-danger rounded-rw-md px-4 py-3 font-mono text-xs"
                        data-testid="kb-doc-error"
                      >
                        {r.error}
                      </p>
                    ),
                  }}
                />
              ) : (
                <div
                  className="bg-rw-muted-subtle rounded-rw-md border border-rw-border p-5"
                  data-testid="kb-retrieval-panel"
                >
                  <p className="mb-3 text-[13px] font-medium">检索调试——用员工视角试一试知识命中</p>
                  <div className="flex gap-2">
                    <Input
                      data-testid="kb-retrieval-input"
                      placeholder="输入关键词(空格分隔多词,AND 命中)"
                      value={query}
                      maxLength={256}
                      onChange={(e) => setQuery(e.target.value)}
                      onPressEnter={() => void runRetrieve()}
                    />
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      loading={retrieving}
                      onClick={() => void runRetrieve()}
                      className="shrink-0"
                      data-testid="kb-retrieval-run"
                    >
                      检索
                    </Button>
                  </div>

                  {results && (
                    <div className="mt-4 space-y-2" data-testid="kb-retrieval-results">
                      {results.items.length === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="没有命中——换个关键词,或确认文档已摄取 READY"
                          className="!my-6"
                        />
                      ) : (
                        results.items.map((h, i) => (
                          <div
                            key={`${h.documentId}-${h.seq}-${i}`}
                            className="rw-card p-3.5 text-[13px]"
                          >
                            <p className="text-rw-fg-subtle mb-1 text-xs">
                              {h.documentTitle} · 切片 #{h.seq}
                            </p>
                            <p className="break-all">{h.snippet}</p>
                          </div>
                        ))
                      )}
                      <p className="text-rw-fg-subtle text-xs tabular-nums">
                        命中 {results.total} · 耗时 {results.tookMs}ms · 关键词口径（多词 AND）
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
