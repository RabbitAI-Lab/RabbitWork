"use client";

/**
 * CHAT-002 · 对话工作台（DS v2.1）
 * ─────────────────────────────────────────────────────────
 * 双栏布局：左 persona 卡 / 右 消息流 + composer。
 * 沿用 CHAT-001 的 SSE 流式 / chatApi / 入参 / 出参契约 —— 仅改 UI。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { App, Avatar } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { AppShell } from "@/components/AppShell";
import { ChatPersonaCard } from "@/components/ChatPersonaCard";
import { ChatBubble, ChatStreamingBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { chatApi, conversationEventsUrl } from "@rabbit/api-client";
import type { ChatEvent, MessageDto } from "@rabbit/shared";
import "../chat.css";

interface TokenUsage {
  model?: string;
  input?: number;
  output?: number;
  total?: number;
}

const CONTEXT_BUDGET_TOKENS = 8_000;
const SUGGESTIONS = ["用一句话介绍你自己", "你擅长处理哪些工作？", "帮我列一份工作计划"];

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message: ctxMessage } = App.useApp();

  const detail = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => chatApi.detail(id),
    retry: false,
  });

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (detail.data) setMessages(detail.data.messages);
  }, [detail.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const openStream = useCallback(() => {
    closeStream();
    setStreaming(true);
    setStreamingText("");
    const es = new EventSource(conversationEventsUrl(id));
    esRef.current = es;
    es.onmessage = (ev) => {
      let event: ChatEvent;
      try {
        event = JSON.parse(ev.data) as ChatEvent;
      } catch {
        return;
      }
      switch (event.type) {
        case "delta":
          setStreamingText((prev) => prev + event.text);
          break;
        case "message_completed":
          setStreamingText("");
          setMessages((prev) => [
            ...prev,
            {
              id: event.messageId || `local-${Date.now()}`,
              seq: Number.MAX_SAFE_INTEGER - 1,
              role: "ASSISTANT",
              content: event.text,
              tokenUsage: null,
              createdAt: new Date().toISOString(),
            },
          ]);
          break;
        case "usage":
          setLastUsage({
            model: event.model,
            input: event.inputTokens,
            output: event.outputTokens,
            total: event.totalTokens,
          });
          break;
        case "interrupted":
          setStreaming(false);
          setStreamingText("");
          void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
          break;
        case "run_ended":
          break;
        case "error":
          ctxMessage.error(event.message);
          setStreaming(false);
          setStreamingText("");
          break;
        case "done":
          setStreaming(false);
          closeStream();
          void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          break;
      }
    };
    es.onerror = () => {
      setStreaming(false);
      closeStream();
    };
  }, [id, closeStream, ctxMessage, queryClient]);

  useEffect(() => closeStream, [closeStream]);

  const send = useMutation({
    mutationFn: (content: string) => chatApi.send(id, { content }),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, res.userMessage]);
      setInput("");
      openStream();
    },
    onError: (e) => ctxMessage.error(e instanceof Error ? e.message : "发送失败"),
  });

  const employee = detail.data?.employee;
  const employeeName = employee?.name ?? "数字员工";
  const employeeInitial = employeeName.slice(0, 1);

  const submit = () => {
    const v = input.trim();
    if (v && !send.isPending && !streaming) send.mutate(v);
  };

  const onCopy = useCallback(
    (text: string) => {
      navigator.clipboard?.writeText(text).catch(() => {
        ctxMessage.info("复制失败：请手动复制");
      });
    },
    [ctxMessage],
  );

  const onCopyMarkdown = useCallback(
    (text: string) => {
      // M2 接 chatApi.format(messageId, 'md')；骨架期包个代码块
      onCopy("```\n" + text + "\n```");
    },
    [onCopy],
  );

  const onFeedback = useCallback(
    (msg: MessageDto, score: "up" | "down") => {
      ctxMessage.info(`已记录反馈：${score === "up" ? "👍" : "👎"}`);
      // M2 接 chatApi.feedback(msg.id, score)
      void msg;
    },
    [ctxMessage],
  );

  const onRegenerate = useCallback(() => {
    // M2: 找到上一条 user message 并 resend
    ctxMessage.info("重生成（M2 接真实接口）");
  }, [ctxMessage]);

  const onNewChat = useCallback(() => {
    // M2: 创建新会话 + 重定向
    router.push("/office");
  }, [router]);

  const recentTasks = useMemo(
    () => [
      { title: "处理「上线前 a11y 走查」" },
      { title: "输出「Q3 性能周报」" },
      { title: "解答 menu 弹层被裁剪" },
    ],
    [],
  );

  return (
    <AppShell active="office">
      <div className="rw-chat-shell" data-testid="chat-page">
        {/* 左：persona 卡 */}
        <ChatPersonaCard
          employee={
            employee ? { name: employee.name, title: employee.title, personaPrompt: null } : null
          }
          usage={lastUsage}
          totalTokensBudget={CONTEXT_BUDGET_TOKENS}
          recentTasks={recentTasks}
          onNewChat={onNewChat}
        />

        {/* 右：消息流 + composer */}
        <section className="rw-chat-main">
          {/* 头部：大头像 + 状态 + 工具 */}
          <header className="rw-chat-header" data-testid="chat-header">
            <Avatar
              size={40}
              className="avatar-accent rw-chat-header-avatar"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              {employeeInitial}
            </Avatar>
            <div className="rw-chat-header-info">
              <div className="rw-chat-header-title-row">
                <span className="rw-chat-header-name">{employeeName}</span>
                <span
                  className="rw-status-pill"
                  style={{
                    background: streaming ? "var(--rw-accent-subtle)" : "var(--rw-muted-subtle)",
                    color: streaming ? "var(--rw-accent)" : "var(--rw-fg-muted)",
                    borderColor: streaming ? "var(--rw-accent)" : "var(--rw-border)",
                  }}
                  data-testid="chat-status"
                >
                  {streaming ? "回复中…" : "空闲"}
                </span>
              </div>
              <div className="rw-chat-header-sub">
                {employee?.title ?? "数字员工"}
                {employee ? " · 已发布" : ""}
              </div>
            </div>
            <button
              type="button"
              aria-label="返回办公室"
              title="返回办公室"
              data-testid="chat-back"
              onClick={() => router.push("/office")}
              className="rw-icon-btn"
            >
              <ArrowLeftOutlined />
            </button>
          </header>

          {/* 消息流 */}
          <div className="rw-chat-messages scroll-slim" data-testid="chat-messages">
            {messages.length === 0 && !streamingText && !streaming ? (
              <WelcomeBlock onPickSuggestion={setInput} />
            ) : null}

            {messages.map((m, idx) => (
              <ChatBubble
                key={m.id ?? idx}
                role={m.role as "USER" | "ASSISTANT"}
                content={m.content}
                usage={m.tokenUsage as TokenUsage | null}
                name={employeeName}
                onCopy={() => onCopy(m.content)}
                onEdit={() => ctxMessage.info("编辑（M2 接真实接口）")}
                onRegenerate={m.role === "ASSISTANT" ? onRegenerate : undefined}
                onFeedback={m.role === "ASSISTANT" ? (score) => onFeedback(m, score) : undefined}
                onCopyMarkdown={
                  m.role === "ASSISTANT" ? () => onCopyMarkdown(m.content) : undefined
                }
              />
            ))}

            {/* 流式中（无已 submit 文本） */}
            {streaming && streamingText.length === 0 ? (
              <ChatStreamingBubble name={employeeName} partial="" />
            ) : null}
            {/* 流式中（accumulated delta） */}
            {streamingText ? (
              <ChatBubble
                role="ASSISTANT"
                content={streamingText}
                streaming
                usage={lastUsage}
                name={employeeName}
                onCopy={() => onCopy(streamingText)}
                onCopyMarkdown={() => onCopyMarkdown(streamingText)}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>

          {/* 底部 composer */}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={submit}
            streaming={streaming}
            sending={send.isPending}
          />
        </section>
      </div>
    </AppShell>
  );
}

/** 空态 Welcome（不用 antdx Welcome，自己画避免其固定样式与 DS v2.1 冲突） */
function WelcomeBlock({ onPickSuggestion }: { onPickSuggestion: (s: string) => void }) {
  return (
    <div className="rw-welcome" data-testid="chat-welcome">
      <div className="rw-welcome-card">
        <Avatar
          size={56}
          className="avatar-accent"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 600,
          }}
          aria-hidden
        >
          💬
        </Avatar>
        <div className="rw-welcome-title">开始这次对话</div>
        <div className="rw-welcome-pills">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPickSuggestion(s)}
              className="rw-welcome-pill"
              data-testid={`chat-welcome-pill-${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
