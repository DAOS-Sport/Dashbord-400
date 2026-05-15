import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  getHomeLayoutCards,
  getModuleArchitectureCoverage,
  getModuleDescriptors,
  getModuleDescriptorsByRole,
  getNavigationModules,
  getSuspiciousUnboundModules,
  MODULE_REGISTRY,
} from "../shared/modules";
import type { WorkbenchRole } from "../shared/auth/me";
import { getPrimaryRoute, getWorkbenchRoutes } from "../shared/navigation/workbench-routes";

const repoRoot = process.cwd();
const roles: WorkbenchRole[] = ["employee", "lifeguard", "supervisor", "system"];

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");
const appRoutes = read("client/src/App.tsx");
const routeManifest = read("shared/navigation/workbench-routes.ts");
const moduleDescriptors = getModuleDescriptors();
const descriptorIds = new Set(moduleDescriptors.map((item) => item.id));
const registryIds = new Set(MODULE_REGISTRY.map((item) => item.id));

const requiredDocs = [
  "docs/governance/WORKBENCH_PERMISSION_MATRIX.md",
  "docs/governance/WORKBENCH_ROUTE_MAP.md",
  "docs/governance/MODULE_REGISTRY_PAGE_AUDIT.md",
  "docs/integrations/REPLIT_ACCEPTANCE_CHECKLIST.md",
  "docs/operations/LEGACY_RUNTIME_CLEANUP.md",
];

for (const doc of requiredDocs) {
  assert(existsSync(join(repoRoot, doc)), `governance doc missing: ${doc}`);
}

for (const descriptor of moduleDescriptors) {
  assert(registryIds.has(descriptor.id), `descriptor has no MODULE_REGISTRY entry: ${descriptor.id}`);
}

for (const route of roles.flatMap((role) => getWorkbenchRoutes(role))) {
  assert(registryIds.has(route.moduleId), `workbench route has no MODULE_REGISTRY entry: ${route.role}/${route.moduleId}`);
}

const architectureCoverage = getModuleArchitectureCoverage();
assert(architectureCoverage.ungroupedModuleIds.length === 0, `architecture system missed modules: ${architectureCoverage.ungroupedModuleIds.join(", ")}`);
assert(getSuspiciousUnboundModules().length === 0, `user-facing modules without BFF binding: ${getSuspiciousUnboundModules().map((module) => module.id).join(", ")}`);

for (const route of getWorkbenchRoutes("supervisor")) {
  assert(!route.primaryPath.startsWith("/admin/"), `supervisor primary route still uses /admin: ${route.moduleId}`);
  assert(!route.primaryPath.startsWith("/courts/"), `supervisor primary route still uses naked /courts: ${route.moduleId}`);
  assert(route.primaryPath !== "/analytics" && route.primaryPath !== "/operations", `supervisor primary route still uses legacy path: ${route.moduleId}`);
}

for (const route of getWorkbenchRoutes("employee")) {
  assert(!route.primaryPath.startsWith("/system"), `employee primary route enters system area: ${route.moduleId}`);
  assert(!route.primaryPath.startsWith("/supervisor"), `employee primary route enters supervisor area: ${route.moduleId}`);
}

for (const route of getWorkbenchRoutes("lifeguard")) {
  assert(route.primaryPath.startsWith("/lifeguard") || route.primaryPath.startsWith("/employee"), `lifeguard route must stay in lifeguard/employee surface: ${route.moduleId}`);
}

for (const role of roles) {
  const navigation = getNavigationModules(role);
  const cards = getHomeLayoutCards(role);
  const routeIds = new Set(getWorkbenchRoutes(role).map((item) => item.moduleId));

  for (const item of navigation) {
    assert(descriptorIds.has(item.id), `${role} nav references missing descriptor: ${item.id}`);
    assert(cards.some((card) => card.moduleId === item.id), `${role} nav module missing home card: ${item.id}`);
    if (role !== "system") {
      assert(routeIds.has(item.id), `${role} nav module missing workbench route: ${item.id}`);
    }
  }

  for (const descriptor of getModuleDescriptorsByRole(role)) {
    if (!descriptor.navVisible) continue;
    const primary = getPrimaryRoute(descriptor.id, role);
    if (!primary) continue;
    assert(descriptor.routePath === primary, `${role} descriptor route mismatch for ${descriptor.id}: ${descriptor.routePath} != ${primary}`);
  }
}

assert(!appRoutes.includes("AppSidebar"), "App.tsx must not import or render legacy AppSidebar");
assert(!appRoutes.includes("SidebarProvider"), "App.tsx must not import or render legacy SidebarProvider");
assert(routeManifest.includes("getRedirectForLegacyPath"), "legacy redirects must stay centralized in workbench-routes.ts");

const routeExistsInApp = (path: string) => {
  if (appRoutes.includes(`path="${path}"`) || appRoutes.includes(`to="${path}"`) || appRoutes.includes(path)) return true;
  if (path.startsWith("/employee/courts/")) return appRoutes.includes('path="/employee/courts/:school"');
  if (path.startsWith("/supervisor/courts/")) return appRoutes.includes('path="/supervisor/courts/:school"');
  if (path.startsWith("/supervisor/facilities/")) return appRoutes.includes('path="/supervisor/facilities/:facilityKey"');
  return false;
};

const routePatternToRegex = (path: string) =>
  new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\:([^/]+)/g, "[^/]+")}$`);

const registeredRuntimeRoutes = new Set<string>();
for (const module of MODULE_REGISTRY) {
  for (const route of module.routes) {
    if (route.kind !== "api") registeredRuntimeRoutes.add(route.path);
  }
}
for (const route of roles.flatMap((role) => getWorkbenchRoutes(role))) {
  registeredRuntimeRoutes.add(route.primaryPath);
}

const registeredRouteMatchers = Array.from(registeredRuntimeRoutes).map((path) => routePatternToRegex(path));
const intentionalRuntimeAliases = new Set([
  "/",
  "/SYSTEM",
  "/SUPERVISOR",
  "/EMPLOYEE",
  "/LIFEGUARD",
  "/courts",
  "/courts/:school",
  "/courts/:school/week",
  "/courts/:school/month",
  "/courts/:school/search",
  "/courts/:school/admin",
  "/supervisor/courts",
  "/employee/courts",
  "/supervisor/settings",
]);

const appRoutePaths = Array.from(appRoutes.matchAll(/<Route\s+path="([^"]+)"/g)).map((match) => match[1]);
for (const path of appRoutePaths) {
  const registered =
    intentionalRuntimeAliases.has(path) ||
    registeredRuntimeRoutes.has(path) ||
    registeredRouteMatchers.some((matcher) => matcher.test(path));
  assert(registered, `runtime route is not registered to any module: ${path}`);
}

for (const route of roles.flatMap((role) => getWorkbenchRoutes(role))) {
  assert(routeExistsInApp(route.primaryPath), `canonical route not mounted in App.tsx: ${route.role}/${route.moduleId} -> ${route.primaryPath}`);
}

const docsSummary = requiredDocs.map((doc) => `- ${doc}`).join("\n");
console.log("Workbench governance check passed");
console.log(`roles: ${roles.join(", ")}`);
console.log(`routes: ${roles.reduce((sum, role) => sum + getWorkbenchRoutes(role).length, 0)}`);
console.log(`descriptors: ${moduleDescriptors.length}`);
console.log(`registry modules: ${MODULE_REGISTRY.length}`);
console.log(`runtime routes checked: ${appRoutePaths.length}`);
console.log(`docs:\n${docsSummary}`);
