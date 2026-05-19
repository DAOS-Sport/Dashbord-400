import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "panel" | "inline";
  className?: string;
}

export function ErrorState({ title, description, action, variant = "panel", className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-ds-md border border-state-must-read/25 bg-state-must-read/8 text-state-must-read",
        variant === "panel" ? "p-4" : "p-3",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-label-md font-black">{title}</p>
          {description ? <p className="mt-1 text-body-sm text-text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
