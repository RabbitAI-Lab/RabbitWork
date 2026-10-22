/** channel 域 zod（CHNL-001;平台侧网关骨架——上游 channels 404 实证）。 */
import { z } from "zod";

export const CHANNEL_PLATFORMS = ["feishu", "dingtalk", "wecom"] as const;

export const CHANNEL_TOKEN_PREFIX = "rw_ch_";

export const channelCreateInput = z.object({
  name: z.string().trim().min(1).max(128),
  platform: z.enum(CHANNEL_PLATFORMS),
  employeeId: z.string().min(1),
  enabled: z.boolean().optional(),
});
export type ChannelCreateInput = z.infer<typeof channelCreateInput>;

export const channelUpdateInput = channelCreateInput.partial();
export type ChannelUpdateInput = z.infer<typeof channelUpdateInput>;

export const channelDto = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.enum(CHANNEL_PLATFORMS),
  employeeId: z.string(),
  enabled: z.boolean(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ChannelDto = z.infer<typeof channelDto>;

/** 创建响应：token 明文仅此一次 */
export const channelCreatedDto = channelDto.extend({ token: z.string() });
export type ChannelCreatedDto = z.infer<typeof channelCreatedDto>;

/**
 * IM 回调归一提取（CHNL-001 §2.3 宽进）：优先 text 字符串,次钉钉/飞书嵌套形态。
 * 返回 null = 未识别（调用方 422 透出）。
 */
export function extractChannelText(body: unknown): { text: string; extUserId?: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.text === "string" && b.text.trim()) {
    return { text: b.text.trim(), extUserId: typeof b.user === "string" ? b.user : undefined };
  }
  // 钉钉 {text:{content},senderStaffId}
  const ding = b.text as Record<string, unknown> | undefined;
  if (ding && typeof ding.content === "string" && ding.content.trim()) {
    return {
      text: ding.content.trim(),
      extUserId: typeof b.senderStaffId === "string" ? b.senderStaffId : undefined,
    };
  }
  // 飞书 {event:{message:{content}},event:{sender:{sender_id:{open_id}}}}
  const ev = b.event as Record<string, unknown> | undefined;
  if (ev) {
    const msg = ev.message as Record<string, unknown> | undefined;
    const sender = ev.sender as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === "string") {
      let text = msg.content;
      // content 为 JSON 字符串 {"text":"..."} 形态时再解一层
      try {
        const inner = JSON.parse(msg.content) as { text?: unknown };
        if (typeof inner.text === "string") text = inner.text;
      } catch {
        // 原样
      }
      if (text.trim()) {
        const senderId = (sender?.sender_id ?? {}) as Record<string, unknown>;
        return {
          text: text.trim(),
          extUserId: typeof senderId.open_id === "string" ? senderId.open_id : undefined,
        };
      }
    }
  }
  return null;
}
