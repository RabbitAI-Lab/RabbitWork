"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { App, Avatar, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Bubble, Sender, Welcome } from "@ant-design/x";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { chatApi, conversationEventsUrl } from "@rabbit/api-client";
import type { ChatEvent, MessageDto } from "@rabbit/shared";

interface TokenUsage {
  model?: string;
  input?: number;
  output?: number;
  total?: number;
}

const SUGGESTIONS = ["用一句话介绍你自己", "你擅长处理哪些工作？", "帮我列一份工作计划"];

/** CHAT-001 对话工作台（DS v2.1 §4）：Ant Design X（Bubble/Sender/Welcome）+ SSE 流式渲染 + 打断。 */
export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

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
          message.error(event.message);
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
      // 服务端 done 后主动 close；异常断开时兜底复位
      setStreaming(false);
      closeStream();
    };
  }, [id, closeStream, message, queryClient]);

  useEffect(() => closeStream, [closeStream]);

  const send = useMutation({
    mutationFn: (content: string) => chatApi.send(id, { content }),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, res.userMessage]);
      setInput("");
      openStream();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : "发送失败"),
  });

  const interrupt = useMutation({
    mutationFn: () => chatApi.interrupt(id),
    onSuccess: () => {
      setStreaming(false);
      closeStream();
      setStreamingText("");
      message.info("已打断");
    },
  });

  const employee = detail.data?.employee;
  const employeeName = employee?.name ?? "数字员工";

  return (
    <AppShell active="office">
      <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-4 sm:px-6" data-testid="chat-page">
        {/* 会话头 */}
        <div className="border-rw-border bg-rw-card mb-3 flex items-center justify-between rounded-rw-md border px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={<ArrowLeftOutlined className="text-rw-fg-subtle" />}
              aria-label="返回办公室"
              onClick={() => router.push("/office")}
            />
            <Avatar size={38} className="avatar-accent !flex !items-center !justify-center">
              <span className="text-sm font-medium">{employeeName.slice(0, 1)}</span>
            </Avatar>
            <div>
              <div className="text-[15px] font-semibold text-rw-fg">{employeeName}</div>
              <div className="text-xs text-rw-fg-subtle">{employee?.title ?? "数字员工"}</div>
            </div>
          </div>
          <span data-testid="chat-status">
            <StatusPill custom={streaming ? { label: "回复中…", tone: "success" } : { label: "空闲", tone: "muted" }} />
          </span>
        </div>

        {/* 消息区 */}
        <div
          className="scroll-slim border-rw-border bg-rw-card/70 flex-1 space-y-4 overflow-y-auto rounded-rw-md border p-5"
          data-testid="chat-messages"
        >
          {messages.length === 0 && !streamingText && !streaming && (
            <div className="flex h-full items-center justify-center py-10">
              <Welcome
                title={`与 ${employeeName} 开始对话`}
                description="发布后的数字员工由 AgentScope 运行时驱动"
                extra={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInput(s)}
                        className="border-rw-border-strong bg-rw-card text-rw-fg-muted hover:border-rw-accent hover:text-rw-accent rounded-rw-sm border px-3.5 py-1.5 text-xs transition-all duration-[140ms] ease-out hover:-translate-y-px active:scale-95"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                }
              />
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} usage={m.tokenUsage as TokenUsage | null} name={employeeName} />
          ))}

          {streaming && !streamingText && (
            <Bubble
              placement="start"
              avatar={
                <Avatar size={28} className="avatar-accent !flex !items-center !justify-center">
                  <span className="text-xs">{employeeName.slice(0, 1)}</span>
                </Avatar>
              }
              content=""
              loading
            />
          )}
          {streamingText && <MessageBubble role="ASSISTANT" content={streamingText} streaming name={employeeName} />}
          <div ref={bottomRef} />
        </div>

        {/* 输入区（Ant Design X Sender：Enter 发送 / loading 态停止按钮） */}
        <div className="mt-3">
          {lastUsage && (
            <div className="text-rw-fg-subtle mb-2 text-center font-mono text-[11px]" data-testid="chat-usage">
              {lastUsage.model} · 输入 {lastUsage.input ?? "-"} / 输出 {lastUsage.output ?? "-"} tokens
            </div>
          )}
          <Sender
            value={input}
            onChange={setInput}
            onSubmit={(v) => {
              const c = v.trim();
              if (c && !send.isPending && !streaming) send.mutate(c);
            }}
            loading={streaming}
            onCancel={() => interrupt.mutate()}
            disabled={send.isPending}
            placeholder={`向 ${employeeName} 发送消息…（Enter 发送，Shift+Enter 换行）`}
            data-testid="chat-input"
          />
        </div>
      </div>
    </AppShell>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
  usage,
  name,
}: {
  role: string;
  content: string;
  streaming?: boolean;
  usage?: TokenUsage | null;
  name?: string;
}) {
  const isUser = role === "USER";
  const avatarName = (name ?? "员").slice(0, 1);
  return (
    <Bubble
      placement={isUser ? "end" : "start"}
      avatar={
        isUser ? undefined : (
          <Avatar size={28} className="avatar-accent !mt-0.5 !flex !shrink-0 !items-center !justify-center">
            <span className="text-xs">{avatarName}</span>
          </Avatar>
        )
      }
      content={
        <>
          <span className="whitespace-pre-wrap">{content}</span>
          {streaming && <span className="text-rw-accent animate-blink ml-0.5 font-semibold">▍</span>}
          {usage?.total != null && (
            <div className="text-rw-fg-subtle mt-1 font-mono text-[11px]">
              {usage.model} · {usage.input ?? "-"} 输入 / {usage.output ?? "-"} 输出 tokens
            </div>
          )}
        </>
      }
      classNames={{ content: isUser ? "bubble-user" : "bubble-agent" }}
      data-testid={isUser ? "bubble-user" : "bubble-assistant"}
    />
  );
}
