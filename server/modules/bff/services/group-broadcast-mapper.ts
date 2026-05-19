import type { GroupBroadcast } from "@shared/schema";
import type { AnnouncementSummary } from "@shared/domain/workbench";

const FACILITY_LABELS: Record<string, string> = {
  xinbei_pool: "新北高中",
  salu_counter: "三重商工",
  sanmin_pool: "三民高中",
  songshan_pool: "松山",
  zhuke_pool: "竹科",
};

export function mapGroupBroadcastToAnnouncementSummary(
  row: GroupBroadcast,
): AnnouncementSummary {
  const facilityLabel = FACILITY_LABELS[row.sourceFacilityKey] ?? row.sourceFacilityKey;
  const isFanOut = row.targetFacilityKeys.length > 1;
  const sourceLabel = isFanOut
    ? `群組公告（來自 ${facilityLabel} 三蘆區廣播）`
    : `群組公告（${facilityLabel}）`;

  const bffPriority =
    row.priority === "urgent" ? "required" :
    row.priority === "high" ? "high" :
    "normal";

  // Use Gemini-extracted title if available, fallback to first 60 chars of original text
  const displayTitle = row.title ?? row.originalText.slice(0, 60);

  return {
    id: `group-broadcast-${row.id}`,
    title: displayTitle,
    summary: row.summary ?? row.originalText.slice(0, 100),
    content: row.originalText,
    sourceLabel,
    priority: bffPriority,
    type: "notice",
    isAcknowledged: false,
    isPinned: false,
    publishedAt: row.createdAt.toISOString?.() ?? String(row.createdAt),
    scheduledAt: undefined,
    deadlineLabel: undefined,
    effectiveRange: "",
    acknowledgedAt: undefined,
  };
}
