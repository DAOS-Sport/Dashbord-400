import type { WorkbenchRole } from "../auth/me";

export type WorkbenchShellKind = "employee" | "lifeguard" | "supervisor" | "system" | "portal" | "public";

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
  { moduleId: "announcements", label: "群組公告", iconKey: "bell", role: "employee", primaryPath: "/employee/announcements", shell: "employee" },
  { moduleId: "handover", label: "交辦事項", iconKey: "message-square-text", role: "employee", primaryPath: "/employee/handover", shell: "employee" },
  { moduleId: "activity-periods", label: "活動檔期/課程快訊", iconKey: "calendar-days", role: "employee", primaryPath: "/employee/activity-periods", shell: "employee" },
  { moduleId: "employee-resources", label: "常用文件", iconKey: "file-text", role: "employee", primaryPath: "/employee/documents", shell: "employee" },
  { moduleId: "employee-training", label: "員工教材", iconKey: "graduation-cap", role: "employee", primaryPath: "/employee/training", shell: "employee" },
  { moduleId: "lifeguard-lost-and-found", label: "失物招領", iconKey: "package-search", role: "employee", primaryPath: "/employee/lost-and-found", shell: "employee" },
  { moduleId: "courts", label: "場地預約", iconKey: "calendar-days", role: "employee", primaryPath: "/employee/courts/xinbei", shell: "employee" },
  { moduleId: "knowledge-base-qna", label: "相關問題詢問", iconKey: "book-open", role: "employee", primaryPath: "/employee/qna", shell: "employee" },

  { moduleId: "lifeguard-home", label: "首頁", iconKey: "home", role: "lifeguard", primaryPath: "/lifeguard", shell: "lifeguard" },
  { moduleId: "lifeguard-water-quality", label: "水質檢測", iconKey: "droplets", role: "lifeguard", primaryPath: "/lifeguard/water-quality", shell: "lifeguard" },
  { moduleId: "lifeguard-coach-dive", label: "教練下水", iconKey: "camera", role: "lifeguard", primaryPath: "/lifeguard/coach-dive", shell: "lifeguard" },
  { moduleId: "lifeguard-cleanup", label: "下班打掃", iconKey: "clipboard-list", role: "lifeguard", primaryPath: "/lifeguard/cleanup", shell: "lifeguard" },
  { moduleId: "lifeguard-lane-issues", label: "水道事項", iconKey: "waves", role: "lifeguard", primaryPath: "/lifeguard/lane-issues", shell: "lifeguard" },
  { moduleId: "lifeguard-lost-and-found", label: "失物招領登記", iconKey: "package-search", role: "lifeguard", primaryPath: "/lifeguard/lost-and-found", shell: "lifeguard" },
  { moduleId: "lifeguard-lane-rentals", label: "水道租借狀態", iconKey: "calendar-days", role: "lifeguard", primaryPath: "/lifeguard/lane-rentals", shell: "lifeguard" },
  { moduleId: "handover", label: "交辦事項", iconKey: "message-square-text", role: "lifeguard", primaryPath: "/lifeguard/handover", shell: "lifeguard" },

  { moduleId: "supervisor-dashboard", label: "營運總覽", iconKey: "home", role: "supervisor", primaryPath: "/supervisor", legacyPath: "/", shell: "supervisor" },
  { moduleId: "facilities", label: "場館", iconKey: "building", role: "supervisor", primaryPath: "/supervisor/facilities", shell: "supervisor" },
  { moduleId: "parking", label: "停車場管理", iconKey: "car", role: "supervisor", primaryPath: "/supervisor/parking", legacyPath: "/admin/parking/dashboard", shell: "supervisor" },
  { moduleId: "lane-rentals", label: "水道租借", iconKey: "waves", role: "supervisor", primaryPath: "/supervisor/lane-rentals", legacyPath: "/admin/lane-rentals", shell: "supervisor" },
  { moduleId: "courts", label: "場地預約", iconKey: "calendar-days", role: "supervisor", primaryPath: "/supervisor/courts/xinbei", legacyPath: "/courts/xinbei", shell: "supervisor" },
  { moduleId: "announcements", label: "公告管理", iconKey: "megaphone", role: "supervisor", primaryPath: "/supervisor/announcements", legacyPath: "/announcements", shell: "supervisor" },
  { moduleId: "announcement-groups", label: "公告群組綁定", iconKey: "message-square-warning", role: "supervisor", primaryPath: "/supervisor/announcement-groups", legacyPath: "/admin/announcement-groups", shell: "supervisor" },
  { moduleId: "handover", label: "交接事項", iconKey: "message-square-text", role: "supervisor", primaryPath: "/supervisor/handover", shell: "supervisor" },
  { moduleId: "employee-training", label: "員工教材", iconKey: "graduation-cap", role: "supervisor", primaryPath: "/supervisor/training", shell: "supervisor" },

  { moduleId: "system-watchdog", label: "Watchdog", iconKey: "shield-check", role: "system", primaryPath: "/system/watchdog", shell: "system" },
  { moduleId: "system-cms-monitoring", label: "CMS 內部監控", iconKey: "server", role: "system", primaryPath: "/system/cms-monitoring", shell: "system" },
  { moduleId: "system-insights", label: "行為洞察", iconKey: "gauge", role: "system", primaryPath: "/system/insights", shell: "system" },
  { moduleId: "system-operations", label: "遠維協助", iconKey: "link", role: "system", primaryPath: "/system/operations", shell: "system" },
  { moduleId: "system-monitoring-400line", label: "400LINE", iconKey: "server", role: "system", primaryPath: "/system/monitoring/400line", shell: "system" },
  { moduleId: "system-monitoring-schedule", label: "排班管理系統", iconKey: "server", role: "system", primaryPath: "/system/monitoring/schedule", shell: "system" },
  { moduleId: "system-monitoring-collab-course", label: "偕同課系統", iconKey: "server", role: "system", primaryPath: "/system/monitoring/collab-course", shell: "system" },
] as const satisfies readonly WorkbenchRouteDescriptor[];

