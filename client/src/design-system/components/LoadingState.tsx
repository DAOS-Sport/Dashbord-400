import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  variant?: "inline" | "panel" | "page";
  message?: string;
  className?: string;
}

/**
 * Usage:
 * <LoadingState variant="panel" message="資料載入中" />
 */
export function LoadingState({ variant = "inline", message = "載入中...", className }: LoadingStateProps) {
  const content = (
    <div className="inline-flex items-center justify-center gap-2 text-body-sm font-bold text-text-body">
      <Loader2 className="h-4 w-4 animate-spin text-accent-teal" />
      <span>{message}</span>
    </div>
  );

  if (variant === "page") {
    return <div className={cn("grid min-h-dvh place-items-center bg-surface-base p-6", className)}>{content}</div>;
  }

  if (variant === "panel") {
    return <div className={cn("grid min-h-[148px] place-items-center rounded-ds-md border border-border-default bg-surface-elevated p-6 shadow-card-rest", className)}>{content}</div>;
  }

  return <div className={cn("py-2", className)}>{content}</div>;
}
