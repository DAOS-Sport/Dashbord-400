import { apiGet } from "@/shared/api/client";
import type { SupervisorDashboardDto } from "@shared/domain/workbench";
import type { PortalEventStats } from "@/types/portal";

export const fetchSupervisorReportDashboard = () =>
  apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");

export const fetchSupervisorReportAnalytics = (facilityKey: string) =>
  apiGet<PortalEventStats>(`/api/portal/analytics?facilityKey=${encodeURIComponent(facilityKey)}&sinceDays=30`);