export const getWorkbenchRoutes = (role: WorkbenchRole): WorkbenchRouteDescriptor[] =>
  workbenchRoutes.filter((route) => route.role === role);

export const getPrimaryRoute = (moduleId: string, role: WorkbenchRole): string | undefined =>
  workbenchRoutes.find((route) => route.moduleId === moduleId && route.role === role)?.primaryPath;

export const getRedirectForLegacyPath = (pathname: string): string | undefined => {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === "/") return "/system/project-overview";
  if (normalized === "/system") return "/system/project-overview";
  if (normalized === "/system/overview") return "/system/project-overview";
  if (normalized === "/analytics") return "/system/insights";
  if (normalized === "/operations") return "/supervisor";
  if (normalized === "/anomaly-reports") return "/system/watchdog?tab=alerts";
  if (normalized === "/announcements" || normalized === "/announcements/summary") return "/supervisor/announcements";
  if (normalized === "/employee/tasks" || normalized === "/employee/personal-note") return "/employee/handover";
  if (normalized === "/supervisor/tasks") return "/supervisor/handover";
  if (normalized === "/lifeguard/tasks") return "/lifeguard/handover";
  if (normalized === "/system-health" || normalized === "/system/health") return "/system/watchdog";
  if (normalized === "/system/alerts") return "/system/watchdog?tab=alerts";
  if (normalized === "/system/integrations") return "/system/watchdog?tab=integrations";
  if (normalized === "/system/audit") return "/system/operations?tab=audit";
  if (normalized === "/system/400cms/status") return "/system/monitoring/400cms";
  if (normalized === "/system/linebot-management") return "/system/monitoring/400line";
  if (normalized === "/system/helper-status" || normalized === "/system/lineXBS-status") return "/system/monitoring/400line";
  if (normalized === "/system/line-whitelist") return "/system/monitoring/400line?tab=whitelist";
  if (normalized === "/system/schedule/status") return "/system/monitoring/schedule";
  if (normalized === "/system/collab-course/status") return "/system/monitoring/collab-course";
  if (normalized === "/system/governance" || normalized === "/system/function-relations" || normalized === "/system/training-views" || normalized === "/system/topology") return "/system/project-overview";
  if (normalized === "/admin/announcement-groups") return "/supervisor/announcement-groups";
  if (normalized === "/admin/parking") return "/supervisor/parking";
  if (normalized === "/admin/parking/dashboard") return "/supervisor/parking";
  if (normalized.startsWith("/admin/parking/")) return normalized.replace(/^\/admin\/parking/, "/supervisor/parking");
  if (normalized === "/admin/lane-rentals") return "/supervisor/lane-rentals";
  if (normalized === "/courts") return "/supervisor/courts/xinbei";
  if (normalized.startsWith("/courts/")) return normalized.replace(/^\/courts/, "/supervisor/courts");
  return undefined;
};
