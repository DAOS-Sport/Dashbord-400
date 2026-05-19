import type { LinebotApiReadiness, LinebotManagementStatus } from "./linebot-management-contract";

export type SystemProjectGroup = "governance" | "400cms" | "400line" | "schedule" | "collab-course";

export type SystemProjectStatus = "ready" | "degraded" | "not_connected" | "error";

export type SystemProjectMetrics = {
  ready: number;
  degraded: number;
  notConnected: number;
  error: number;
};

export type SystemProjectSummary = {
  key: SystemProjectGroup;
  label: string;
  description: string;
  status: SystemProjectStatus;
  controlCenterHref: string;
  monitorHref: string;
  governanceHref?: string;
  metrics: SystemProjectMetrics;
  lastUpdatedAt: string;
};

export type SystemProjectService = {
  id: string;
  label: string;
  status: SystemProjectStatus;
  message: string;
  source: string;
  lastCheckedAt?: string | null;
};

export type SystemProjectMonitoringDto = {
  generatedAt: string;
  items: SystemProjectSummary[];
};

export type SystemProjectDetailDto = SystemProjectSummary & {
  services: SystemProjectService[];
  notes: string[];
};

export type LineXbsStatusEvent = {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  occurredAt: string;
};

export type LineXbsStatusItem = {
  id: string;
  label: string;
  status: LinebotManagementStatus;
  rawStatus?: string;
  message: string;
  sourcePath: string;
  lastSyncAt?: string | null;
};

export type LineXbsStatusGroupDto = {
  key: string;
  label: string;
  status: LinebotManagementStatus;
  items: LineXbsStatusItem[];
  events: LineXbsStatusEvent[];
  apiReadiness: LinebotApiReadiness[];
};

export type LineXbsStatusDto = {
  generatedAt: string;
  status: LinebotManagementStatus;
  sourceMode: "contract" | "legacy_fallback";
  groups: LineXbsStatusGroupDto[];
  apiReadiness: LinebotApiReadiness[];
};
