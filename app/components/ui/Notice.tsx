"use client";
import type { ReactNode } from "react";

type NoticeProps = {
  variant: "success" | "error" | "info";
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  children?: ReactNode;
};

const STYLES: Record<NoticeProps["variant"], string> = {
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  error: "border-red-500/40 bg-red-500/10 text-red-200",
  info: "border-zinc-700/60 bg-zinc-900/40 text-zinc-200",
};

export default function Notice({
  variant,
  title,
  description,
  actionLabel,
  actionHref,
  children,
}: NoticeProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${STYLES[variant]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="text-xs opacity-80">{description}</p> : null}
        </div>
        {actionLabel && actionHref ? (
          <a className="underline text-xs opacity-90 hover:opacity-100" href={actionHref}>
            {actionLabel}
          </a>
        ) : null}
      </div>
      {children ? <div className="mt-2 text-xs opacity-80">{children}</div> : null}
    </div>
  );
}
