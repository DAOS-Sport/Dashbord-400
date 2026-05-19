import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquareText,
  Wrench,
} from "lucide-react";
import type { ShortcutSummary } from "@shared/domain/workbench";
import { getPrimaryRoute } from "@shared/navigation/workbench-routes";

const shortcutIcons = {
  blue: ClipboardCheck,
  green: FileText,
  amber: CheckCircle2,
  violet: CalendarDays,
  rose: Wrench,
  cyan: FileText,
};

const shortcutIconsById: Record<string, LucideIcon> = {
  clock: ClipboardCheck,
  handover: MessageSquareText,
  announcements: Bell,
  events: CalendarDays,
  documents: FileText,
  qna: BookOpen,
};

export const employeeShortcutToneClass: Record<ShortcutSummary["tone"], string> = {
  blue: "bg-white/55 text-[#1f6fd1]",
  green: "bg-white/55 text-[#15935d]",
  amber: "bg-white/55 text-[#d27a16]",
  violet: "bg-white/55 text-[#6947d8]",
  rose: "bg-white/55 text-[#db4b5a]",
  cyan: "bg-white/55 text-[#1487a8]",
};

export const employeeShortcutSurfaceClass: Record<ShortcutSummary["tone"], string> = {
  blue: "border-[#c8ddf8] bg-[#eef6ff] hover:border-[#95bee9] hover:bg-[#e4f1ff]",
  green: "border-[#bfe7d2] bg-[#eaf8f0] hover:border-[#8ed5ae] hover:bg-[#def3e9]",
  amber: "border-[#efd5a5] bg-[#fff2d7] hover:border-[#e0b660] hover:bg-[#ffe9c4]",
  violet: "border-[#d1c6fb] bg-[#efeaff] hover:border-[#aa98ef] hover:bg-[#e8e0ff]",
  rose: "border-[#efc6cc] bg-[#ffedf0] hover:border-[#e497a4] hover:bg-[#ffe1e6]",
  cyan: "border-[#bfe5ee] bg-[#e8f9fc] hover:border-[#8ccfdd] hover:bg-[#dcf4fa]",
};

export const employeeShortcutToneOptions: ShortcutSummary["tone"][] = ["blue", "green", "amber", "violet", "rose", "cyan"];
export const employeeShortcutPreferenceKey = "junsi.cms.employee.quick-actions.v4";
export const employeeShortcutLimit = 7;

export const employeeShortcutCandidates: ShortcutSummary[] = [
  { id: "handover", label: "交辦事項", href: getPrimaryRoute("handover", "employee") ?? "/employee/handover", tone: "green" },
  { id: "announcements", label: "群組公告", href: "/employee/announcements", tone: "violet" },
  { id: "events", label: "活動檔期", href: getPrimaryRoute("activity-periods", "employee") ?? "/employee/activity-periods", tone: "amber" },
  { id: "documents", label: "常用文件", href: getPrimaryRoute("employee-resources", "employee") ?? "/employee/documents", tone: "cyan" },
  { id: "qna", label: "相關問題詢問", href: getPrimaryRoute("knowledge-base-qna", "employee") ?? "/employee/qna", tone: "violet" },
];

export const getEmployeeShortcutIcon = (shortcut: ShortcutSummary) =>
  shortcutIconsById[shortcut.id] ?? shortcutIcons[shortcut.tone];

export const isEmployeeShortcutTone = (value: unknown): value is ShortcutSummary["tone"] =>
  typeof value === "string" && employeeShortcutToneOptions.includes(value as ShortcutSummary["tone"]);

export const normalizeEmployeeActionableShortcuts = (shortcuts: ShortcutSummary[]) =>
  shortcuts
    .filter((shortcut) => {
      const href = shortcut.href?.trim();
      if (!href || href.startsWith("#")) return false;
      if (shortcut.id === "more" || href === "/employee/more") return false;
      return true;
    })
    .slice(0, employeeShortcutLimit);

const normalizeShortcutHref = (href: string | undefined, fallback: string) => {
  const value = href?.trim();
  if (!value) return fallback;
  if (value.startsWith("/employee") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("#")) {
    return value;
  }
  return fallback;
};

export const readEmployeeShortcutPreference = (): ShortcutSummary[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(employeeShortcutPreferenceKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((item): item is ShortcutSummary =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.href === "string" &&
        isEmployeeShortcutTone(item.tone),
      )
      .slice(0, employeeShortcutLimit);
  } catch {
    return null;
  }
};

export const writeEmployeeShortcutPreference = (shortcuts: ShortcutSummary[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(employeeShortcutPreferenceKey, JSON.stringify(shortcuts.slice(0, employeeShortcutLimit)));
};

export const resetEmployeeShortcutPreference = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(employeeShortcutPreferenceKey);
};

export const mergeEmployeeShortcutPreference = (source: ShortcutSummary[], preference: ShortcutSummary[] | null): ShortcutSummary[] => {
  const sourceItems = source.slice(0, employeeShortcutLimit);
  const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
  const merged: ShortcutSummary[] = [];
  for (const saved of preference ?? []) {
    const base = sourceById.get(saved.id);
    if (!base) continue;
    merged.push({
      ...base,
      label: base.label,
      href: normalizeShortcutHref(saved.href, base.href),
      tone: isEmployeeShortcutTone(saved.tone) ? saved.tone : base.tone,
    });
  }
  for (const item of sourceItems) {
    if (!merged.some((saved) => saved.id === item.id)) {
      merged.push(item);
    }
  }
  return merged.slice(0, employeeShortcutLimit);
};
