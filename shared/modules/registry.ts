import { MODULE_IDS, type ModuleId } from "./ids";
import type {
  AppRole,
  ModuleApiBinding,
  ModuleDefinition,
  ModuleDomainType,
  ModuleImplementationStatus,
  ModuleRouteBinding,
} from "./types";
import { contentModules } from "./registry/content";
import { foundationModules } from "./registry/foundation";
import { governanceModules } from "./registry/governance";
import { lifeguardModules } from "./registry/lifeguard";
import { operationsModules } from "./registry/operations";
import { portalIntegrationModules } from "./registry/portal-integrations";
import { deprecated, external, implemented, legacy, mock, partial, planned } from "./registry-helpers";

// Source of truth: this code manifest is authoritative. DB module_settings is legacy/cache only
// and production navigation/permissions must not depend on it.
export const MODULE_REGISTRY: ModuleDefinition[] = [
  ...foundationModules,
  ...lifeguardModules,
  ...operationsModules,
  ...contentModules,
  ...portalIntegrationModules,
  ...governanceModules,
];


const statuses: ModuleImplementationStatus[] = [implemented, partial, mock, external, planned, legacy, "deprecated"];
const roles: AppRole[] = ["employee", "lifeguard", "supervisor", "system", "SYSTEM_ADMIN"];
const methods: ModuleApiBinding["method"][] = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const apiKinds: ModuleApiBinding["kind"][] = ["bff", "crud", "proxy", "auth", "telemetry", "export", "upload", "legacy"];
const domains: ModuleDomainType[] = ["core", "derived", "support", "system", "integration", "legacy"];
const uiStates: NonNullable<ModuleDefinition["bff"]["uiStates"]>[number][] = ["loading", "ready", "empty", "error", "degraded", "unavailable", "disabled", "stale"];
const freshnessProfiles: NonNullable<ModuleDefinition["bff"]["freshness"]>[] = ["realtime", "5min", "1hour", "daily", "manual"];

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const priorityKeyForRole = (role: AppRole): keyof ModuleDefinition["priority"] =>
  role === "SYSTEM_ADMIN" ? "system" : role;

export const getModuleById = (id: ModuleId): ModuleDefinition | undefined =>
  MODULE_REGISTRY.find((module) => module.id === id);

export const getModulesByRole = (role: AppRole): ModuleDefinition[] =>
  MODULE_REGISTRY.filter((module) => module.visibleRoles.includes(role));

export const getHomepageModules = (role: AppRole): ModuleDefinition[] =>
  getModulesByRole(role)
    .filter((module) => module.homepageWidget)
    .sort((a, b) => {
      const key = priorityKeyForRole(role);
      return (a.priority[key] ?? Number.MAX_SAFE_INTEGER) - (b.priority[key] ?? Number.MAX_SAFE_INTEGER);
    });

export const getModulesByDomain = (domainType: ModuleDomainType): ModuleDefinition[] =>
  MODULE_REGISTRY.filter((module) => module.domainType === domainType);

export const getImplementedModules = (): ModuleDefinition[] =>
  MODULE_REGISTRY.filter((module) => module.status === "implemented");

export const getPlannedModules = (): ModuleDefinition[] =>
  MODULE_REGISTRY.filter((module) => module.status === "planned");

export const getLegacyModules = (): ModuleDefinition[] =>
  MODULE_REGISTRY.filter((module) => module.status === "legacy" || module.routes.some((route) => route.kind === "legacy_admin" || route.kind === "legacy_portal"));

export const getModuleRoutes = (id: ModuleId): ModuleRouteBinding[] =>
  getModuleById(id)?.routes ?? [];

export const getModuleApis = (id: ModuleId): ModuleApiBinding[] =>
  getModuleById(id)?.apis ?? [];

export const assertModuleRegistryValid = (): void => {
  const ids = new Set<string>();
  const validIds = new Set<string>(MODULE_IDS);

  for (const module of MODULE_REGISTRY) {
    assert(Boolean(module.id), "Module id cannot be empty");
    assert(validIds.has(module.id), `Module id is not declared in MODULE_IDS: ${module.id}`);
    assert(!ids.has(module.id), `Duplicate module id: ${module.id}`);
    ids.add(module.id);

    assert(module.label.trim().length > 0, `Module ${module.id} label cannot be empty`);
    assert(module.description.trim().length > 0, `Module ${module.id} description cannot be empty`);
    assert(statuses.includes(module.status), `Module ${module.id} has invalid status: ${module.status}`);
    assert(domains.includes(module.domainType), `Module ${module.id} has invalid domain type: ${module.domainType}`);
    assert(module.visibleRoles.length > 0, `Module ${module.id} visibleRoles cannot be empty`);

    for (const role of module.visibleRoles) {
      assert(roles.includes(role), `Module ${module.id} has unknown role: ${role}`);
    }

    if (module.homepageWidget) {
      assert(
        module.priority.employee !== undefined || module.priority.lifeguard !== undefined || module.priority.supervisor !== undefined || module.priority.system !== undefined,
        `Module ${module.id} homepageWidget=true requires at least one priority`,
      );
    }

    if (module.status === "planned") {
      assert(Boolean(module.governance.notes?.trim()), `Planned module ${module.id} must include governance notes`);
    }

    for (const route of module.routes) {
      assert(Boolean(route.path.trim()), `Module ${module.id} has a route with empty path`);
      assert(statuses.includes(route.status), `Module ${module.id} route ${route.path} has invalid status`);
      if (route.role) assert(roles.includes(route.role), `Module ${module.id} route ${route.path} has unknown role`);
    }

    for (const binding of module.apis) {
      assert(methods.includes(binding.method), `Module ${module.id} API ${binding.path} has invalid method`);
      assert(Boolean(binding.path.trim()), `Module ${module.id} API path cannot be empty`);
      assert(apiKinds.includes(binding.kind), `Module ${module.id} API ${binding.path} has invalid kind`);
      assert(statuses.includes(binding.status), `Module ${module.id} API ${binding.path} has invalid status`);
    }

    if (module.bff.uiStates) {
      for (const state of module.bff.uiStates) {
        assert(uiStates.includes(state), `Module ${module.id} BFF UI state is invalid: ${state}`);
      }
    }
    if (module.bff.freshness) {
      assert(freshnessProfiles.includes(module.bff.freshness), `Module ${module.id} BFF freshness is invalid: ${module.bff.freshness}`);
    }
  }
};
