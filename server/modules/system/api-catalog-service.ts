import type { AppRole, ModuleApiBinding, ModuleDefinition } from "@shared/modules";
import { MODULE_REGISTRY, getModuleById, getModuleDescriptorsByRole, type ModuleId } from "@shared/modules";
import { apiRouteManifest, type ApiRouteManifestEntry } from "../api-hub/route-manifest";

type ApiSurfaceRole = Extract<AppRole, "employee" | "lifeguard" | "supervisor" | "system">;
type ApiCatalogProject =
  | "400CMS"
  | "400LINE"
  | "Schedule"
  | "CollabCourse"
  | "Portal"
  | "ObjectStorage"
  | "External"
  | "Legacy";

type ApiCatalogFeature =
  | "auth"
  | "employee-workbench"
  | "lifeguard-workbench"
  | "supervisor-operations"
  | "system-governance"
  | "monitoring"
  | "announcements"
  | "handover"
  | "content"
  | "parking"
  | "courts"
  | "lane-rentals"
  | "line"
  | "schedule"
  | "collab-course"
  | "storage"
  | "portal"
  | "telemetry"
  | "legacy"
  | "other";

const apiSurfaceRoles: ApiSurfaceRole[] = ["employee", "lifeguard", "supervisor", "system"];

const roleLabels: Record<ApiSurfaceRole, string> = {
  employee: "員工",
  lifeguard: "救生",
  supervisor: "主管",
  system: "系統",
};

const apiRank: Record<ModuleApiBinding["kind"], number> = {
  bff: 0,
  crud: 1,
  proxy: 2,
  auth: 3,
  telemetry: 4,
  upload: 5,
  export: 6,
  legacy: 7,
};

const apiPriority = (api: ModuleApiBinding) =>
  apiRank[api.kind] * 100 +
  (api.status === "implemented" ? 0 : api.status === "partial" ? 10 : api.status === "legacy" ? 20 : 30) +
  api.path.length / 1000;

const roleFromPath = (path: string): ApiSurfaceRole | "public" | "internal" | "cross-role" => {
  if (path.startsWith("/api/bff/employee") || path.startsWith("/api/employee")) return "employee";
  if (path.startsWith("/api/bff/lifeguard") || path.startsWith("/api/lifeguard")) return "lifeguard";
  if (path.startsWith("/api/bff/supervisor") || path.startsWith("/api/supervisor")) return "supervisor";
  if (path.startsWith("/api/bff/system") || path.startsWith("/api/system") || path.startsWith("/api/cms/system")) return "system";
  if (path.startsWith("/api/auth") || path.startsWith("/api/modules") || path.startsWith("/api/search")) return "cross-role";
  if (path.startsWith("/api/portal") || path.startsWith("/objects") || path.startsWith("/uploads")) return "public";
  if (path.startsWith("/api/internal")) return "internal";
  return "cross-role";
};

const classifyProject = (path: string, handlerFile: string): ApiCatalogProject => {
  const target = `${path} ${handlerFile}`.toLowerCase();
  if (target.includes("line") || target.includes("whitelist") || target.includes("announcement-candidates")) return "400LINE";
  if (target.includes("schedule") || target.includes("shift-reminder")) return "Schedule";
  if (target.includes("collab-course")) return "CollabCourse";
  if (path.startsWith("/api/portal")) return "Portal";
  if (path.startsWith("/objects") || path.includes("/storage/objects") || path.includes("/uploads") || target.includes("object_storage")) return "ObjectStorage";
  if (path.startsWith("/api/internal") || path.startsWith("/api/integrations")) return "External";
  if (handlerFile.includes("legacy") || path.includes("legacy") || path.startsWith("/api/admin")) return "Legacy";
  return "400CMS";
};

