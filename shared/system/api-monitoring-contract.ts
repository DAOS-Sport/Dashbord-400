import type { SystemProjectGroup } from "./project-monitoring-contract";

export type ApiMonitoringProjectKey = "all" | Exclude<SystemProjectGroup, "governance">;

export type ApiMonitoringStatus = "healthy" | "warning" | "error" | "not_connected";

export type ApiMonitoringType =
  | "health"
  | "bff"
  | "auth"
  | "system"
  | "employee"
  | "lifeguard"
  | "supervisor"
  | "external-proxy"
  | "legacy";

export type ApiMonitoringTrendBucket = {
  hour: string;
  total: number;
  errors: number;
  avgDurationMs: number | null;
};

export type ApiMonitoringErrorResolutionStatus = "open" | "resolved";

export type ApiMonitoringErrorResolution = {
  status: ApiMonitoringErrorResolutionStatus;
  note?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  updatedAt?: string;
};

export type ApiMonitoringErrorGroup = {
  fingerprint: string;
  projectKey: Exclude<SystemProjectGroup, "governance">;
  route: string;
  statusCode: number;
  errorType: "4xx" | "5xx" | "timeout" | "aborted";
  hour: string;
  count: number;
  avgDurationMs: number | null;
  firstOccurredAt: string;
  lastOccurredAt: string;
  correlationIds: string[];
  resolution: ApiMonitoringErrorResolution;
};

export type ApiMonitoringRequestRecord = {
  id: string;
  route: string;
  statusCode: number;
  durationMs: number;
  occurredAt: string;
  role?: string;
  facilityKey?: string;
  correlationId?: string;
  errorType?: "4xx" | "5xx" | "timeout" | "aborted";
};

export type ApiMonitoringRow = {
  id: string;
  projectKey: Exclude<SystemProjectGroup, "governance">;
  type: ApiMonitoringType;
  label: string;
  method: string;
  path: string;
  source: string;
  status: ApiMonitoringStatus;
  statusCode?: number | null;
  totalCount: number;
  errorCount: number;
  warningCount: number;
  unresolvedErrorCount: number;
  resolvedErrorCount: number;
  avgDurationMs: number | null;
  lastCheckedAt?: string | null;
  trend: ApiMonitoringTrendBucket[];
};

export type ApiMonitoringSummary = {
  projectKey: ApiMonitoringProjectKey;
  totalApis: number;
  healthyApis: number;
  warningApis: number;
  errorApis: number;
  notConnectedApis: number;
  lastUpdatedAt: string;
};

export type ApiMonitoringError = {
  id: string;
  route: string;
  statusCode: number;
  durationMs: number;
  occurredAt: string;
  errorType: "4xx" | "5xx" | "timeout" | "aborted";
  correlationId?: string;
};

export type ApiMonitoringAuditEvent = {
  id: string;
  actorId?: string;
  role?: string;
  action: string;
  resource: string;
  resourceId?: string;
  resultStatus?: string;
  occurredAt: string;
};

export type ApiMonitoringExternalService = {
  id: string;
  label: string;
  status: ApiMonitoringStatus;
  message: string;
  source: string;
  lastCheckedAt?: string | null;
};

export type ApiMonitoringScheduleCategory = "overview" | "schedules" | "export" | "trigger";

export type ScheduleEndpointProbe = {
  id: string;
  category: ApiMonitoringScheduleCategory;
  label: string;
  method: string;
  path: string;
  status: ApiMonitoringStatus;
  statusCode: number | null;
  durationMs: number | null;
  checkedAt: string | null;
  message: string;
  isMutating: boolean;
};

export type ScheduleMonitoringBlock = {
  baseUrl: string | null;
  tokenConfigured: boolean;
  summary: {
    healthy: number;
    warning: number;
    error: number;
    notConnected: number;
  };
  categories: Array<{
    key: ApiMonitoringScheduleCategory;
    label: string;
    endpoints: ScheduleEndpointProbe[];
  }>;
};

export type ApiMonitoringDto = {
  generatedAt: string;
  projectKey: ApiMonitoringProjectKey;
  summary: ApiMonitoringSummary;
  projectSummaries: ApiMonitoringSummary[];
  rows: ApiMonitoringRow[];
  healthChecks: ApiMonitoringRow[];
  recentErrors: ApiMonitoringError[];
  auditEvents: ApiMonitoringAuditEvent[];
  externalServices: ApiMonitoringExternalService[];
  scheduleBlock?: ScheduleMonitoringBlock;
};

export type ApiMonitoringDetailDto = {
  generatedAt: string;
  projectKey: ApiMonitoringProjectKey;
  row: ApiMonitoringRow;
  hourlyBuckets: ApiMonitoringTrendBucket[];
  unresolvedErrorGroups: ApiMonitoringErrorGroup[];
  resolvedErrorGroups: ApiMonitoringErrorGroup[];
  recentRecords: ApiMonitoringRequestRecord[];
};
