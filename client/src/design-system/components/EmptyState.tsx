import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "panel" | "inline";
  className?: string;
}

/**
 * Usage:
 * <EmptyState title="尚未設定交辦事項" description="請新增交辦事項" action={<ActionButton>新增</ActionButton>} />
 */
export function EmptyState({ icon, title, description, action, variant = "panel", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid place-items-center text-center",
        variant === "panel" ? "min-h-[172px] rounded-ds-md bg-surface-soft p-6" : "min-h-24 p-3",
        className,
      )}
    >
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-border-subtle bg-white text-text-muted shadow-sm">
          {icon ?? <Inbox className="h-5 w-5" />}
        </div>
        <p className="mt-4 text-h3 text-text-strong">{title}</p>
        {description ? <p className="mt-1 text-body-sm text-text-body">{description}</p> : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
