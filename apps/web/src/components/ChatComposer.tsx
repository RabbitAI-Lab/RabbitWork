"use client";

/**
 * CHAT-002 · chat 输入区（底部 composer）
 * textarea + 边框 focus 态；⌘↵ 发送 / Shift+↵ 换行（工具栏与底部行已按走查移除）
 */

import { useCallback } from "react";

interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  sending: boolean;
}

export function ChatComposer({ value, onChange, onSubmit, streaming, sending }: ChatComposerProps) {
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

  return (
    <div className="rw-composer" data-testid="chat-composer">
      <div className="rw-composer-card">
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
      </div>
    </div>
  );
}
