import type { BffSection } from "@shared/bff/envelope";
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
): BffSection<AnnouncementSummary[]> => {
  if (items.length > 0) {
    return lineSource.connected
      ? ok(items, lineSource.fetchedAt ?? now)
      : degraded(
          items,
          [lineSource.errorMessage ?? "LINE 公告群組暫時不可用"],
          lineSource.fetchedAt ?? now,
        );
  }
  if (!lineSource.connected) {
    return unavailable(
      lineSource.errorMessage ?? "LINE 公告群組尚未接線",
      "ANNOUNCEMENT_GROUPS_UNAVAILABLE",
    );
  }
  return ok([], lineSource.fetchedAt ?? now);
};
