export type WorkbenchLayoutRole = "employee" | "supervisor" | "system";
export type WorkbenchWidgetSize = "wide" | "card";

export interface WorkbenchWidgetLayoutItem {
  key: string;
  label: string;
  area: string;
  enabled: boolean;
  size: WorkbenchWidgetSize;
  sortOrder: number;
}

export const defaultEmployeeHomeWidgets: WorkbenchWidgetLayoutItem[] = [
  { key: "search", label: "搜尋列", area: "top", enabled: true, size: "wide", sortOrder: 10 },
  { key: "tasks", label: "任務", area: "primary", enabled: true, size: "card", sortOrder: 20 },
  { key: "handover", label: "交辦事項", area: "primary", enabled: true, size: "card", sortOrder: 30 },
  { key: "announcements", label: "群組重要公告", area: "primary", enabled: true, size: "card", sortOrder: 40 },
  { key: "shortcuts", label: "快速操作", area: "tools", enabled: true, size: "wide", sortOrder: 50 },
  { key: "shifts", label: "今日班表", area: "lower", enabled: true, size: "card", sortOrder: 60 },
  { key: "events", label: "活動檔期 / 課程快訊", area: "lower", enabled: true, size: "card", sortOrder: 70 },
  { key: "documents", label: "常用文件", area: "lower", enabled: true, size: "card", sortOrder: 80 },
  { key: "stickyNotes", label: "便利貼", area: "lower", enabled: true, size: "card", sortOrder: 90 },
];

export const normalizeWidgetLayout = (
  widgets: WorkbenchWidgetLayoutItem[] | null | undefined,
  fallback = defaultEmployeeHomeWidgets,
): WorkbenchWidgetLayoutItem[] => {
  const fallbackByKey = new Map(fallback.map((item) => [item.key, item]));
  const incoming = Array.isArray(widgets) ? widgets : [];
  const merged = [
    ...incoming
      .filter((item) => fallbackByKey.has(item.key))
      .map((item) => ({ ...fallbackByKey.get(item.key)!, ...item })),
    ...fallback.filter((item) => !incoming.some((candidate) => candidate.key === item.key)),
  ];
  return merged.sort((a, b) => a.sortOrder - b.sortOrder);
};
