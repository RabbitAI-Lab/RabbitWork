"use client";

/**
 * CHAT-002 · 消息气泡（用户 / AI 两种 placement，hover 显示 5 个 icon-btn 操作）。
 *
 * - 用户：end placement + bubble-user 样式，hover 显示 复制 / 编辑
 * - AI  ：start placement + bubble-agent 样式 + 头像 + 元信息 + hover 显示 复制 / 重生成 / 👍 / 👎 / 复制 md
 * - 流式中：AI 气泡末尾显示 accent 光标 `▍`（独立 span 避免 React text diff 抖动）
 */

import { Avatar } from "antd";
import { formatUsageLine } from "@/app/chat/utils";

type Role = "USER" | "ASSISTANT";

/** OBS-001 反馈语义：再点当前评分 = 撤销（null）；👍/👎 互斥切换 */
type FeedbackNext = "UP" | "DOWN" | null;

interface ChatBubbleProps {
  role: Role;
  content: string;
  streaming?: boolean;
  usage?: { model?: string; input?: number; output?: number; total?: number } | null;
  name?: string;
  /** 本条消息既有反馈（OBS-001；用户消息恒 undefined） */
  feedback?: { rating: "UP" | "DOWN"; comment: string | null } | null;
  onCopy?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (next: FeedbackNext) => void;
  onCopyMarkdown?: () => void;
}

export function ChatBubble({
  role,
  content,
  streaming,
  usage,
  name,
  feedback,
  onCopy,
  onEdit,
  onRegenerate,
  onFeedback,
  onCopyMarkdown,
}: ChatBubbleProps) {
  const isUser = role === "USER";
  const avatarName = (name ?? "员").slice(0, 1);

  // 用户气泡（end placement，右上 meta 在外 / hover 操作在气泡上方）
  if (isUser) {
    return (
      <div className="rw-row-host rw-bubble-host" data-testid="bubble-user">
        <div className="rw-bubble-actions">
          <button
            type="button"
            aria-label="复制"
            title="复制"
            onClick={onCopy}
            className="rw-icon-btn"
          >
            ⧉
          </button>
          <button
            type="button"
            aria-label="编辑"
            title="编辑"
            onClick={onEdit}
            className="rw-icon-btn"
          >
            ✎
          </button>
        </div>
        <div className="bubble-row">
          <div className="bubble-user">
            <span className="rw-bubble-text">{content}</span>
            {streaming && (
              <span className="rw-bubble-cursor" aria-hidden="true">
                ▍
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // AI 气泡（start placement，左上 头像 / meta / 气泡 / hover 5 操作）
  return (
    <div className="rw-row-ai rw-bubble-host" data-testid="bubble-assistant">
      <Avatar size={28} className="avatar-accent rw-bubble-avatar" aria-hidden="true">
        {avatarName}
      </Avatar>
      <div className="rw-col-text">
        {usage && (
          <div className="rw-ai-meta" data-testid="chat-bubble-meta">
            <span>{name ?? "数字员工"}</span>
            <span className="rw-ai-meta-dot">·</span>
            <span className="font-mono">回复中</span>
            <span className="rw-ai-meta-dot">·</span>
            <span className="rw-ai-meta-tokens">{formatUsageLine(name, usage) || " "}</span>
          </div>
        )}
        <div className="bubble-row">
          <div className="bubble-agent">
            <span className="rw-bubble-text">{content}</span>
            {streaming && (
              <span className="rw-bubble-cursor" aria-hidden="true">
                ▍
              </span>
            )}
          </div>
        </div>
        <div className="rw-bubble-actions">
          <button
            type="button"
            aria-label="复制"
            title="复制"
            onClick={onCopy}
            className="rw-icon-btn"
          >
            ⧉
          </button>
          <button
            type="button"
            aria-label="重生成"
            title="重生成"
            onClick={onRegenerate}
            className="rw-icon-btn"
          >
            ↻
          </button>
          <button
            type="button"
            aria-label="点赞"
            title={feedback?.rating === "UP" ? "撤销反馈" : "有帮助"}
            aria-pressed={feedback?.rating === "UP"}
            data-state={feedback?.rating === "UP" ? "active" : undefined}
            data-testid="msg-feedback-up"
            onClick={() => onFeedback?.(feedback?.rating === "UP" ? null : "UP")}
            className="rw-icon-btn"
          >
            👍
          </button>
          <button
            type="button"
            aria-label="点踩"
            title={feedback?.rating === "DOWN" ? "撤销反馈" : "没帮助"}
            aria-pressed={feedback?.rating === "DOWN"}
            data-state={feedback?.rating === "DOWN" ? "active" : undefined}
            data-testid="msg-feedback-down"
            onClick={() => onFeedback?.(feedback?.rating === "DOWN" ? null : "DOWN")}
            className="rw-icon-btn"
          >
            👎
          </button>
          <button
            type="button"
            aria-label="复制为 Markdown"
            title="复制为 Markdown"
            onClick={onCopyMarkdown}
            className="rw-icon-btn"
          >
            ⎘
          </button>
        </div>
      </div>
    </div>
  );
}

/** 流式中：thinking 3 跳点 + accent 光标（在消息流中渲染，未达 message_completed 之前用）。 */
export function ChatStreamingBubble({ name, partial }: { name: string; partial: string }) {
  return (
    <div className="rw-row-ai rw-bubble-host" data-testid="chat-bubble-streaming">
      <Avatar size={28} className="avatar-accent rw-bubble-avatar" aria-hidden="true">
        {(name ?? "员").slice(0, 1)}
      </Avatar>
      <div className="rw-col-text">
        <div className="rw-ai-meta">
          <span>{name}</span>
          <span className="rw-ai-meta-dot">·</span>
          <span>正在思考</span>
          <span className="rw-thinking-dots" aria-hidden="true">
            <span className="rw-thinking-dot" />
            <span className="rw-thinking-dot" />
            <span className="rw-thinking-dot" />
          </span>
        </div>
        <div className="bubble-row">
          <div className="bubble-agent">
            <span className="rw-bubble-text">{partial}</span>
            <span className="rw-bubble-cursor" aria-hidden="true">
              ▍
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
