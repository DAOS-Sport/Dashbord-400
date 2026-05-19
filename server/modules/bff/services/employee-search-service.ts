import type { EmployeeHomeDto } from "@shared/domain/workbench";

export type SearchItem = {
  id: string;
  type:
    | "announcement"
    | "handover"
    | "shift"
    | "shortcut"
    | "document"
    | "campaign"
    | "training"
    | "qna";
  title: string;
  summary: string;
  href: string;
};

export const includesQuery = (value: string | undefined, query: string) =>
  String(value || "")
    .toLowerCase()
    .includes(query.toLowerCase());

export const buildEmployeeSearchItems = (
  home: EmployeeHomeDto,
  query: string,
): SearchItem[] => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const candidates: SearchItem[] = [
    ...(home.announcements.data ?? []).map((item) => ({
      id: `announcement-${item.id}`,
      type: "announcement" as const,
      title: item.title,
      summary: item.summary || item.content || item.effectiveRange || "",
      href: "/employee/announcements",
    })),
    ...(home.handover.data ?? []).map((item) => ({
      id: `handover-${item.id}`,
      type: "handover" as const,
      title: item.title,
      summary: item.content || item.dueLabel || item.authorName || "",
      href: "/employee/handover",
    })),
    ...(home.shifts.data ?? []).map((item) => ({
      id: `shift-${item.id}`,
      type: "shift" as const,
      title: item.employeeName || item.label,
      summary: `${item.venueName || home.facility.name} ${item.timeRange || ""}`,
      href: "/employee/shift",
    })),
    ...(home.shortcuts.data ?? []).map((item) => ({
      id: `shortcut-${item.id}`,
      type: "shortcut" as const,
      title: item.label,
      summary: item.href,
      href: item.href,
    })),
    ...(home.campaigns.data ?? []).map((item) => ({
      id: `campaign-${item.id}`,
      type: "campaign" as const,
      title: item.title,
      summary: item.effectiveRange || item.statusLabel,
      href: "/employee/announcements",
    })),
    ...(home.documents.data ?? []).map((item) => ({
      id: `document-${item.id}`,
      type: "document" as const,
      title: item.title,
      summary: item.description || item.updatedAt,
      href: item.url || "/employee/documents",
    })),
    ...(home.training.data ?? []).map((item) => ({
      id: `training-${item.id}`,
      type: "training" as const,
      title: item.title,
      summary: item.content || item.subCategory || item.mediaType,
      href: "/employee/training",
    })),
  ];

  return candidates
    .filter((item) =>
      includesQuery(
        `${item.title} ${item.summary} ${item.type}`,
        normalizedQuery,
      ),
    )
    .slice(0, 12);
};