const classifyFeature = (path: string, handlerFile: string): ApiCatalogFeature => {
  const target = `${path} ${handlerFile}`.toLowerCase();
  if (target.includes("auth") || target.includes("session")) return "auth";
  if (path.startsWith("/api/bff/employee") || target.includes("employee-home")) return "employee-workbench";
  if (path.startsWith("/api/bff/lifeguard") || target.includes("lifeguard")) return "lifeguard-workbench";
  if (path.startsWith("/api/bff/supervisor") || target.includes("supervisor")) return "supervisor-operations";
  if (path.startsWith("/api/bff/system") || path.startsWith("/api/system") || path.startsWith("/api/cms/system")) {
    if (target.includes("monitoring") || target.includes("health") || target.includes("watchdog")) return "monitoring";
    return "system-governance";
  }
  if (target.includes("announcement") || target.includes("notification") || target.includes("broadcast")) return "announcements";
  if (target.includes("handover") || target.includes("task")) return "handover";
  if (target.includes("resource") || target.includes("training") || target.includes("qna") || target.includes("knowledge") || target.includes("quick-link")) return "content";
  if (target.includes("parking")) return "parking";
  if (target.includes("court")) return "courts";
  if (target.includes("lane-rental")) return "lane-rentals";
  if (target.includes("line") || target.includes("whitelist")) return "line";
  if (target.includes("schedule") || target.includes("shift")) return "schedule";
  if (target.includes("collab-course")) return "collab-course";
  if (target.includes("storage") || target.includes("upload") || path.startsWith("/objects")) return "storage";
  if (path.startsWith("/api/portal")) return "portal";
  if (target.includes("telemetry") || target.includes("audit") || target.includes("event")) return "telemetry";
  if (handlerFile.includes("legacy") || path.startsWith("/api/admin")) return "legacy";
  return "other";
};

const normalizeRoutePath = (path: string) =>
  path.replace(/\*[^/]*/g, ":splat").replace(/\(\.\+\)/g, ":splat");

const fallbackModuleIdsForEntry = (entry: ApiRouteManifestEntry): ModuleId[] => {
  const target = `${entry.path} ${entry.handlerFile}`.toLowerCase();
  if (target.includes("announcement-overlays") || target.includes("widgets/announcements")) return ["announcements"];
  if (entry.path.startsWith("/api/bff/employee/announcements")) return ["announcements"];
  if (target.includes("announcement-candidates")) return ["announcement-review"];
  if (target.includes("announcement-whitelist")) return ["line-whitelist"];
  if (target.includes("widget-layout")) return ["widget-layout-settings"];
  if (entry.path.startsWith("/api/bff/supervisor/facilities")) return ["facilities"];
  if (entry.path.startsWith("/api/bff/system/dashboard")) return ["system-dashboard"];
  if (target.includes("collab-course")) return ["registration-courses"];
  if (target.includes("court")) return ["courts"];
  if (target.includes("parking/contracts")) return ["parking-contracts"];
  if (target.includes("parking/vehicles")) return ["parking-vehicles"];
  if (target.includes("parking")) return ["parking"];
  if (target.includes("handover") || target.includes("assigned-tasks")) return ["handover"];
  if (target.includes("lost-and-found")) return ["lifeguard-lost-and-found"];
  if (target.includes("qna-review") || target.includes("knowledge")) return ["knowledge-base-qna"];
  if (target.includes("/api/modules")) return ["system-governance"];
  if (target.includes("module-registry")) return ["system-governance"];
  if (target.includes("lifeguard/records")) return ["lifeguard-home"];
  if (target.includes("api-monitoring") || target.includes("project-monitoring") || target.includes("module-health")) return ["system-control-center"];
  if (target.includes("db-health") || target.includes("ragic-health") || target.includes("/api/health")) return ["system-health"];
  if (target.includes("line-whitelist")) return ["line-whitelist"];
  if (target.includes("linexbs") || target.includes("helper-status")) return ["helper-status"];
  if (target.includes("linebot-management") || target.includes("line-bot")) return ["linebot-management"];
  if (target.includes("telemetry") || target.includes("audit")) return ["telemetry-audit"];
  if (target.includes("storage") || target.includes("upload")) return ["file-upload-export"];
  if (target.includes("daily-templates") || target.includes("recurring-templates")) return ["lifeguard-cleanup"];
  if (target.includes("work-logs")) return ["handover"];
  return [];
};

const findRegistryModules = (entry: ApiRouteManifestEntry) => {
  const exactKey = `${entry.method} ${normalizeRoutePath(entry.path)}`;
  const matches: Array<{ module: ModuleDefinition; match: "exact" | "inferred" }> = [];
  for (const module of MODULE_REGISTRY) {
    if (module.apis.some((api) => `${api.method} ${normalizeRoutePath(api.path)}` === exactKey)) {
      matches.push({ module, match: "exact" });
    }
  }
  if (matches.length) return matches;
  return fallbackModuleIdsForEntry(entry)
    .map((id) => getModuleById(id))
    .filter((module): module is ModuleDefinition => Boolean(module))
    .map((module) => ({ module, match: "inferred" as const }));
};

