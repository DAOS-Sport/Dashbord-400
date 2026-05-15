import type {
  AppRole,
  ModuleApiBinding,
  ModuleImplementationStatus,
  ModuleRouteBinding,
} from "./types";

export const implemented = "implemented" as const;
export const partial = "partial" as const;
export const planned = "planned" as const;
export const legacy = "legacy" as const;
export const external = "external" as const;
export const mock = "mock" as const;
export const deprecated = "deprecated" as const;

export const adminRoute = (
  path: string,
  status: ModuleImplementationStatus = implemented,
): ModuleRouteBinding => ({
  path,
  kind: "legacy_admin",
  role: "system",
  status,
});

export const portalRoute = (
  path: string,
  status: ModuleImplementationStatus = legacy,
): ModuleRouteBinding => ({
  path,
  kind: "legacy_portal",
  role: "employee",
  status,
});

export const roleRoute = (
  role: Extract<AppRole, "employee" | "lifeguard" | "supervisor" | "system">,
  path: string,
  status: ModuleImplementationStatus = implemented,
): ModuleRouteBinding => ({
  path,
  role,
  kind: role,
  status,
});

export const api = (
  method: ModuleApiBinding["method"],
  path: string,
  kind: ModuleApiBinding["kind"],
  status: ModuleImplementationStatus = implemented,
): ModuleApiBinding => ({ method, path, kind, status });
