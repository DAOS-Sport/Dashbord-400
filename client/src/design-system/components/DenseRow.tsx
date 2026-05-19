import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DenseRowProps {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DenseRow({ leading, title, description, meta, actions, className }: DenseRowProps) {
  return (
    <div className={cn("grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0", className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0">
        <div className="truncate text-label-md font-black text-text-strong">{title}</div>
        {description ? <div className="truncate text-body-xs text-text-muted">{description}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta}
        {actions}
      </div>
    </div>
  );
}
