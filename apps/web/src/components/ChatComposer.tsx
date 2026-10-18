"use client";

/**
 * CHAT-002 · chat 输入区（底部 composer）
 * 三层：① 工具栏（附件 / 代码 / 任务上下文 / 人格切换 + 上下文计数）
 *      ② textarea + 边框 focus 态
 *      ③ hint + token 预估 + 发送 / 打断按钮（流式时切换 stop）
 */

import { useCallback } from "react";
import { StopOutlined, SendOutlined } from "@ant-design/icons";
import { estimateTokens } from "@/app/chat/utils";

interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  sending: boolean;
  onInterrupt: () => void;
  contextCount: number;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  streaming,
  sending,
  onInterrupt,
  contextCount,
}: ChatComposerProps) {
  const { input: inT, output: outT } = estimateTokens(value);

  /** ⌘↵ 发送 / Shift+↵ 换行（M2 完整化键盘：M2 接 hotkey lib） */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!streaming && !sending && value.trim()) onSubmit();
      }
    },
    [onSubmit, streaming, sending, value],
  );

  const disabled = streaming || sending || !value.trim();

  return (
    <div className="rw-composer" data-testid="chat-composer">
      <div className="rw-composer-card">
        {/* 工具栏 */}
        <div className="rw-composer-toolbar">
          <button
            type="button"
            aria-label="附件"
            title="附件（图片 / 文件）"
            className="rw-toolbar-icon"
          >
            📎
          </button>
          <button type="button" aria-label="代码片段" title="代码片段" className="rw-toolbar-icon">
            ⌨
          </button>
          <button
            type="button"
            aria-label="任务上下文"
            title="任务上下文（注入当前任务）"
            className="rw-toolbar-icon"
          >
            📋
          </button>
          <button type="button" aria-label="人格切换" title="人格切换" className="rw-toolbar-icon">
            🧪
          </button>
          <div className="rw-composer-toolbar-spacer" />
          <span className="rw-composer-context-count" data-testid="chat-context-count">
            已选 {contextCount} 个上下文
          </span>
        </div>

        {/* 输入区 */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="向数字员工发送消息…"
          data-testid="chat-input"
          className="rw-composer-input"
          rows={1}
          aria-label="消息输入"
        />

        {/* 底部行 */}
        <div className="rw-composer-row">
          <div className="rw-composer-hint">
            <span className="rw-kbd">⌘</span>
            <span className="rw-kbd">↵</span>
            <span>&nbsp;发送 ·&nbsp;</span>
            <span className="rw-kbd">⇧</span>
            <span className="rw-kbd">↵</span>
            <span>&nbsp;换行</span>
          </div>
          <div className="rw-composer-actions">
            <span className="rw-composer-tokens" data-testid="chat-composer-tokens">
              in {inT} / out ~{outT}
            </span>
            {streaming ? (
              <button
                type="button"
                aria-label="打断回复"
                data-testid="chat-interrupt"
                className="rw-send-btn rw-stop-btn"
                onClick={onInterrupt}
              >
                <StopOutlined />
              </button>
            ) : (
              <button
                type="button"
                aria-label="发送"
                data-testid="chat-send"
                className="rw-send-btn"
                disabled={disabled}
                onClick={onSubmit}
              >
                <SendOutlined />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
