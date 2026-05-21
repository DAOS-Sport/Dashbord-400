import type { LinebotApiReadiness, LinebotManagementStatus } from "./linebot-management-contract";

export type SystemProjectGroup = "governance" | "400cms" | "400line" | "schedule" | "collab-course";

export type SystemProjectStatus = "ready" | "degraded" | "not_connected" | "error";

export type SystemProjectMetrics = {
  ready: number;
  degraded: number;
  notConnected: number;
  error: number;
};

/** One error record inside a sparkline bucket. */
export type SparklineBucketError = {
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  errorType: "4xx" | "5xx" | "timeout" | "other";
};

/** One 3-hour slot in the 72-hour trend sparkline (24 slots total). */
export type SparklineBucket = {
  /** ISO timestamp marking the start of this 3-hour slot. */
  slotStart: string;
  /** Total error count in this slot. */
  count: number;
  /** Up to 5 most-recent errors in this slot (for the click-through popover). */
  errors: SparklineBucketError[];
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
  /** 7-day uptime score 0–100 (derived from current service metrics). undefined for governance. */
  uptime7d?: number;
  /** 24 × 3h error buckets for the past 72h (system-wide). Oldest bucket first. */
  errorsTrend72h?: SparklineBucket[];
  /** Human-readable status summary of the latest activity. */
  lastActivity?: string;
  /** Count of error + degraded services across all projects (governance only). */
  alertsPending?: number;
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
