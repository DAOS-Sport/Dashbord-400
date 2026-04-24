import { apiGet, apiPost } from "@/shared/api/client";

export const rawInspectorTargets = [
  ["/api/bff/system/overview", "系統總覽 BFF"],
  ["/api/bff/system/integration-overview", "整合監控 BFF"],
  ["/api/bff/supervisor/dashboard", "主管 Dashboard BFF"],
  ["/api/bff/employee/home", "員工首頁 BFF"],
  ["/api/bff/system/schedule-snapshot?facilityKey=xinbei_pool", "班表 Export Snapshot"],
  ["/api/portal/operational-handovers?facilityKey=xinbei_pool", "交班交接 Portal"],
  ["/api/announcement-dashboard/summary", "LINE 公告摘要代理"],
  ["/api/admin/overview", "Smart Schedule 代理"],
] as const;

export type RawInspectorPath = (typeof rawInspectorTargets)[number][0];

export const fetchRawInspectorTarget = async (path: RawInspectorPath) => {
  await apiPost("/api/telemetry/ui-events", {
    eventType: "ACTION_SUBMIT",
    page: "/system/raw-inspector",
    componentId: path,
    actionType: "raw-inspector-query",
    payload: { path },
    occurredAt: new Date().toISOString(),
  }).catch(() => undefined);
  return apiGet<unknown>(path);
};
