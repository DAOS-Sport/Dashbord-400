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

export type HelperStatusDto = {
  generatedAt: string;
  summary: {
    externalServices: number;
    readyServices: number;
    exposedEndpoints: number;
    missingRequiredEnv: string[];
  };
  services: Array<{
    name: string;
    purpose: string;
    callMethod: string;
    credentialKeys: string[];
    missingCredentialKeys: string[];
    notes?: string;
    configured: boolean;
    status: "ready" | "not_connected";
  }>;
  endpoints: Array<{
    path: string;
    method: string;
    description: string;
    auth: string;
  }>;
  envGroups: Array<{
    title: string;
    variables: Array<{
      name: string;
      description: string;
      defaultValue?: string;
      required?: boolean;
      configured: boolean;
      status: "ready" | "missing_required" | "not_connected";
    }>;
  }>;
  resilience: Array<{
    service: string;
    strategy: string;
  }>;
};

export const fetchHelperStatus = () =>
  apiGet<HelperStatusDto>("/api/bff/system/helper-status");
