import type { AnnouncementSummary } from "@shared/domain/workbench";
import type { LineMessageDto } from "./client";

export function lineMessageToAnnouncement(
  msg: LineMessageDto,
  groupLabel: string,
): AnnouncementSummary {
  const text = msg.text ?? "";
  const title = text.split("\n")[0]?.trim().slice(0, 60) || "(無內容)";
  const atAll = /@all/i.test(text);
  const hasImportantKeyword = /【重要】|【公告】|必讀|緊急|注意/.test(text);
  const substantialLength = text.trim().replace(/@\S+\s*/g, "").trim().length >= 25;
  const isImportant =
    (atAll && hasImportantKeyword && substantialLength) ||
    /【重要】|【公告】/.test(text);
  const publishedAt = msg.timestamp || msg.createdAt || new Date().toISOString();

  return {
    id: `line-${msg.id || msg.messageId}`,
    externalReferenceId: msg.messageId || msg.id,
    title,
    summary: text,
    content: text,
    priority: isImportant ? "required" : "normal",
    type: isImportant ? "required" : "notice",
    isPinned: isImportant,
    effectiveRange: publishedAt ? new Date(publishedAt).toLocaleString("zh-TW") : "即時",
    publishedAt,
    createdAt: msg.createdAt || publishedAt,
    publisher: msg.displayName,
    sourceLabel: groupLabel,
    sourceType: "line-group",
    sourceRefId: msg.groupId,
    isAcknowledged: false,
  };
}
