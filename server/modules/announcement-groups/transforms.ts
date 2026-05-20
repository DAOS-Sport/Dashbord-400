import type { AnnouncementSummary } from "@shared/domain/workbench";
import type { LineMessageDto } from "./client";

export function lineMessageToAnnouncement(
  msg: LineMessageDto,
  groupLabel: string,
): AnnouncementSummary {
  const text = msg.text ?? "";
  const title = text.split("\n")[0]?.trim().slice(0, 60) || "(無內容)";

  // Explicit markers always trigger 必讀
  const hasExplicitMarker = /【重要】|【公告】|‼|❗❗/.test(text);
  // @All alone is NOT sufficient — require substantial length + real announcement keywords
  const hasAtAll = /@all/i.test(text);
  const hasAnnouncementKeywords = /注意|禁止|停課|取消|停辦|更改|暫停|請假|通知|公告|規定|辦法|規則|重要|必須|須知|截止|deadline|提醒/.test(text);
  const isSubstantialLength = text.replace(/@\w+/gi, "").trim().length >= 25;
  const isImportant = hasExplicitMarker || (hasAtAll && hasAnnouncementKeywords && isSubstantialLength);
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
