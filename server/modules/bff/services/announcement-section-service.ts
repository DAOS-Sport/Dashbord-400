import type { AnnouncementFilterBreakdown, BffSection } from "@shared/bff/envelope";
import type { AnnouncementSummary } from "@shared/domain/workbench";
import { degraded, ok, unavailable } from "../../../shared/bff/section";

export const announcementSectionFromSources = (
  items: AnnouncementSummary[],
  lineSource: {
    connected: boolean;
    errorMessage: string | null;
    fetchedAt?: string;
  },
  now: string,
  filterBreakdown?: AnnouncementFilterBreakdown,
): BffSection<AnnouncementSummary[]> => {
  const extraMeta = filterBreakdown ? { filterBreakdown } : {};

  if (items.length > 0) {
    const base = lineSource.connected
      ? ok(items, lineSource.fetchedAt ?? now)
      : degraded(
          items,
          [lineSource.errorMessage ?? "LINE 公告群組暫時不可用"],
          lineSource.fetchedAt ?? now,
        );
    return { ...base, meta: { ...base.meta, ...extraMeta } };
  }
  if (!lineSource.connected) {
    const base = unavailable<AnnouncementSummary[]>(
      lineSource.errorMessage ?? "LINE 公告群組尚未接線",
      "ANNOUNCEMENT_GROUPS_UNAVAILABLE",
    );
    return { ...base, meta: { ...base.meta, ...extraMeta } };
  }
  const base = ok([] as AnnouncementSummary[], lineSource.fetchedAt ?? now);
  return { ...base, meta: { ...base.meta, ...extraMeta } };
};
