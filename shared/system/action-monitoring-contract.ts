export type ActionMonitoringStatus = "healthy" | "warning" | "error" | "not_connected";

export type ActionCategory = "ops" | "session" | "permission" | "content" | "system" | "other";

export type ActionMonitoringTrendBucket = {
  hour: string;
  total: number;
  failures: number;
};

export type ActionMonitoringRow = {
  id: string;
  action: string;
  label: string;
  category: ActionCategory;
  totalCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  status: ActionMonitoringStatus;
  lastActorId?: string | null;
  lastResultStatus?: string | null;
  lastOccurredAt?: string | null;
  trend: ActionMonitoringTrendBucket[];
};

export type ActionMonitoringSummary = {
  totalActions: number;
  totalExecutions: number;
  totalFailures: number;
  healthy: number;
  warning: number;
  error: number;
  notConnected: number;
  lastUpdatedAt: string;
};

export type ActionMonitoringDto = {
  generatedAt: string;
  summary: ActionMonitoringSummary;
  rows: ActionMonitoringRow[];
};
