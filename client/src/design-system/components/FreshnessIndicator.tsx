import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FreshnessProfile = "realtime" | "5min" | "1hour" | "daily" | "manual";

export interface FreshnessIndicatorProps {
  profile: FreshnessProfile;
  lastSyncAt?: string | null;
  className?: string;
}

const profileLabel: Record<FreshnessProfile, string> = {
  realtime: "Realtime",
  "5min": "5 min",
  "1hour": "1 hour",
  daily: "Daily",
  manual: "Manual",
};

const profileMs: Partial<Record<FreshnessProfile, number>> = {
  realtime: 60_000,
  "5min": 5 * 60_000,
  "1hour": 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

const isStale = (profile: FreshnessProfile, lastSyncAt?: string | null) => {
  if (!lastSyncAt || profile === "manual") return false;
  const threshold = profileMs[profile];
  const time = new Date(lastSyncAt).getTime();
  return Boolean(threshold && Number.isFinite(time) && Date.now() - time > threshold);
};

export function FreshnessIndicator({ profile, lastSyncAt, className }: FreshnessIndicatorProps) {
  const stale = isStale(profile, lastSyncAt);
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-ds-pill px-2 text-[11px] font-bold ring-1",
        stale ? "bg-state-reminder/12 text-state-reminder ring-state-reminder/20" : "bg-state-muted/10 text-state-muted ring-state-muted/16",
        className,
      )}
      data-state={stale ? "stale" : "fresh"}
      title={lastSyncAt ? `Last sync ${lastSyncAt}` : "No sync timestamp"}
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      {profileLabel[profile]}
    </span>
  );
}
