"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Popconfirm, Transfer, TransferProps } from "antd";
import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { kbApi, skillApi, staffResourceApi } from "@rabbit/api-client";
import type { KbCreateInput, SkillCreateInput } from "@rabbit/shared";

/** 员工资源绑定（RESOURCE-001）：穿梭框配置技能/知识库 + 库内新建/删除 + 差分保存。 */
export function ResourceBindings({ staffId, type }: { staffId: string; type: "SKILL" | "KNOWLEDGE" }) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [targetKeys, setTargetKeys] = useState<string[] | null>(null); // null = 未编辑，回显服务端态
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<SkillCreateInput & KbCreateInput>();

  const listKey = type === "SKILL" ? ["skills"] : ["knowledge-bases"];
  const listLabel = type === "SKILL" ? "技能" : "知识库";

  // 归一化为 Transfer 所需的公共形状（技能/知识库两个列表接口的联合类型不可直接推导）
  const library = useQuery({
    queryKey: listKey,
    queryFn: async (): Promise<{ items: Array<{ id: string; name: string; description: string | null }> }> => {
      const res = type === "SKILL" ? await skillApi.list() : await kbApi.list();
      return { items: res.items.map((it) => ({ id: it.id, name: it.name, description: it.description })) };
    },
  });
  const bound = useQuery({
    queryKey: ["staff-resources", staffId],
    queryFn: () => staffResourceApi.get(staffId),
  });

  const serverKeys = useMemo(() => {
    const dto = bound.data;
    if (!dto) return [];
    return type === "SKILL" ? dto.skills.map((s) => s.id) : dto.knowledgeBases.map((k) => k.id);
  }, [bound.data, type]);
  const current = targetKeys ?? serverKeys;
  const dirty = targetKeys !== null && JSON.stringify([...targetKeys].sort()) !== JSON.stringify([...serverKeys].sort());

  const save = useMutation({
    mutationFn: async (nextSkillIds: string[]) => {
      // 以另一类型的服务端现值为基准做全量 PUT（差分在服务端事务内执行）
      const other = bound.data
        ? type === "SKILL"
          ? bound.data.knowledgeBases.map((k) => k.id)
          : bound.data.skills.map((s) => s.id)
        : [];
      return staffResourceApi.put(staffId, {
        skillIds: type === "SKILL" ? nextSkillIds : other,
        knowledgeBaseIds: type === "KNOWLEDGE" ? nextSkillIds : other,
      });
    },
    onSuccess: () => {
      message.success(`${listLabel}配置已保存`);
      setTargetKeys(null);
      void queryClient.invalidateQueries({ queryKey: ["staff-resources", staffId] });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "保存失败"),
  });

  const create = useMutation({
    mutationFn: async (input: SkillCreateInput & KbCreateInput): Promise<{ id: string }> => {
      if (type === "SKILL") return skillApi.create(input);
      return kbApi.create({ name: input.name, description: input.description });
    },
    onSuccess: () => {
      message.success(`${listLabel}已创建`);
      setCreateOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "创建失败"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => (type === "SKILL" ? skillApi.remove(id) : kbApi.remove(id)),
    onSuccess: () => {
      message.success(`${listLabel}已删除`);
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: ["staff-resources", staffId] });
      setTargetKeys(null);
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "删除失败"),
  });

  const items = library.data?.items ?? [];
  const transferItems: TransferProps["dataSource"] = items.map((it) => ({
    key: it.id,
    title: it.name,
    description: it.description ?? "",
  }));

  const onChange: TransferProps["onChange"] = (keys) => setTargetKeys(keys.map(String));

  return (
    <div className="border-rw-border bg-rw-card animate-fade-up rounded-rw-md border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-rw-fg text-[15px] font-semibold">{listLabel}配置</h2>
          <p className="text-rw-fg-subtle mt-0.5 text-xs">
            勾选该员工可用的{listLabel}（当前 {current.length} 项）——保存后随下一次发布生效于运行时。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} data-testid={`resource-create-${type}`}>
            新建{listLabel}
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            disabled={!dirty}
            loading={save.isPending}
            onClick={() => save.mutate(current)}
            data-testid={`resource-save-${type}`}
          >
            保存配置
          </Button>
        </div>
      </div>

      {library.isLoading || bound.isLoading ? (
        <p className="text-rw-fg-subtle py-8 text-center text-sm">加载中…</p>
      ) : items.length === 0 ? (
        <div className="text-rw-fg-subtle flex flex-col items-center gap-3 py-10 text-sm">
          <span>还没有可选的{listLabel}，先创建一个</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建{listLabel}
          </Button>
        </div>
      ) : (
        <Transfer
          dataSource={transferItems}
          titles={[`可选${listLabel}`, `已配置`]}
          targetKeys={current}
          onChange={onChange}
          render={(item) => (
            <span className="flex min-w-0 items-center gap-2" data-testid={`resource-item-${item.key}`}>
              <span className="text-rw-fg truncate text-[13px] font-medium">{item.title}</span>
              <span className="text-rw-fg-subtle truncate text-xs">{item.description}</span>
              <Popconfirm
                title={`删除该${listLabel}？`}
                description="将同时解除所有员工的绑定"
                okText="删除"
                cancelText="取消"
                onConfirm={() => remove.mutate(String(item.key))}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`删除${item.title}`}
                  className="!ml-auto !shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </span>
          )}
          selectAllLabels={[`全选`, `全选`]}
          listStyle={{ width: 300, height: 320 }}
          data-testid={`resource-transfer-${type}`}
        />
      )}

      <Modal
        title={`新建${listLabel}`}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => create.mutate(v)}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: `请输入${listLabel}名称` }]}>
            <Input data-testid={`resource-form-name-${type}`} placeholder={type === "SKILL" ? "如：结构化周报生成" : "如：产品手册"} maxLength={128} />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input placeholder="一句话说明用途" maxLength={512} />
          </Form.Item>
          {type === "SKILL" && (
            <Form.Item
              name="promptTemplate"
              label="提示词模板（可选）"
              extra="员工的 System Prompt 之后追加；支持 {{变量}} 占位（运行时注入）"
              className="!mb-0"
            >
              <Input.TextArea rows={4} placeholder={"请按以下结构输出：\n1. …\n2. …"} maxLength={20000} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
