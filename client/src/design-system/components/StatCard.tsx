import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "neutral" | "warning" | "success" | "danger";
  icon?: LucideIcon;
  helper?: string;
  className?: string;
}

const toneClass = {
  neutral: "before:bg-state-normal text-state-normal",
  warning: "before:bg-state-must-read text-state-must-read",
  success: "before:bg-state-success text-state-success",
  danger: "before:bg-state-priority text-state-priority",
};

/**
 * Usage:
 * <StatCard label="待處理" value={12} tone="warning" icon={Clock} />
 */
export function StatCard({ label, value, tone = "neutral", icon: Icon, helper, className }: StatCardProps) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-ds-md border border-border-default bg-surface-elevated p-4 shadow-card-rest backdrop-blur-xl before:absolute before:inset-y-4 before:left-0 before:w-1",
        toneClass[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <p className="text-caption uppercase tracking-[0.12em] text-text-muted">{label}</p>
          <p className="mt-2 text-[28px] font-bold leading-none text-text-strong">{value}</p>
          {helper ? <p className="mt-2 text-body-sm text-text-body">{helper}</p> : null}
        </div>
        {Icon ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ds-md bg-current/10">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
