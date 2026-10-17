/** 状态标签（DS v2.1 MASTER §1.1/§2）：胶囊 + 语义底；仅 success 态呼吸点（「活着」语义）。 */
const STATUS_STYLE = {
  PUBLISHED: { label: "在岗", cls: "bg-rw-success-subtle text-rw-success", pulse: true },
  DRAFT: { label: "草稿", cls: "bg-rw-warning-subtle text-rw-warning", pulse: false },
  OFFLINE: { label: "下线", cls: "bg-rw-danger-subtle text-rw-danger", pulse: false },
  DISABLED: { label: "禁用", cls: "bg-rw-muted-subtle text-rw-fg-muted", pulse: false },
} as const;

export type PillStatus = keyof typeof STATUS_STYLE;

export function StatusPill({
  status,
  custom,
}: {
  status?: PillStatus;
  custom?: { label: string; tone: "success" | "warning" | "danger" | "muted" };
}) {
  const conf = custom
    ? {
        label: custom.label,
        cls: {
          success: STATUS_STYLE.PUBLISHED.cls,
          warning: STATUS_STYLE.DRAFT.cls,
          danger: STATUS_STYLE.OFFLINE.cls,
          muted: STATUS_STYLE.DISABLED.cls,
        }[custom.tone],
        pulse: custom.tone === "success",
      }
    : (STATUS_STYLE[status ?? "DRAFT"] ?? STATUS_STYLE.DRAFT);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${conf.cls}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${conf.pulse ? "animate-pulse-dot" : ""}`}
      />
      {conf.label}
    </span>
  );
}
