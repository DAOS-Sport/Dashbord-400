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
  roleApiSurfaces: Array<{
    role: "employee" | "lifeguard" | "supervisor" | "system";
    label: string;
    moduleCount: number;
    apiCount: number;
    bffCount: number;
    legacyCount: number;
    proxyCount: number;
    partialCount: number;
    topModules: Array<{
      moduleId: string;
      label: string;
      routePath?: string;
      status: string;
      apiCount: number;
      bffCount: number;
      legacyCount: number;
      primaryApis: Array<{
        method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
        path: string;
        kind: string;
        status: string;
      }>;
    }>;
  }>;
  generatedAt: string;
}

export const fetchSystemControlCenter = () =>
  apiGet<SystemControlCenterDto>("/api/bff/system/control-center");

export interface SystemApiCatalogDto {
  generatedAt: string;
  source: {
    router: string;
    routeManifest: string;
    moduleRegistry: string;
    inventory: string;
  };
  summary: {
    totalApis: number;
    registeredModules: number;
    projects: Record<string, number>;
    features: Record<string, number>;
    roles: Record<string, number>;
    unmappedApis: number;
    inferredModuleMatches: number;
  };
  roleApiSurfaces: SystemControlCenterDto["roleApiSurfaces"];
  entries: Array<{
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    path: string;
    handlerFile: string;
    auth: string;
    dataSource: string;
    request: string;
    response: string;
    project: string;
    feature: string;
    role: string;
    registryModules: Array<{
      id: string;
      label: string;
      status: string;
      visibleRoles: string[];
      sourceOfTruth: string;
      match: "exact" | "inferred";
      dataSources: Array<{
        table?: string;
        entity?: string;
        source: string;
        status: string;
        notes?: string;
      }>;
      integrations: Array<{
        provider: string;
        purpose: string;
        status: string;
        notes?: string;
      }>;
    }>;
  }>;
  moduleSources: Array<{
    moduleId: string;
    label: string;
    project: string;
    feature: string;
    status: string;
    visibleRoles: string[];
    sourceOfTruth: string;
    routeCount: number;
    apiCount: number;
    dataSources: Array<{
      table?: string;
      entity?: string;
      source: string;
      status: string;
      notes?: string;
    }>;
    integrations: Array<{
      provider: string;
      purpose: string;
      status: string;
      notes?: string;
    }>;
  }>;
}

export const fetchSystemApiCatalog = () =>
  apiGet<SystemApiCatalogDto>("/api/bff/system/api-catalog");

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
