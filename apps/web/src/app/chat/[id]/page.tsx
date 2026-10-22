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
import { App, Avatar, Input, Modal } from "antd";
import { ArrowLeftOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { AppShell } from "@/components/AppShell";
import { ChatPersonaCard } from "@/components/ChatPersonaCard";
import { ChatBubble, ChatStreamingBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { chatApi, conversationEventsUrl, handoffApi, obsApi } from "@rabbit/api-client";
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
  /** OBS-001 👎 评语弹层目标消息 */
  const [feedbackTarget, setFeedbackTarget] = useState<MessageDto | null>(null);
  /** CHAT-003 转人工弹层 */
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffReason, setHandoffReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 用户上翻看历史时不强制吸底（距底 <80px 才跟随；流式中 instant 防动画竞态） */
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    if (detail.data) setMessages(detail.data.messages);
  }, [detail.data]);

  useEffect(() => {
    if (isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
    }
  }, [messages, streamingText, streaming, isNearBottom]);

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
              feedback: null,
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
          // 终态清空流式文本：message_completed 竞态漏掉时，不留"无反馈按钮的
          // 僵尸气泡"（invalidate 后由镜像消息补全——OBS-001 e2e 实证的缺陷）
          setStreamingText("");
          closeStream();
          void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          break;
      }
    };
    es.onerror = () => {
      setStreaming(false);
      setStreamingText("");
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

  /** 反馈提交：乐观更新 + 失败回滚并透出真实原因（rules/react-nextjs §5.7） */
  const submitFeedback = useCallback(
    async (msg: MessageDto, rating: "UP" | "DOWN" | null, comment?: string) => {
      const prev = msg.feedback ?? null;
      setMessages((rows) =>
        rows.map((m) =>
          m.id === msg.id
            ? { ...m, feedback: rating ? { rating, comment: comment ?? null } : null }
            : m,
        ),
      );
      try {
        await obsApi.feedback(msg.id, { rating, comment });
        ctxMessage.success(rating === null ? "已撤销反馈" : "已记录反馈");
      } catch (e) {
        setMessages((rows) => rows.map((m) => (m.id === msg.id ? { ...m, feedback: prev } : m)));
        ctxMessage.error(e instanceof Error ? e.message : "反馈失败");
      }
    },
    [ctxMessage],
  );

  const handoff = useMutation({
    mutationFn: (reason: string) => chatApi.handoff(id, { reason }),
    onSuccess: () => {
      ctxMessage.success("已转人工——会话暂停自动回复");
      setHandoffOpen(false);
      setHandoffReason("");
      void queryClient.invalidateQueries({ queryKey: ["conversation", id] });
    },
    onError: (e) => ctxMessage.error(e instanceof Error ? e.message : "转人工失败"),
  });

  const onFeedback = useCallback(
    (msg: MessageDto, next: "UP" | "DOWN" | null) => {
      // 再点当前评分 = 撤销；DOWN 走评语弹层（可选填）；UP 直接提交（OBS-001 §2.1）
      if (next === null) {
        void submitFeedback(msg, null);
        return;
      }
      if (next === "DOWN") {
        setFeedbackComment("");
        setFeedbackTarget(msg);
        return;
      }
      void submitFeedback(msg, "UP");
    },
    [submitFeedback],
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

          {/* CHAT-003：HANDOFF 黄条 + 转人工入口 */}
          {detail.data?.conversation.status === "HANDOFF" && (
            <div
              className="bg-rw-warning-subtle border-rw-warning text-rw-warning mb-3 flex items-center justify-between rounded-rw-md border px-4 py-2 text-[13px]"
              data-testid="handoff-banner"
            >
              <span>人工处理中——员工暂停自动回复,解决接管后恢复</span>
              <button
                type="button"
                className="text-rw-accent text-xs underline"
                onClick={() => router.push("/handoffs")}
              >
                去处理 →
              </button>
            </div>
          )}
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setHandoffOpen(true)}
              disabled={detail.data?.conversation.status === "HANDOFF"}
              className="text-rw-fg-muted hover:text-rw-accent inline-flex items-center gap-1 text-xs transition-colors duration-[140ms] ease-out disabled:opacity-40"
              data-testid="handoff-btn"
            >
              <UserSwitchOutlined /> 转人工
            </button>
          </div>

          {/* 消息流 */}
          <div ref={scrollRef} className="rw-chat-messages scroll-slim" data-testid="chat-messages">
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
                feedback={m.feedback ?? null}
                onCopy={() => onCopy(m.content)}
                onEdit={() => ctxMessage.info("编辑（M2 接真实接口）")}
                onRegenerate={m.role === "ASSISTANT" ? onRegenerate : undefined}
                onFeedback={m.role === "ASSISTANT" ? (next) => onFeedback(m, next) : undefined}
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

        {/* CHAT-003 转人工弹层 */}
        <Modal
          title="转人工处理"
          open={handoffOpen}
          onCancel={() => setHandoffOpen(false)}
          onOk={() => handoffReason.trim() && handoff.mutate(handoffReason.trim())}
          okText="转人工"
          cancelText="取消"
          confirmLoading={handoff.isPending}
          destroyOnHidden
        >
          <p className="text-rw-fg-subtle mb-2 text-xs">
            会话将暂停自动回复,由人工在「人工接管」工作台处理
          </p>
          <Input.TextArea
            data-testid="handoff-reason-input"
            rows={3}
            maxLength={512}
            value={handoffReason}
            onChange={(e) => setHandoffReason(e.target.value)}
            placeholder="转人工原因（必填）,如：退款诉求超出答复边界"
          />
        </Modal>

        {/* 👎 反馈评语弹层（OBS-001 §2.1：评语可选，仅 DOWN） */}
        <Modal
          title="告诉我们哪里没帮上"
          open={feedbackTarget !== null}
          onCancel={() => setFeedbackTarget(null)}
          okText="提交反馈"
          cancelText="取消"
          onOk={() => {
            const target = feedbackTarget;
            setFeedbackTarget(null);
            if (target) void submitFeedback(target, "DOWN", feedbackComment || undefined);
          }}
          destroyOnHidden
        >
          <p className="text-rw-fg-subtle mb-3 text-xs">
            评语可选；它会进入反馈看板，用于改进员工表现
          </p>
          <Input.TextArea
            data-testid="feedback-comment-input"
            rows={3}
            maxLength={1024}
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            placeholder="如：结论太笼统，缺少数据支撑…"
          />
        </Modal>
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
