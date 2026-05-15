import type {
  DocumentSummary,
  ShortcutSummary,
} from "@shared/domain/workbench";
import { getModuleDescriptorsByRole } from "@shared/modules";

export const shortcutTones: ShortcutSummary["tone"][] = [
  "blue",
  "green",
  "amber",
  "violet",
  "rose",
  "cyan",
];
export const defaultEmployeeShortcuts: ShortcutSummary[] = [
  {
    id: "handover",
    label: "交辦事項",
    href: "/employee/handover",
    tone: "green",
  },
  {
    id: "announcements",
    label: "群組公告",
    href: "/employee/announcements",
    tone: "violet",
  },
  {
    id: "events",
    label: "活動檔期",
    href: "/employee/activity-periods",
    tone: "amber",
  },
  {
    id: "documents",
    label: "常用文件",
    href: "/employee/documents",
    tone: "cyan",
  },
  {
    id: "sticky-notes",
    label: "個人工作貼",
    href: "/employee/personal-note",
    tone: "rose",
  },
];

export const defaultEmployeeDocumentLinks: DocumentSummary[] = [
  {
    id: "system-checkins-link",
    title: "點名 / 報到",
    updatedAt: "系統入口",
    url: "/employee/checkins",
    description: "員工點名與報到入口",
    subCategory: "點名/報到",
    sortOrder: 0,
    source: "system_link",
  },
];

export const employeeModuleDescriptorMap = new Map(
  getModuleDescriptorsByRole("employee").map((descriptor) => [
    descriptor.id,
    descriptor,
  ]),
);
