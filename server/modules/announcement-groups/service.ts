import type { AnnouncementSummary } from "@shared/domain/workbench";
import { facilityLabel } from "@shared/domain/facilities";
import { storage } from "../../storage";
import { env } from "../../shared/config/env";
import { fetchLineMessages } from "./client";
import { lineMessageToAnnouncement } from "./transforms";

export interface AnnouncementGroupsReadResult {
  facility: { key: string; name: string };
  groups: Array<{ id: number; label: string; lineGroupId: string }>;
  announcements: AnnouncementSummary[];
  fetchedAt: string;
  sourceStatus: {
    connected: boolean;
    errorMessage: string | null;
  };
}

const announcementSortTime = (item: AnnouncementSummary) => {
  const parsed = Date.parse(item.publishedAt ?? item.createdAt ?? item.effectiveRange ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function readFacilityLineAnnouncements(params: {
  facilityKey: string;
  hours?: number;
  limit?: number;
}): Promise<AnnouncementGroupsReadResult> {
  const fetchedAt = new Date().toISOString();
  const limit = Math.min(Math.max(Number(params.limit ?? 30), 1), 100);
  const groups = await storage.listAnnouncementGroups({ facilityKey: params.facilityKey, isActive: true });
  const publicGroups = groups.map((group) => ({
    id: group.id,
    label: group.label,
    lineGroupId: group.lineGroupId,
  }));

  if (!groups.length) {
    return {
      facility: { key: params.facilityKey, name: facilityLabel(params.facilityKey) },
      groups: publicGroups,
      announcements: [],
      fetchedAt,
      sourceStatus: {
        connected: false,
        errorMessage: "尚未綁定 LINE 公告群組，請主管至 /supervisor/announcement-groups 設定",
      },
    };
  }

  if (!env.lineBotAdminToken) {
    return {
      facility: { key: params.facilityKey, name: facilityLabel(params.facilityKey) },
      groups: publicGroups,
      announcements: [],
      fetchedAt,
      sourceStatus: {
        connected: false,
        errorMessage: "LINE_BOT_ADMIN_TOKEN 未設定",
      },
    };
  }

  const results = await Promise.allSettled(groups.map(async (group) => {
    const response = await fetchLineMessages({
      groupId: group.lineGroupId,
      hours: params.hours ?? group.lookbackHours,
      type: "text",
      limit,
    });
    return response.messages
      .filter((message) => message.type === "text" && message.text)
      .map((message) => lineMessageToAnnouncement(message, group.label));
  }));

  const announcements = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item, index, items) => items.findIndex((candidate) => candidate.externalReferenceId === item.externalReferenceId) === index)
    .sort((a, b) => announcementSortTime(b) - announcementSortTime(a))
    .slice(0, limit);
  const failedCount = results.filter((result) => result.status === "rejected").length;

  return {
    facility: { key: params.facilityKey, name: facilityLabel(params.facilityKey) },
    groups: publicGroups,
    announcements,
    fetchedAt,
    sourceStatus: {
      connected: failedCount < results.length,
      errorMessage: failedCount
        ? failedCount === results.length
          ? `所有群組拉取失敗 (${failedCount})`
          : `部分群組拉取失敗 (${failedCount})`
        : null,
    },
  };
}
