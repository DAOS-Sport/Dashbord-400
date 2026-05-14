import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ContentCardProps {
  tone?: "normal" | "pinned" | "must-read";
  header: ReactNode;
  body: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const toneClass = {
  normal: "before:bg-state-normal",
  pinned: "before:bg-state-reminder",
  "must-read": "before:bg-state-must-read",
};

/**
 * Usage:
 * <ContentCard tone="pinned" header={<Title />} body={<Summary />} actions={<Buttons />} />
 */
export function ContentCard({ tone = "normal", header, body, actions, className }: ContentCardProps) {
  return (
    <article className={cn("relative overflow-hidden rounded-ds-md border border-border-default bg-surface-elevated shadow-card-rest backdrop-blur-xl before:absolute before:inset-y-0 before:left-0 before:w-1", toneClass[tone], className)}>
      <div className="grid gap-3 p-4 pl-5">
        <div>{header}</div>
        <div className="text-body-sm text-text-body">{body}</div>
        {actions ? <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">{actions}</div> : null}
      </div>
    </article>
  );
}
