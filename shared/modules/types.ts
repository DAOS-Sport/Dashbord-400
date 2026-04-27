import type { ModuleId } from "./ids";

export type AppRole =
  | "employee"
  | "supervisor"
  | "system"
  | "SYSTEM_ADMIN";

export type ModuleDomainType =
  | "core"
  | "derived"
  | "support"
  | "system"
  | "integration"
  | "legacy";

export type ModuleImplementationStatus =
  | "implemented"
  | "partial"
  | "mock"
  | "external"
  | "planned"
  | "legacy"
  | "deprecated";

export type ModuleSourceOfTruth =
  | "postgres"
  | "external"
  | "projection"
  | "telemetry"
  | "private"
  | "legacy"
  | "none";

export type ModuleVisibility =
  | "homepage_widget"
  | "detail_page"
  | "admin_page"
  | "portal_page"
  | "background_only"
  | "system_only";

export interface ModuleRouteBinding {
  role?: AppRole;
  path: string;
  kind:
    | "legacy_admin"
    | "legacy_portal"
    | "employee"
    | "supervisor"
    | "system"
    | "api"
    | "external";
  status: ModuleImplementationStatus;
}

export interface ModuleApiBinding {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  kind:
    | "bff"
    | "crud"
    | "proxy"
    | "auth"
    | "telemetry"
    | "export"
    | "upload"
    | "legacy";
  status: ModuleImplementationStatus;
}

export interface ModuleDataBinding {
  table?: string;
  entity?: string;
  source: ModuleSourceOfTruth;
  status: ModuleImplementationStatus;
  notes?: string;
}

export interface ModuleIntegrationBinding {
  provider:
    | "LINE_BOT_ASSISTANT"
    | "SMART_SCHEDULE_MANAGER"
    | "RAGIC"
    | "GMAIL_SMTP"
    | "LOCAL_STORAGE"
    | "POSTGRES"
    | "NEON"
    | "OBJECT_STORAGE"
    | "UNKNOWN";
  purpose: string;
  status: ModuleImplementationStatus;
  notes?: string;
}

export interface ModuleBffBinding {
  employeeSectionKey?: string;
  supervisorSectionKey?: string;
  systemSectionKey?: string;
  plannedEndpoints?: string[];
}

export interface ModuleTelemetryBinding {
  trackPageView?: boolean;
  trackCardClick?: boolean;
  trackActionSubmit?: boolean;
  auditRequired?: boolean;
  eventTypes?: string[];
}

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  description: string;
  domainType: ModuleDomainType;
  status: ModuleImplementationStatus;
  visibleRoles: AppRole[];
  visibility: ModuleVisibility[];
  sourceOfTruth: ModuleSourceOfTruth;
  homepageWidget: boolean;
  priority: {
    employee?: number;
    supervisor?: number;
    system?: number;
  };
  routes: ModuleRouteBinding[];
  apis: ModuleApiBinding[];
  data: ModuleDataBinding[];
  integrations: ModuleIntegrationBinding[];
  bff: ModuleBffBinding;
  telemetry: ModuleTelemetryBinding;
  governance: {
    ownerRole?: AppRole;
    editableBy: AppRole[];
    readonlyFor: AppRole[];
    requiresApproval?: boolean;
    notes?: string;
  };
  legacy?: {
    oldNames?: string[];
    oldRoutes?: string[];
    migrationNotes?: string;
  };
}
