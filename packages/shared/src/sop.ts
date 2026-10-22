/** SOP 状态机 zod + 校验/条件求值纯函数（SKILL-002 §2;画布编辑器登记 R-CANVAS）。 */
import { z } from "zod";

export const SOP_NODE_TYPES = ["start", "llm", "human", "end"] as const;
export const SOP_CONDITION_OPS = ["eq", "neq", "gte", "lte", "contains"] as const;

export const sopCondition = z.object({
  var: z.string().min(1).max(64),
  op: z.enum(SOP_CONDITION_OPS),
  value: z.union([z.string(), z.number()]),
});
export type SopCondition = z.infer<typeof sopCondition>;

export const sopNode = z.object({
  id: z.string().trim().min(1).max(64),
  type: z.enum(SOP_NODE_TYPES),
  prompt: z.string().trim().max(20000).optional(), // llm 节点必填（validateSopGraph 校验）
  instruction: z.string().trim().max(2000).optional(), // human 节点必填
});
export type SopNode = z.infer<typeof sopNode>;

export const sopEdge = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  when: sopCondition.optional(), // 无 when = 兜底边;多条出边时兜底必须最后（校验）
});
export type SopEdge = z.infer<typeof sopEdge>;

export const sopGraph = z.object({
  nodes: z.array(sopNode).min(2).max(64),
  edges: z.array(sopEdge).min(1).max(256),
  variables: z
    .array(
      z.object({ key: z.string().trim().min(1).max(64), required: z.boolean().default(false) }),
    )
    .max(32)
    .default([]),
});
export type SopGraph = z.infer<typeof sopGraph>;

export const sopRunInput = z.object({
  employeeId: z.string().min(1),
  variables: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});
export type SopRunInput = z.infer<typeof sopRunInput>;

/**
 * 图校验（SKILL-002 §2.2;返回错误清单,空数组=合法）：
 * 唯一 start/≥1 end;节点 id 唯一;llm/human 提示非空;边引用存在;
 * start 出/end 无出;start 可达全节点;多出边条件在前兜底最后且至多一条。
 */
export function validateSopGraph(g: SopGraph): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) errs.push(`节点 id 重复：${n.id}`);
    ids.add(n.id);
  }
  const starts = g.nodes.filter((n) => n.type === "start");
  const ends = g.nodes.filter((n) => n.type === "end");
  if (starts.length !== 1) errs.push(`必须恰好一个 start 节点（当前 ${starts.length} 个）`);
  if (ends.length === 0) errs.push("至少一个 end 节点");
  for (const n of g.nodes) {
    if (n.type === "llm" && !n.prompt) errs.push(`llm 节点 ${n.id} 缺少 prompt`);
    if (n.type === "human" && !n.instruction) errs.push(`human 节点 ${n.id} 缺少 instruction`);
  }
  const outEdges = new Map<string, SopEdge[]>();
  for (const e of g.edges) {
    if (!ids.has(e.from)) errs.push(`边引用不存在的源节点：${e.from}`);
    if (!ids.has(e.to)) errs.push(`边引用不存在的目标节点：${e.to}`);
    if (ids.has(e.from) && ids.has(e.to)) {
      const arr = outEdges.get(e.from) ?? [];
      arr.push(e);
      outEdges.set(e.from, arr);
    }
  }
  const start = starts[0];
  if (start && !outEdges.get(start.id)?.length) errs.push("start 节点必须有出边");
  for (const e of ends) {
    if (outEdges.get(e.id)?.length) errs.push(`end 节点 ${e.id} 不应有出边`);
  }
  // 多出边：条件边在前,兜底（无 when）至多一条且在最后
  for (const [from, arr] of outEdges) {
    const fallbacks = arr.filter((e) => !e.when);
    if (arr.length > 1) {
      if (fallbacks.length > 1) errs.push(`节点 ${from} 有多条兜底边（至多一条）`);
      if (fallbacks.length === 1 && arr.at(-1)?.when) {
        errs.push(`节点 ${from} 的兜底边必须声明在最后`);
      }
    }
  }
  // 可达性（BFS from start）
  if (start) {
    const reached = new Set<string>([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of outEdges.get(cur) ?? []) {
        if (!reached.has(e.to)) {
          reached.add(e.to);
          queue.push(e.to);
        }
      }
    }
    for (const n of g.nodes) {
      if (!reached.has(n.id)) errs.push(`节点 ${n.id} 从 start 不可达`);
    }
    if (ends.length && !ends.some((e) => reached.has(e.id))) errs.push("没有任何 end 节点可达");
  }
  return errs;
}

/** 条件求值（数值比较需双方可数值化;contains 仅字符串） */
export function evaluateCondition(c: SopCondition, vars: Record<string, string | number>): boolean {
  const v = vars[c.var];
  if (v === undefined) return false;
  if (c.op === "eq") return String(v) === String(c.value);
  if (c.op === "neq") return String(v) !== String(c.value);
  if (c.op === "contains") return String(v).includes(String(c.value));
  const a = Number(v);
  const b = Number(c.value);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return c.op === "gte" ? a >= b : a <= b;
}

/** 多出边选择：按声明序第一条命中（兜底边自动命中） */
export function pickEdge(edges: SopEdge[], vars: Record<string, string | number>): SopEdge | null {
  for (const e of edges) {
    if (!e.when || evaluateCondition(e.when, vars)) return e;
  }
  return null;
}

/** 变量渲染 {{key}}（未识别保留原样——SOP 模板语义） */
export function renderSopPrompt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/gu, (orig, key: string) =>
    key in vars ? String(vars[key]) : orig,
  );
}
