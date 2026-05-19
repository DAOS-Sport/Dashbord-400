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
  now: string,
): AnnouncementSummary {
  const facilityLabel = FACILITY_LABELS[row.sourceFacilityKey] ?? row.sourceFacilityKey;
  const isFanOut = row.isFanOut;
  const sourceLabel = isFanOut
    ? `群組公告（來自 ${facilityLabel} fan-out）`
    : `群組公告（${facilityLabel}）`;

  return {
    id: `group-broadcast-${row.id}`,
    title: row.title,
    summary: row.geminiSummary ?? row.content.slice(0, 100),
    content: row.content,
    sourceLabel,
    priority: "normal",
    type: "notice",
    isAcknowledged: false,
    isPinned: false,
    publishedAt: row.createdAt.toISOString?.() ?? String(row.createdAt),
    scheduledAt: null,
    deadlineLabel: null,
    effectiveRange: null,
    acknowledgedAt: null,
  };
}
