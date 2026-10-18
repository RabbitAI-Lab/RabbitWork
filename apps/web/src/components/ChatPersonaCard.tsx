"use client";

/**
 * CHAT-002 · 左栏「员工 persona 卡」
 * 6 区：头像 + 状态 / persona 引文 / skills chips / token 用量条 / 最近任务 / 新对话按钮
 */

import { formatTokenCount } from "@/app/chat/utils";

interface PersonaCardProps {
  employee: { name: string; title: string; personaPrompt?: string | null } | null;
  usage: { model?: string; input?: number; output?: number; total?: number } | null;
  totalTokensBudget: number;
  recentTasks: Array<{ title: string }>;
  onNewChat: () => void;
}

export function ChatPersonaCard({
  employee,
  usage,
  totalTokensBudget,
  recentTasks,
  onNewChat,
}: PersonaCardProps) {
  const name = employee?.name ?? "数字员工";
  const title = employee?.title ?? "";
  const initial = name.slice(0, 1);
  const personaQuote =
    employee?.personaPrompt && employee.personaPrompt.length > 0
      ? truncateQuote(employee.personaPrompt, 80)
      : "（该员工尚未填写 persona 摘要）";
  const usedTokens = usage?.total ?? 0;
  const budgetPct = clampPct((usedTokens / Math.max(1, totalTokensBudget)) * 100);

  return (
    <aside className="rw-persona-card" data-testid="chat-persona" aria-label="员工 persona 卡">
      {/* 1. 头像 + 状态 */}
      <div className="rw-persona-avatar">
        <div className="relative">
          <div className="rw-persona-avatar-circle avatar-accent">{initial}</div>
          <span className="rw-persona-online-dot" aria-hidden="true" />
        </div>
        <div className="rw-persona-name-wrap">
          <div className="rw-persona-name font-display">{name}</div>
          <div className="rw-persona-title">{title || "数字员工"}</div>
        </div>
        <span className="rw-status-pill rw-status-idle" data-testid="chat-persona-status">
          空闲
        </span>
      </div>

      {/* 2. persona 摘要 */}
      <section className="rw-persona-section">
        <h3 className="rw-persona-eyebrow">风格画像</h3>
        <p className="rw-persona-quote">{personaQuote}</p>
      </section>

      {/* 3. 擅长 */}
      <section className="rw-persona-section">
        <h3 className="rw-persona-eyebrow">擅长</h3>
        <div className="rw-persona-skills">
          {(employee?.title ? guessSkillsFromTitle(employee.title) : FALLBACK_SKILLS).map((s) => (
            <span key={s} className="rw-skill-chip" data-testid={`chat-skill-${s}`}>
              <span className="rw-skill-dot" aria-hidden="true" />
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* 4. token 用量条 */}
      <section className="rw-persona-section">
        <div className="rw-persona-eyebrow-row">
          <h3 className="rw-persona-eyebrow">本会话 token</h3>
          <span className="rw-persona-num">
            {formatTokenCount(usedTokens)} / {formatTokenCount(totalTokensBudget)}
          </span>
        </div>
        <div className="rw-usage-bar">
          <span style={{ width: `${budgetPct}%` }} />
        </div>
      </section>

      {/* 5. 最近任务（mock 接口，M2 接真实） */}
      <section className="rw-persona-section">
        <h3 className="rw-persona-eyebrow">最近任务</h3>
        <div className="rw-persona-tasks" data-testid="chat-persona-tasks">
          {recentTasks.length === 0 ? (
            <p className="rw-persona-empty">（尚无完成任务）</p>
          ) : (
            recentTasks.slice(0, 3).map((t, i) => (
              <button key={i} className="rw-task-pill" data-testid={`chat-task-${i}`}>
                <span aria-hidden="true">📋</span>
                <span>{t.title}</span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* 6. 新对话 */}
      <button
        type="button"
        onClick={onNewChat}
        data-testid="chat-new-conversation"
        className="rw-persona-new-chat"
      >
        <span aria-hidden="true">＋</span>
        新对话
      </button>
    </aside>
  );
}

const FALLBACK_SKILLS = ["对话", "问答"];

function guessSkillsFromTitle(title: string): string[] {
  const dict: Record<string, string[]> = {
    前端: ["React 19", "TypeScript", "Next.js", "Tailwind", "a11y"],
    后端: ["Node.js", "PostgreSQL", "REST", "缓存"],
    设计: ["Figma", "动效", "可访问性"],
  };
  for (const key of Object.keys(dict)) {
    if (title.includes(key)) return dict[key]!;
  }
  return FALLBACK_SKILLS;
}

function truncateQuote(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}