export const buildRoleApiSurfaces = () =>
  apiSurfaceRoles.map((role) => {
    const modules = MODULE_REGISTRY
      .filter((module) => module.visibleRoles.includes(role))
      .map((module) => {
        const descriptor = getModuleDescriptorsByRole(role).find((item) => item.id === module.id);
        const roleRoute = module.routes.find((route) => route.role === role && route.kind === role);
        return {
          module,
          routePath: descriptor?.routePath ?? roleRoute?.path,
          apis: module.apis,
        };
      })
      .filter((item) => item.apis.length > 0);

    const apiKeys = new Set<string>();
    const kindCounts: Record<ModuleApiBinding["kind"], number> = {
      bff: 0,
      crud: 0,
      proxy: 0,
      auth: 0,
      telemetry: 0,
      export: 0,
      upload: 0,
      legacy: 0,
    };
    const statusCounts: Partial<Record<ModuleApiBinding["status"], number>> = {};

    for (const item of modules) {
      for (const api of item.apis) {
        apiKeys.add(`${api.method} ${api.path}`);
        kindCounts[api.kind] += 1;
        statusCounts[api.status] = (statusCounts[api.status] ?? 0) + 1;
      }
    }

    const topModules = modules
      .map((item) => ({
        moduleId: item.module.id,
        label: item.module.label,
        routePath: item.routePath,
        status: item.module.status,
        apiCount: item.apis.length,
        bffCount: item.apis.filter((api) => api.kind === "bff").length,
        legacyCount: item.apis.filter((api) => api.kind === "legacy").length,
        primaryApis: [...item.apis]
          .sort((a, b) => apiPriority(a) - apiPriority(b))
          .slice(0, 4)
          .map((api) => ({
            method: api.method,
            path: api.path,
            kind: api.kind,
            status: api.status,
          })),
      }))
      .sort((a, b) => b.bffCount - a.bffCount || b.apiCount - a.apiCount || a.label.localeCompare(b.label, "zh-TW"))
      .slice(0, 8);

    return {
      role,
      label: roleLabels[role],
      moduleCount: modules.length,
      apiCount: apiKeys.size,
      bffCount: kindCounts.bff,
      legacyCount: kindCounts.legacy,
      proxyCount: kindCounts.proxy,
      partialCount: statusCounts.partial ?? 0,
      topModules,
    };
  });

export const buildSystemApiCatalog = () => {
  const entries = apiRouteManifest.map((entry) => {
    const registryMatches = findRegistryModules(entry);
    const project = classifyProject(entry.path, entry.handlerFile);
    const feature = classifyFeature(entry.path, entry.handlerFile);
    return {
      ...entry,
      project,
      feature,
      role: roleFromPath(entry.path),
      registryModules: registryMatches.map(({ module, match }) => ({
        id: module.id,
        label: module.label,
        status: module.status,
        visibleRoles: module.visibleRoles,
        sourceOfTruth: module.sourceOfTruth,
        match,
        dataSources: module.data.map((data) => ({
          table: data.table,
          entity: data.entity,
          source: data.source,
          status: data.status,
          notes: data.notes,
        })),
        integrations: module.integrations.map((integration) => ({
          provider: integration.provider,
          purpose: integration.purpose,
          status: integration.status,
          notes: integration.notes,
        })),
      })),
    };
  });

  const countBy = <K extends string>(items: K[]) =>
    items.reduce<Record<K, number>>((acc, key) => {
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<K, number>);

  const moduleSources = MODULE_REGISTRY.map((module) => ({
    moduleId: module.id,
    label: module.label,
    project: module.domainType,
    feature: module.description,
    status: module.status,
    visibleRoles: module.visibleRoles,
    sourceOfTruth: module.sourceOfTruth,
    routeCount: module.routes.length,
    apiCount: module.apis.length,
    dataSources: module.data.map((data) => ({
      table: data.table,
      entity: data.entity,
      source: data.source,
      status: data.status,
      notes: data.notes,
    })),
    integrations: module.integrations.map((integration) => ({
      provider: integration.provider,
      purpose: integration.purpose,
      status: integration.status,
      notes: integration.notes,
    })),
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: {
      router: "server/modules/api-hub/index.ts",
      routeManifest: "server/modules/api-hub/route-manifest.ts",
      moduleRegistry: "shared/modules/registry.ts",
      inventory: "docs/architecture/api-inventory.md",
    },
    summary: {
      totalApis: entries.length,
      registeredModules: MODULE_REGISTRY.length,
      projects: countBy(entries.map((entry) => entry.project)),
      features: countBy(entries.map((entry) => entry.feature)),
      roles: countBy(entries.map((entry) => entry.role)),
      unmappedApis: entries.filter((entry) => entry.registryModules.length === 0).length,
      inferredModuleMatches: entries.filter((entry) => entry.registryModules.some((module) => module.match === "inferred")).length,
    },
    roleApiSurfaces: buildRoleApiSurfaces(),
    entries,
    moduleSources,
  };
};
