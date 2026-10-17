/** 品牌标识：运行绿方块 + 兔耳字母标 + 文字标（DS v2.1 语义 token）。 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="avatar-accent inline-flex items-center justify-center rounded-rw-sm"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* 简约兔首:双耳 + 圆脸 */}
        <path d="M8 5c0-1.7 .9-3 2-3s2 1.3 2 3" />
        <path d="M13 4.5c.2-1.5 1-2.5 2-2.5 1.1 0 2 1.3 2 3" />
        <circle cx="12.5" cy="13.5" r="6.5" />
        <path d="M10 13.5h.01M15 13.5h.01" />
      </svg>
    </span>
  );
}

export function BrandWord({ subtitle }: { subtitle?: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="font-display text-[15px] font-semibold tracking-tight text-rw-fg">
        RabbitWork
      </span>
      {subtitle && <span className="text-[11px] text-rw-fg-subtle">{subtitle}</span>}
    </span>
  );
}
