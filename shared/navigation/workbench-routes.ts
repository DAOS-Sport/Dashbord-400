import type { WorkbenchRole } from "../auth/me";

export type WorkbenchShellKind = "employee" | "supervisor" | "system" | "portal" | "public";

export interface WorkbenchRouteDescriptor {
  moduleId: string;
  label: string;
  iconKey: string;
  role: WorkbenchRole;
  primaryPath: string;
  legacyPath?: string;
  shell: WorkbenchShellKind;
  status?: "active" | "redirect-placeholder";
}

export const workbenchRoutes = [
  { moduleId: "employee-home", label: "首頁", iconKey: "home", role: "employee", primaryPath: "/employee", shell: "employee" },
  { moduleId: "handover", label: "櫃台交接", iconKey: "message-square-text", role: "employee", primaryPath: "/employee/handover", shell: "employee" },
  { moduleId: "activity-periods", label: "活動檔期/課程快訊", iconKey: "calendar-days", role: "employee", primaryPath: "/employee/activity-periods", shell: "employee" },
  { moduleId: "employee-resources", label: "常用文件", iconKey: "file-text", role: "employee", primaryPath: "/employee/documents", shell: "employee" },
  { moduleId: "employee-training", label: "員工教材", iconKey: "graduation-cap", role: "employee", primaryPath: "/employee/training", shell: "employee" },
  { moduleId: "personal-note", label: "個人工作記事", iconKey: "file-text", role: "employee", primaryPath: "/employee/personal-note", shell: "employee" },
  { moduleId: "courts", label: "場地預約", iconKey: "calendar-days", role: "employee", primaryPath: "/employee/courts/xinbei", shell: "employee" },
  { moduleId: "knowledge-base-qna", label: "相關問題詢問", iconKey: "book-open", role: "employee", primaryPath: "/employee/qna", shell: "employee" },

  { moduleId: "supervisor-dashboard", label: "營運總覽", iconKey: "home", role: "supervisor", primaryPath: "/supervisor", legacyPath: "/", shell: "supervisor" },
  { moduleId: "facilities", label: "場館", iconKey: "building", role: "supervisor", primaryPath: "/supervisor/facilities", shell: "supervisor" },
  { moduleId: "parking", label: "停車場管理", iconKey: "car", role: "supervisor", primaryPath: "/supervisor/parking", legacyPath: "/admin/parking/dashboard", shell: "supervisor" },
  { moduleId: "counter-log", label: "櫃台日誌", iconKey: "clipboard-check", role: "supervisor", primaryPath: "/supervisor/counter-log/submissions", legacyPath: "/admin/counter-logs/submissions", shell: "supervisor" },
  { moduleId: "lane-rentals", label: "水道租借", iconKey: "waves", role: "supervisor", primaryPath: "/supervisor/lane-rentals", legacyPath: "/admin/lane-rentals", shell: "supervisor" },
  { moduleId: "courts", label: "場地預約", iconKey: "calendar-days", role: "supervisor", primaryPath: "/supervisor/courts/xinbei", legacyPath: "/courts/xinbei", shell: "supervisor" },
  { moduleId: "tasks", label: "任務管理", iconKey: "clipboard-check", role: "supervisor", primaryPath: "/supervisor/tasks", shell: "supervisor" },
  { moduleId: "announcements", label: "公告管理", iconKey: "megaphone", role: "supervisor", primaryPath: "/supervisor/announcements", legacyPath: "/announcements", shell: "supervisor" },
  { moduleId: "handover", label: "櫃台交接", iconKey: "message-square-text", role: "supervisor", primaryPath: "/supervisor/handover", shell: "supervisor" },
  { moduleId: "employee-training", label: "員工教材", iconKey: "graduation-cap", role: "supervisor", primaryPath: "/supervisor/training", shell: "supervisor" },
  { moduleId: "anomalies", label: "異常審核", iconKey: "shield-check", role: "supervisor", primaryPath: "/supervisor/anomalies", legacyPath: "/anomaly-reports", shell: "supervisor" },
  { moduleId: "analytics", label: "報表", iconKey: "gauge", role: "supervisor", primaryPath: "/supervisor/reports", legacyPath: "/analytics", shell: "supervisor" },

  { moduleId: "system-dashboard", label: "系統總覽", iconKey: "gauge", role: "system", primaryPath: "/system", shell: "system" },
  { moduleId: "system-health", label: "系統健康", iconKey: "gauge", role: "system", primaryPath: "/system/health", legacyPath: "/system-health", shell: "system" },
  { moduleId: "system-observability", label: "告警中心", iconKey: "bell", role: "system", primaryPath: "/system/alerts", shell: "system" },
  { moduleId: "integration-sync-jobs", label: "整合狀態", iconKey: "link", role: "system", primaryPath: "/system/integrations", shell: "system" },
  { moduleId: "telemetry-audit", label: "Audit / Telemetry", iconKey: "shield-check", role: "system", primaryPath: "/system/audit", shell: "system" },
  { moduleId: "raw-inspector", label: "Raw Inspector", iconKey: "shield-check", role: "system", primaryPath: "/system/raw-inspector", shell: "system" },
  { moduleId: "employee-training", label: "教材觀看紀錄", iconKey: "graduation-cap", role: "system", primaryPath: "/system/training-views", shell: "system" },
] as const satisfies readonly WorkbenchRouteDescriptor[];

export const getWorkbenchRoutes = (role: WorkbenchRole): WorkbenchRouteDescriptor[] =>
  workbenchRoutes.filter((route) => route.role === role);

export const getPrimaryRoute = (moduleId: string, role: WorkbenchRole): string | undefined =>
  workbenchRoutes.find((route) => route.moduleId === moduleId && route.role === role)?.primaryPath;

export const getRedirectForLegacyPath = (pathname: string): string | undefined => {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === "/") return "/system";
  if (normalized === "/analytics") return "/supervisor/reports";
  if (normalized === "/operations") return "/supervisor";
  if (normalized === "/anomaly-reports") return "/supervisor/anomalies";
  if (normalized === "/announcements" || normalized === "/announcements/summary") return "/supervisor/announcements";
  if (normalized === "/admin/parking") return "/supervisor/parking";
  if (normalized === "/admin/parking/dashboard") return "/supervisor/parking";
  if (normalized.startsWith("/admin/parking/")) return normalized.replace(/^\/admin\/parking/, "/supervisor/parking");
  if (normalized === "/admin/lane-rentals") return "/supervisor/lane-rentals";
  if (normalized === "/admin/counter-logs") return "/supervisor/counter-log/submissions";
  if (normalized.startsWith("/admin/counter-logs/")) return normalized.replace(/^\/admin\/counter-logs/, "/supervisor/counter-log");
  if (normalized === "/courts") return "/supervisor/courts/xinbei";
  if (normalized.startsWith("/courts/")) return normalized.replace(/^\/courts/, "/supervisor/courts");
  return undefined;
};
