/** SOP 纯函数矩阵（SKILL-002 §5）。 */
import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  pickEdge,
  renderSopPrompt,
  sopGraph as sopGraphSchema,
  validateSopGraph,
  type SopGraph,
} from "../sop";

const ok: SopGraph = {
  nodes: [
    { id: "s", type: "start" },
    { id: "llm1", type: "llm", prompt: "总结 {{query}}" },
    { id: "h", type: "human", instruction: "复核" },
    { id: "e1", type: "end" },
  ],
  edges: [
    { from: "s", to: "llm1" },
    { from: "llm1", to: "h" },
    { from: "h", to: "e1" },
  ],
  variables: [{ key: "query", required: true }],
};

describe("validateSopGraph（规则矩阵）", () => {
  it("合法图零错误", () => {
    expect(validateSopGraph(ok)).toEqual([]);
  });
  it("start/end 规则 + id 重复 + 提示缺失", () => {
    const g: SopGraph = {
      nodes: [
        { id: "s", type: "start" },
        { id: "s", type: "start" },
        { id: "llm", type: "llm" },
      ],
      edges: [{ from: "s", to: "llm" }],
      variables: [],
    };
    const errs = validateSopGraph(g);
    expect(errs.some((e) => e.includes("恰好一个 start"))).toBe(true);
    expect(errs.some((e) => e.includes("重复"))).toBe(true);
    expect(errs.some((e) => e.includes("缺少 prompt"))).toBe(true);
    expect(errs.some((e) => e.includes("至少一个 end"))).toBe(true);
  });
  it("边引用/出边规则/兜底后置/不可达", () => {
    const g: SopGraph = {
      nodes: [
        { id: "s", type: "start" },
        { id: "a", type: "llm", prompt: "x" },
        { id: "b", type: "llm", prompt: "y" },
        { id: "e", type: "end" },
        { id: "lonely", type: "llm", prompt: "z" },
      ],
      edges: [
        { from: "s", to: "a", when: { var: "v", op: "eq", value: 1 } },
        { from: "s", to: "b" },
        { from: "s", to: "a", when: { var: "v", op: "eq", value: 2 } },
        { from: "a", to: "nope" },
        { from: "b", to: "e" },
      ],
      variables: [],
    };
    const errs = validateSopGraph(g);
    expect(errs.some((e) => e.includes("兜底边必须声明在最后"))).toBe(true);
    expect(errs.some((e) => e.includes("不存在的目标节点"))).toBe(true);
    expect(errs.some((e) => e.includes("lonely 从 start 不可达"))).toBe(true);
  });
});

describe("evaluateCondition / pickEdge / renderSopPrompt", () => {
  it("四操作 + 类型宽容 + contains 仅字符串", () => {
    expect(evaluateCondition({ var: "s", op: "eq", value: "80" }, { s: 80 })).toBe(true);
    expect(evaluateCondition({ var: "s", op: "neq", value: 1 }, { s: 2 })).toBe(true);
    expect(evaluateCondition({ var: "s", op: "gte", value: 80 }, { s: "90" })).toBe(true);
    expect(evaluateCondition({ var: "s", op: "lte", value: 80 }, { s: 70 })).toBe(true);
    expect(
      evaluateCondition({ var: "s", op: "contains", value: "退款" }, { s: "用户要求退款" }),
    ).toBe(true);
    expect(evaluateCondition({ var: "s", op: "gte", value: "x" }, { s: 1 })).toBe(false);
    expect(evaluateCondition({ var: "缺", op: "eq", value: 1 }, {})).toBe(false);
  });
  it("pickEdge 声明序+兜底", () => {
    const edges = ok.edges;
    expect(pickEdge(edges, {})?.to).toBe("llm1");
    expect(
      pickEdge([{ from: "a", to: "x", when: { var: "v", op: "eq", value: 1 } }], { v: 2 }),
    ).toBeNull();
  });
  it("渲染:命中替换/未识别保留", () => {
    expect(renderSopPrompt("总结 {{query}} 与 {{other}}", { query: "退款政策" })).toBe(
      "总结 退款政策 与 {{other}}",
    );
  });
  it("zod:变量 required 默认 false;节点数下限", () => {
    const r = sopGraphSchema.parse(ok);
    expect(r.variables[0]?.required).toBe(true);
    expect(sopGraphSchema.safeParse({ ...ok, nodes: [ok.nodes[0]!] }).success).toBe(false);
  });
});
