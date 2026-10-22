"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Switch,
  Table,
  Tag,
} from "antd";
import { ClockCircleOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { cronApi, staffApi } from "@rabbit/api-client";
import { describeCron } from "@rabbit/shared";

interface TaskRow {
  id: string;
  name: string;
  cron: string;
  employeeId: string;
  inputTemplate: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

interface RunRow {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

function statusColor(s: string): string {
  switch (s) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "error";
    case "PENDING":
      return "processing";
    default:
      return "default";
  }
}

/** 定时任务页（CRON-001 §3）。 */
export default function ScheduledTasksPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{
    name: string;
    cron: string;
    employeeId: string;
    inputTemplate: string;
  }>();

  const list = useQuery({ queryKey: ["cronTasks"], queryFn: () => cronApi.list() });
  const staffs = useQuery({
    queryKey: ["staffs", "published"],
    queryFn: () => staffApi.list({ pageSize: 100 }),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["cronTasks"] });

  const save = useMutation({
    mutationFn: (v: { name: string; cron: string; employeeId: string; inputTemplate: string }) =>
      editing ? cronApi.update(editing.id, v) : cronApi.create(v),
    onSuccess: () => {
      message.success(editing ? "已保存" : "任务已创建");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => cronApi.remove(id),
    onSuccess: () => {
      message.success("任务已删除");
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      cronApi.update(input.id, { enabled: input.enabled }),
    onSuccess: () => invalidate(),
    onError: (e) => message.error(e instanceof Error ? e.message : "切换失败"),
  });
  const runNow = useMutation({
    mutationFn: (id: string) => cronApi.runNow(id),
    onSuccess: (r) => {
      message.info(
        r.status === "SUCCEEDED" ? "执行成功（见运行历史）" : `执行失败：${r.error ?? ""}`,
      );
      invalidate();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "执行失败"),
  });

  const employees = (staffs.data?.items ?? []).filter((s) => s.status === "PUBLISHED");
  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? id.slice(0, 8);

  return (
    <AppShell active="cron">
      <div className="mx-auto max-w-[1600px] px-8 py-8" data-testid="cron-page">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-rw-fg">
              定时任务
            </h1>
            <p className="mt-1 text-sm text-rw-fg-subtle">
              cron 触发员工消息（执行留痕;60 秒扫描粒度）
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
            data-testid="cron-create-btn"
          >
            新建任务
          </Button>
        </div>

        <div className="rounded-rw-md border border-rw-border bg-rw-card p-6">
          <Table<TaskRow>
            data-testid="cron-table"
            rowKey="id"
            size="small"
            loading={list.isLoading}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="还没有定时任务——创建第一个自动化"
                  className="!my-8"
                />
              ),
            }}
            dataSource={list.data?.items ?? []}
            pagination={false}
            columns={[
              {
                title: "名称",
                render: (_, r) => (
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-rw-fg">{r.name}</div>
                    <div className="font-mono text-xs text-rw-fg-subtle">
                      {describeCron(r.cron)}
                    </div>
                  </div>
                ),
              },
              {
                title: "员工",
                dataIndex: "employeeId",
                width: 110,
                render: (v: string) => empName(v),
              },
              {
                title: "启用",
                dataIndex: "enabled",
                width: 80,
                render: (v: boolean, r) => (
                  <Switch
                    size="small"
                    checked={v}
                    onChange={(nv) => toggle.mutate({ id: r.id, enabled: nv })}
                  />
                ),
              },
              {
                title: "上次运行",
                dataIndex: "lastRunAt",
                width: 140,
                render: (v: string | null) => (
                  <span className="text-rw-fg-subtle tabular-nums text-[13px]">
                    {v ? v.replace("T", " ").slice(5, 16) : "—"}
                  </span>
                ),
              },
              {
                title: "操作",
                width: 210,
                align: "right",
                render: (_, r) => (
                  <>
                    <Button
                      type="text"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={() => runNow.mutate(r.id)}
                    >
                      立即执行
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setEditing(r);
                        form.setFieldsValue({
                          name: r.name,
                          cron: r.cron,
                          employeeId: r.employeeId,
                          inputTemplate: r.inputTemplate,
                        });
                        setOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除该任务？"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => remove.mutate(r.id)}
                    >
                      <Button type="text" size="small" danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </>
                ),
              },
            ]}
            expandable={{
              rowExpandable: () => true,
              expandedRowRender: (r) => <TaskRuns taskId={r.id} />,
            }}
          />
        </div>

        <Modal
          title={editing ? `编辑任务：${editing.name}` : "新建定时任务"}
          open={open}
          onCancel={() => setOpen(false)}
          onOk={() => form.submit()}
          okText={editing ? "保存" : "创建"}
          cancelText="取消"
          confirmLoading={save.isPending}
          destroyOnHidden
          width={560}
        >
          <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
              <Input data-testid="cron-form-name" placeholder="如：每日站报" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="cron"
              label="cron 表达式（分 时 日 月 周）"
              rules={[{ required: true, message: "请输入 cron 表达式" }]}
              extra="如 0 9 * * *（每天 09:00）;0 9 * * 1-5（工作日 09:00）"
            >
              <Input
                data-testid="cron-form-cron"
                className="font-mono text-[13px]"
                placeholder="0 9 * * *"
                maxLength={64}
              />
            </Form.Item>
            <Form.Item
              name="employeeId"
              label="员工"
              rules={[{ required: true, message: "请选择员工" }]}
            >
              <Select
                virtual={false}
                placeholder="选择已发布员工"
                options={employees.map((s) => ({ value: s.id, label: `${s.name}(${s.title})` }))}
              />
            </Form.Item>
            <Form.Item
              name="inputTemplate"
              label="消息模板（{{日期}}/{{时间}} 占位）"
              rules={[{ required: true, message: "请输入消息模板" }]}
              className="!mb-0"
            >
              <Input.TextArea
                data-testid="cron-form-template"
                rows={3}
                className="font-mono text-[13px]"
                maxLength={20000}
                placeholder="请汇总昨日进展，输出 {{日期}} 站报"
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppShell>
  );
}

function TaskRuns({ taskId }: { taskId: string }) {
  const runs = useQuery({
    queryKey: ["cronRuns", taskId],
    queryFn: () => cronApi.runs(taskId),
  });
  const rows: RunRow[] = runs.data?.items ?? [];
  if (runs.isLoading) return <Skeleton active paragraph={{ rows: 1 }} />;
  if (rows.length === 0) {
    return <p className="text-rw-fg-subtle py-3 text-xs">还没有运行记录</p>;
  }
  return (
    <Table<RunRow>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={rows}
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
          title: "开始",
          dataIndex: "startedAt",
          width: 140,
          render: (v: string | null) => (
            <span className="tabular-nums text-[13px]">
              {v ? v.replace("T", " ").slice(5, 16) : "—"}
            </span>
          ),
        },
        {
          title: "错误",
          dataIndex: "error",
          render: (e: string | null) =>
            e ? <span className="text-rw-danger font-mono text-xs">{e}</span> : "—",
        },
      ]}
    />
  );
}
