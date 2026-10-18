"use client";

/**
 * CHAT-002 · 纯工具函数（与 React 解耦，便于 vitest 单测）。
 *  - token 预估：input / output（经验估算；M2 接 runtime 真实计算）
 *  - 流式状态机 helpers（折叠 / 折叠 streamingText → messages）
 */

export interface TokenUsage {
  model?: string;
  input?: number;
  output?: number;
  total?: number;
}

/** 估算 token 数：in = ceil(chars / 4)，最低 1；out = in * 6（经验ratio）+ 32（system 头）。
 *  这只是骨架期 UX 反馈用；M2 chatagent 域接真实 runtime 后由 SSE `usage` 事件覆写。 */
export function estimateTokens(input: string): { input: number; output: number } {
  const charCount = input?.length ?? 0;
  const inT = Math.max(1, Math.ceil(charCount / 4));
  const outT = inT * 6 + 32;
  return { input: inT, output: outT };
}

/** 把当前 streamingText 折叠为新 message（message_completed 触发）。
 *  过滤已折叠的（按 id 查重）；不修改源数组。 */
export function appendStreaming(
  messages: Array<{ id: string }>,
  text: string,
  messageId: string,
): Array<{ id: string; content: string; role: "ASSISTANT"; messageId: string }> {
  // 重复检测：相同 messageId 不重复 append（M2 SSE 容错）
  if (messages.some((m) => (m as { messageId?: string }).messageId === messageId)) return [];
  return [...messages, { id: messageId, content: text, role: "ASSISTANT", messageId }] as never;
}

/** 格式化数字 → "1.2K / 8K" 显示（当 ≥ 1000 走 K）。 */
export function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

/** 由 usage 与 modelText 拼出 "modelname · 输入 n / 输出 n tokens" 一行。
 *  用于 toolbar composer 上方的 in/out 预览 + AI 消息元信息行。 */
export function formatUsageLine(
  model: string | undefined,
  usage: TokenUsage | null | undefined,
): string {
  if (!usage) return "";
  const m = model ?? usage.model ?? "model";
  return `${m} · 输入 ${usage.input ?? "-"} / 输出 ${usage.output ?? "-"} tokens`;
}
