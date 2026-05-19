import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  HandoverSummary,
  ShortcutSummary,
  TrainingSummary,
} from "@shared/domain/workbench";
import type { OperationalHandover } from "@shared/schema";
import {
  defaultEmployeeDocumentLinks,
  defaultEmployeeShortcuts,
  shortcutTones,
} from "./home-contract";
import {
  formatEventRange,
  isImageUrl,
  mapEmployeeAnnouncementResource,
  mapTrainingResource,
  toIsoStringOrNull,
} from "./resource-mappers";
import { mapOperationalHandoverSummary } from "./supervisor-dashboard-service";

type FallbackLegacyHandover = {
  id: number | string;
  content: string;
  authorName?: string | null;
  facilityKey: string;
};

type FallbackQuickLink = {
  id: number | string;
  title: string;
  url: string;
  createdAt: Date | null;
  description?: string | null;
};

export type FallbackEmployeeResource = {
  id: number;
  category: string;
  title: string;
  content: string | null;
  isPinned: boolean;
  url: string | null;
  imageUrl?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  subCategory: string | null;
  sortOrder?: number | null;
  eventCategory?: string | null;
  eventStartAt?: Date | string | null;
  eventEndAt?: Date | string | null;
  createdByName: string | null;
  scheduledAt?: Date | string | null;
  tags?: string[] | null;
};

const formatDate = (value?: Date | string | null, fallback = "員工新增") =>
  value ? new Date(value).toLocaleDateString("zh-TW") : fallback;

export const mapFallbackResourceAnnouncements = (
  resources: FallbackEmployeeResource[],
): AnnouncementSummary[] =>
  resources
    .filter((item) => item.category === "announcement")
    .map(mapEmployeeAnnouncementResource);

export const mapFallbackTraining = (
  resources: FallbackEmployeeResource[],
): TrainingSummary[] =>
  resources
    .filter((item) => item.category === "training")
    .map(mapTrainingResource);

export const mapFallbackHandovers = (
  operationalHandovers: OperationalHandover[],
  handovers: FallbackLegacyHandover[],
): HandoverSummary[] => [
  ...operationalHandovers.map(mapOperationalHandoverSummary),
  ...handovers.map((item) => ({
    id: `entry-${item.id}`,
    title: item.content,
    content: item.content,
    authorName: item.authorName || "值班人員",
    status: "unread" as const,
    facilityKey: item.facilityKey,
  })),
];

export const mapFallbackShortcuts = (
  quickLinks: FallbackQuickLink[],
): ShortcutSummary[] => [
  ...defaultEmployeeShortcuts,
  ...quickLinks.slice(0, 6).map((item, index) => ({
    id: `quick-link-${item.id}`,
    label: item.title,
    href: item.url,
    tone: shortcutTones[index % shortcutTones.length],
  })),
];

export const mapFallbackDocuments = (
  resources: FallbackEmployeeResource[],
  quickLinks: FallbackQuickLink[],
): DocumentSummary[] =>
  [
    ...defaultEmployeeDocumentLinks,
    ...resources
      .filter((item) => item.category === "document")
      .map((item) => ({
        id: `employee-doc-${item.id}`,
        resourceId: item.id,
        title: item.title,
        updatedAt: formatDate(item.createdAt),
        url: item.url ?? undefined,
        description: item.content ?? undefined,
        subCategory: item.subCategory ?? undefined,
        sortOrder: item.sortOrder ?? undefined,
        source: "employee_resource" as const,
      })),
    ...quickLinks.slice(0, 8).map((item) => ({
      id: `doc-${item.id}`,
      title: item.title,
      updatedAt: formatDate(item.createdAt, "Portal"),
      url: item.url,
      description: item.description ?? undefined,
      subCategory: "快速連結",
      sortOrder: 100,
      source: "quick_link" as const,
    })),
  ].slice(0, 10);

export const mapFallbackCampaigns = (
  resources: FallbackEmployeeResource[],
  candidateAnnouncements: AnnouncementSummary[],
): CampaignSummary[] =>
  [
    ...resources
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
      })),
    ...candidateAnnouncements
      .filter((item) =>
        /活動|課程|營隊|報名|檔期/.test(`${item.title}${item.summary}`),
      )
      .slice(0, 6)
      .map((item) => ({
        id: `campaign-${item.id}`,
        title: item.title,
        statusLabel: item.priority === "required" ? "需確認" : "公告",
        effectiveRange: item.effectiveRange,
      })),
  ].slice(0, 10);
