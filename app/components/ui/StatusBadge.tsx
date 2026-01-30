"use client";

type StatusBadgeProps = {
  variant: "pending" | "ready" | "resolved";
  label?: string;
};

const STYLES: Record<StatusBadgeProps["variant"], string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  ready: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  resolved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};

const DEFAULT_LABELS: Record<StatusBadgeProps["variant"], string> = {
  pending: "Pending",
  ready: "Ready",
  resolved: "Resolved",
};

export default function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STYLES[variant]}`}>
      {label ?? DEFAULT_LABELS[variant]}
    </span>
  );
}
