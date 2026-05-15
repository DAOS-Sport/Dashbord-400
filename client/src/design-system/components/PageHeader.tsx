import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Usage:
 * <PageHeader title="群組重要公告" subtitle="Pinned announcements" actions={<ActionButton>回首頁</ActionButton>} />
 */
export function PageHeader({ title, subtitle, actions, breadcrumb, variant = "default", className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", variant === "compact" && "gap-3", className)}>
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-2 text-micro uppercase tracking-[0.12em] text-text-muted">{breadcrumb}</div> : null}
        <h1 className={cn("text-h1 font-bold text-text-strong", variant === "compact" && "text-h2")}>{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-body-sm font-medium text-text-body">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
