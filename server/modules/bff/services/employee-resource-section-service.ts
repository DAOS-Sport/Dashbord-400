import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  StickyNoteSummary,
  TrainingSummary,
} from "@shared/domain/workbench";
import { storage } from "../../../storage";

import { defaultEmployeeDocumentLinks } from "./home-contract";
import {
  formatEventRange,
  isImageUrl,
  mapEmployeeAnnouncementResource,
  mapTrainingResource,
  toIsoStringOrNull,
} from "./resource-mappers";

export const getEmployeeResourceSections = async (facilityKey: string) => {
  const resources = await storage
    .listEmployeeResources({ facilityKey, limit: 100 })
    .catch(() => []);
  const announcements: AnnouncementSummary[] = resources
    .filter((item) => item.category === "announcement")
    .map(mapEmployeeAnnouncementResource);
  const campaigns: CampaignSummary[] = resources
    .filter((item) => item.category === "event")
    .map((item) => ({
      id: `employee-event-${item.id}`,
      resourceId: item.id,
      title: item.title,
      statusLabel: item.eventCategory || item.subCategory || "員工新增",
      effectiveRange: formatEventRange(item),
      linkUrl: item.url ?? undefined,
      imageUrl:
        item.imageUrl ??
        (isImageUrl(item.url) ? (item.url ?? undefined) : undefined),
      eventCategory: item.eventCategory ?? item.subCategory ?? undefined,
      startsAt: toIsoStringOrNull(item.eventStartAt),
      endsAt: toIsoStringOrNull(item.eventEndAt),
    }));
  const documents: DocumentSummary[] = resources
    .filter((item) => item.category === "document")
    .map((item) => ({
      id: `employee-doc-${item.id}`,
      resourceId: item.id,
      title: item.title,
      updatedAt: item.createdAt
        ? new Date(item.createdAt).toLocaleDateString("zh-TW")
        : "員工新增",
      url: item.url ?? undefined,
      description: item.content ?? undefined,
      subCategory: item.subCategory ?? undefined,
      sortOrder: item.sortOrder,
      source: "employee_resource" as const,
    }));
  const stickyNotes: StickyNoteSummary[] = resources
    .filter((item) => item.category === "sticky_note")
    .map((item) => ({
      id: `sticky-${item.id}`,
      resourceId: item.id,
      title: item.title,
      content: item.content || "",
      authorName: item.createdByName,
      createdAt: item.createdAt
        ? new Date(item.createdAt).toLocaleDateString("zh-TW")
        : "今日",
      scheduledAt: item.scheduledAt ? item.scheduledAt.toISOString() : null,
    }))
    .sort((a, b) => {
      const aScheduled = a.scheduledAt
        ? Date.parse(a.scheduledAt)
        : Number.POSITIVE_INFINITY;
      const bScheduled = b.scheduledAt
        ? Date.parse(b.scheduledAt)
        : Number.POSITIVE_INFINITY;
      if (aScheduled !== bScheduled) return aScheduled - bScheduled;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  const training: TrainingSummary[] = resources
    .filter((item) => item.category === "training")
    .map(mapTrainingResource);
  const mergedDocuments = [
    ...defaultEmployeeDocumentLinks,
    ...documents.filter((item) => item.url !== "/employee/checkins"),
  ].slice(0, 10);
  return {
    announcements,
    campaigns,
    documents: mergedDocuments,
    stickyNotes,
    training,
  };
};
