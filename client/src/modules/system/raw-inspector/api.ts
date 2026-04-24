import { apiGet } from "@/shared/api/client";

export const rawInspectorTargets = [
  ["/api/bff/system/overview", "系統總覽 BFF"],
  ["/api/bff/system/integration-overview", "整合監控 BFF"],
  ["/api/bff/supervisor/dashboard", "主管 Dashboard BFF"],
  ["/api/portal/operational-handovers", "交班交接 Portal"],
  ["/api/announcement-dashboard/summary", "LINE 公告摘要代理"],
  ["/api/admin/overview", "Smart Schedule 代理"],
] as const;

export type RawInspectorPath = (typeof rawInspectorTargets)[number][0];

export const fetchRawInspectorTarget = (path: RawInspectorPath) =>
  apiGet<unknown>(path);
