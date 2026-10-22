"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { App, Avatar, Button, Empty, Input, Skeleton } from "antd";
import { CopyOutlined, SearchOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { galleryApi } from "@rabbit/api-client";

/** 员工广场（STAFF-003 §3）：GALLERY 卡墙 + 复制到我的员工。 */
export default function GalleryPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [q, setQ] = useState("");

  const list = useQuery({ queryKey: ["gallery"], queryFn: () => galleryApi.list() });
  const copy = useMutation({
    mutationFn: (id: string) => galleryApi.copy(id),
    onSuccess: (c) => {
      message.success(`已复制为「${c.name}」（草稿,仅你可见）`);
      void list.refetch();
      router.push(`/staffs/${c.id}`);
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "复制失败"),
  });

  const items = (list.data?.items ?? []).filter(
    (s) => !q || s.name.includes(q) || s.title.includes(q),
  );

  return (
    <AppShell active="gallery">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="gallery-page">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              员工广场
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              组织共享的数字员工——复制一份变成你的（原件不动,副本为私有草稿）
            </p>
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索姓名 / 岗位"
            className="!w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="gallery-search"
          />
        </div>

        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="gallery-list"
        >
          {list.isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-rw-md border border-rw-border bg-rw-card p-5">
                <Skeleton avatar active paragraph={{ rows: 2 }} />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="col-span-full rounded-rw-md border border-dashed border-rw-border bg-rw-card p-12">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  q ? "没有匹配的员工" : "还没有共享员工——在你的员工详情把可见性设为「广场」并发布"
                }
                className="!my-4"
              />
            </div>
          ) : (
            items.map((s, i) => (
              <div
                key={s.id}
                className="card-hover animate-fade-up flex flex-col rounded-rw-md border border-rw-border bg-rw-card p-5"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                data-testid={`gallery-card-${s.name}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <Avatar
                    size={44}
                    className="avatar-accent !flex !items-center !justify-center !text-base"
                    src={s.avatarUrl ?? undefined}
                  >
                    {s.name.slice(0, 1)}
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-rw-fg truncate text-[15px] font-semibold">{s.name}</p>
                    <p className="text-rw-fg-subtle text-xs tabular-nums">
                      {s.title} · 被复制 {s.copyCount} 次
                    </p>
                  </div>
                </div>
                <p className="text-rw-fg-muted mb-4 flex-1 text-[13px] leading-relaxed line-clamp-3">
                  {s.personaSummary}…
                </p>
                <Button
                  type="primary"
                  block
                  icon={<CopyOutlined />}
                  loading={copy.isPending && copy.variables === s.id}
                  onClick={() => copy.mutate(s.id)}
                  data-testid={`gallery-copy-${s.name}`}
                >
                  复制到我的员工
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
