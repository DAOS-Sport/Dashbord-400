import { apiGet } from "@/shared/api/client";

export type ControlCenterSeverity = "normal" | "warning" | "critical";

export interface SystemControlCenterDto {
  kpi: {
    readyModules: number;
    degradedModules: number;
    notConnectedModules: number;
    errorModules: number;
    audit24h: number;
    watchdogCritical24h: number;
  };
  tiles: {
    watchdog: {
      severity: ControlCenterSeverity;
      criticalCount: number;
      lastEventTitle: string | null;
      lastEventAt: string | null;
    };
    operations: {
      severity: ControlCenterSeverity;
      pendingCount: number;
      todayHandledCount: number;
    };
    insights: {
      severity: ControlCenterSeverity;
      anomalyHint: string | null;
    };
    governance: {
      severity: ControlCenterSeverity;
      moduleCount: number;
      orphanCount: number;
    };
  };
  recentCriticalEvents: Array<{
    id: string;
    title: string;
    severity: string;
    source: string;
    moduleId?: string;
    role?: string;
    createdAt: string;
  }>;
  generatedAt: string;
}

export const fetchSystemControlCenter = () =>
  apiGet<SystemControlCenterDto>("/api/bff/system/control-center");
