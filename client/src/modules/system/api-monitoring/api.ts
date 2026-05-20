import { apiGet, apiPatch } from "@/shared/api/client";
import type {
  ApiMonitoringDetailDto,
  ApiMonitoringDto,
  ApiMonitoringProjectKey,
} from "@shared/system/api-monitoring-contract";

export const fetchApiMonitoring = (projectKey: ApiMonitoringProjectKey) =>
  apiGet<ApiMonitoringDto>(`/api/bff/system/api-monitoring?projectKey=${encodeURIComponent(projectKey)}`);

export const fetchApiMonitoringDetail = (
  projectKey: ApiMonitoringProjectKey,
  rowId: string,
  query?: { route?: string; label?: string; method?: string; status?: string; checkedAt?: string | null; durationMs?: number | null; statusCode?: number | null },
) => {
  const params = new URLSearchParams({ projectKey });
  if (query?.route) params.set("route", query.route);
  if (query?.label) params.set("label", query.label);
  if (query?.method) params.set("method", query.method);
  if (query?.status) params.set("status", query.status);
  if (query?.checkedAt) params.set("checkedAt", query.checkedAt);
  if (query?.durationMs !== undefined && query.durationMs !== null) params.set("durationMs", String(query.durationMs));
  if (query?.statusCode !== undefined && query.statusCode !== null) params.set("statusCode", String(query.statusCode));
  return apiGet<ApiMonitoringDetailDto>(
    `/api/bff/system/api-monitoring/${encodeURIComponent(rowId)}/detail?${params.toString()}`,
  );
};

export const updateApiMonitoringErrorGroupStatus = (
  fingerprint: string,
  input: { status: "resolved" | "open"; note?: string },
) =>
  apiPatch<{ resolution: unknown }>(
    `/api/bff/system/api-monitoring/error-groups/${encodeURIComponent(fingerprint)}/status`,
    input,
  );
