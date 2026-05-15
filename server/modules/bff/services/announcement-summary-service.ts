import type { AnnouncementSummary } from "@shared/domain/workbench";
import type { SystemAnnouncement } from "@shared/schema";

export const mapSystemAnnouncementSummary = (
  item: SystemAnnouncement,
  now: string,
): AnnouncementSummary => ({
  id: `portal-ann-${item.id}`,
  externalReferenceId: `${item.source}:${item.id}`,
  title: item.title,
  summary: item.content,
  content: item.content,
  priority:
    item.severity === "critical"
      ? "required"
      : item.severity === "warning"
        ? "high"
        : "normal",
  type:
    item.announcementType === "sop"
      ? "sop"
      : item.announcementType === "event" ||
          item.announcementType === "discount" ||
          item.announcementType === "course"
        ? "event"
        : item.announcementType === "required"
          ? "required"
          : "notice",
  isPinned: Boolean(item.isPinned) || item.severity === "critical",
  effectiveRange: item.publishedAt
    ? new Date(item.publishedAt).toLocaleString("zh-TW")
    : "即時",
  publishedAt: item.publishedAt ? item.publishedAt.toISOString() : now,
  createdAt: item.createdAt ? item.createdAt.toISOString() : now,
  deadlineLabel: item.expiresAt
    ? new Date(item.expiresAt).toLocaleDateString("zh-TW")
    : "未設定",
});

export const uniqueAnnouncements = (items: AnnouncementSummary[]) => {
  const byKey = new Map<string, AnnouncementSummary>();
  for (const item of items) {
    const key = item.externalReferenceId || item.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    const currentRank =
      Number(Boolean(item.isPinned)) * 100 + announcementSortTime(item);
    const existingRank =
      Number(Boolean(existing.isPinned)) * 100 + announcementSortTime(existing);
    if (currentRank >= existingRank) byKey.set(key, item);
  }
  return Array.from(byKey.values());
};

export const announcementSortTime = (item: AnnouncementSummary) => {
  const parsed = Date.parse(
    item.publishedAt ??
      item.createdAt ??
      item.scheduledAt ??
      item.effectiveRange ??
      "",
  );
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Merge announcement overlay state (hide / pin-with-expiry / note) into items.
 * Hidden items are removed. Pinned items (pinnedUntil > now) bubble to the top.
 * Manual isPinned flag remains as a fallback secondary sort.
 */
