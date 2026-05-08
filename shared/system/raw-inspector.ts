export const rawInspectorTargets = [
  { path: "/api/bff/system/overview", label: "系統總覽 BFF" },
  { path: "/api/bff/system/integration-overview", label: "整合監控 BFF" },
  { path: "/api/bff/supervisor/dashboard", label: "主管 Dashboard BFF" },
  { path: "/api/bff/employee/home", label: "員工首頁 BFF" },
  { path: "/api/bff/system/schedule-snapshot?facilityKey=xinbei_pool", label: "班表 Export Snapshot" },
  { path: "/api/portal/operational-handovers?facilityKey=xinbei_pool", label: "交班交接 Portal" },
  { path: "/api/announcement-dashboard/summary", label: "LINE 公告摘要代理" },
  { path: "/api/admin/overview", label: "Smart Schedule 代理" },
] as const;

export type RawInspectorPath = (typeof rawInspectorTargets)[number]["path"];

export const isRawInspectorPath = (value: string): value is RawInspectorPath =>
  rawInspectorTargets.some((target) => target.path === value);

export const getRawInspectorTarget = (value: string) =>
  rawInspectorTargets.find((target) => target.path === value);
