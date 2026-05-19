import type { ReactNode } from "react";
import { ContentCard } from "./ContentCard";
import { PriorityTag, type TagVariant } from "./Tags";

export interface AnnouncementCardProps {
  title: string;
  summary?: string;
  body?: string;
  badges?: Array<{ label: string; variant?: TagVariant }>;
  actions?: ReactNode;
  tone?: "normal" | "pinned" | "must-read";
}

export function AnnouncementCard({ title, summary, body, badges = [], actions, tone = "normal" }: AnnouncementCardProps) {
  return (
    <ContentCard
      tone={tone}
      header={
        <div className="grid gap-2">
          {badges.length ? (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((badge) => <PriorityTag key={`${badge.label}-${badge.variant ?? "normal"}`} variant={badge.variant}>{badge.label}</PriorityTag>)}
            </div>
          ) : null}
          <h3 className="text-title-sm font-black text-text-strong">{title}</h3>
        </div>
      }
      body={<p className="line-clamp-3">{summary || body || ""}</p>}
      actions={actions}
    />
  );
}
