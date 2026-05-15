import type {
  AnnouncementSummary,
  DocumentSummary,
  TrainingSummary,
} from "@shared/domain/workbench";

export const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown }).items)
  ) {
    return (value as { items: T[] }).items;
  }
  return [];
};

export const readText = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value : fallback;

export const isImageUrl = (value: unknown) =>
  typeof value === "string" &&
  /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value.trim());

export const toIsoStringOrNull = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const formatEventRange = (item: {
  content?: string | null;
  eventStartAt?: Date | string | null;
  eventEndAt?: Date | string | null;
}) => {
  const start = toIsoStringOrNull(item.eventStartAt);
  const end = toIsoStringOrNull(item.eventEndAt);
  if (start && end) {
    return `${new Date(start).toLocaleDateString("zh-TW")} - ${new Date(end).toLocaleDateString("zh-TW")}`;
  }
  if (start) return new Date(start).toLocaleString("zh-TW");
  return item.content || "未設定時間";
};

export const isVideoUrl = (value: unknown) =>
  typeof value === "string" &&
  /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(value.trim());

export const isVideoHostUrl = (value: unknown) =>
  typeof value === "string" &&
  /(youtube\.com|youtu\.be|vimeo\.com)/i.test(value.trim());

export const mapTrainingResource = (item: {
  id: number;
  title: string;
  content: string | null;
  url: string | null;
  subCategory: string | null;
  createdByName: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
}): TrainingSummary => {
  const mediaType: TrainingSummary["mediaType"] = isImageUrl(item.url)
    ? "image"
    : isVideoUrl(item.url) || isVideoHostUrl(item.url)
      ? "video"
      : item.url
        ? "link"
        : "note";
  return {
    id: `training-${item.id}`,
    resourceId: item.id,
    title: item.title,
    content: item.content ?? undefined,
    url: item.url ?? undefined,
    mediaType,
    subCategory: item.subCategory ?? undefined,
    createdByName: item.createdByName,
    updatedAt: item.updatedAt
      ? new Date(item.updatedAt).toLocaleDateString("zh-TW")
      : item.createdAt
        ? new Date(item.createdAt).toLocaleDateString("zh-TW")
        : "員工教材",
  };
};

export const uniqueDocuments = (items: DocumentSummary[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const isAnnouncementType = (
  value: unknown,
): value is NonNullable<AnnouncementSummary["type"]> =>
  value === "required" ||
  value === "sop" ||
  value === "notice" ||
  value === "event" ||
  value === "general";

export const parseAnnouncementResourceContent = (content: string | null) => {
  if (!content)
    return {
      body: "",
      type: "notice" as NonNullable<AnnouncementSummary["type"]>,
      scheduledAt: undefined as string | undefined,
    };
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const body = typeof parsed.body === "string" ? parsed.body : content;
    const type = isAnnouncementType(parsed.type) ? parsed.type : "notice";
    const scheduledAt =
      typeof parsed.scheduledAt === "string" && parsed.scheduledAt.trim()
        ? parsed.scheduledAt
        : undefined;
    return { body, type, scheduledAt };
  } catch {
    return {
      body: content,
      type: "notice" as NonNullable<AnnouncementSummary["type"]>,
      scheduledAt: undefined as string | undefined,
    };
  }
};

export const mapEmployeeAnnouncementResource = (item: {
  id: number;
  title: string;
  content: string | null;
  isPinned: boolean;
  createdAt: Date | null;
}): AnnouncementSummary => {
  const parsed = parseAnnouncementResourceContent(item.content);
  const publishedAt = item.createdAt
    ? item.createdAt.toISOString()
    : new Date().toISOString();
  return {
    id: `employee-ann-${item.id}`,
    externalReferenceId: `employee-resource:${item.id}`,
    resourceId: item.id,
    title: item.title,
    summary: parsed.body || "員工新增公告",
    content: parsed.body,
    priority: parsed.type === "required" ? "required" : "normal",
    type: parsed.type,
    isPinned: item.isPinned,
    effectiveRange: parsed.scheduledAt
      ? new Date(parsed.scheduledAt).toLocaleString("zh-TW")
      : new Date(publishedAt).toLocaleString("zh-TW"),
    publishedAt,
    createdAt: publishedAt,
    scheduledAt: parsed.scheduledAt,
  };
};
