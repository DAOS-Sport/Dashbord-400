import { apiGet } from "@/shared/api/client";
import type { PortalEventStats } from "@/types/portal";

export interface UiEventOverview {
  totalEvents: number;
  totalClientErrors: number;
}

export interface AuditLogItem {
  id?: number;
  timestamp: string;
  actorId?: string;
  role?: string;
  facilityKey?: string;
  action: string;
  resource: string;
  resourceId?: string;
  resultStatus?: string;
}

export const fetchUiEventOverview = () =>
  apiGet<UiEventOverview>("/api/bff/system/ui-event-overview");

export const fetchAuditPortalAnalytics = () =>
  apiGet<PortalEventStats>("/api/portal/analytics?sinceDays=30");

export const fetchAuditLogs = () =>
  apiGet<{ items: AuditLogItem[] }>("/api/audit/logs?limit=25");
