import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TagVariant = "must-read" | "important" | "reminder" | "priority" | "normal" | "success" | "muted";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  size?: "sm" | "md";
}

const variantClass: Record<TagVariant, string> = {
  "must-read": "bg-state-must-read/12 text-state-must-read ring-state-must-read/18",
  important: "bg-state-important/12 text-state-important ring-state-important/18",
  reminder: "bg-state-reminder/12 text-state-reminder ring-state-reminder/18",
  priority: "bg-state-priority/12 text-state-priority ring-state-priority/18",
  normal: "bg-state-normal/12 text-state-normal ring-state-normal/18",
  success: "bg-state-success/12 text-state-success ring-state-success/18",
  muted: "bg-state-muted/10 text-state-muted ring-state-muted/16",
};

const sizeClass = {
  sm: "min-h-6 px-2 text-[11px]",
  md: "min-h-7 px-2.5 text-[12px]",
};

/**
 * Usage:
 * <PriorityTag variant="priority">優先</PriorityTag>
 * <StatusTag variant="success">已完成</StatusTag>
 */
function BaseTag({ variant = "normal", size = "sm", className, children, ...props }: TagProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-ds-pill font-bold ring-1", variantClass[variant], sizeClass[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}

export const PriorityTag = BaseTag;
export const StatusTag = BaseTag;
