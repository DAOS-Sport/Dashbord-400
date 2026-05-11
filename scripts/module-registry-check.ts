import type { AppRole, ModuleDefinition, ModuleImplementationStatus } from "../shared/modules";
import {
  MODULE_REGISTRY,
  assertModuleRegistryValid,
  getHomepageModules,
  getModuleArchitectureCoverage,
  getModuleArchitectureGroups,
  getModulesByRole,
  getSuspiciousUnboundModules,
} from "../shared/modules";

const roles: AppRole[] = ["employee", "lifeguard", "supervisor", "system", "SYSTEM_ADMIN"];
const statuses: ModuleImplementationStatus[] = ["implemented", "partial", "planned", "legacy", "external", "mock", "deprecated"];

const countByStatus = (status: ModuleImplementationStatus) =>
  MODULE_REGISTRY.filter((module) => module.status === status).length;

const formatModules = (modules: ModuleDefinition[]) =>
  modules.map((module) => module.id).join(", ") || "(none)";

const hasBffBinding = (module: ModuleDefinition) =>
  Boolean(
    module.bff.employeeSectionKey ||
    module.bff.supervisorSectionKey ||
    module.bff.systemSectionKey ||
    module.bff.plannedEndpoints?.length,
  );

assertModuleRegistryValid();

console.log("Module Registry Coverage");
console.log("========================");
console.log(`total: ${MODULE_REGISTRY.length}`);

for (const status of statuses) {
  console.log(`${status}: ${countByStatus(status)}`);
}

console.log("");
console.log("Modules by role");
console.log("---------------");
for (const role of roles) {
  console.log(`${role}: ${formatModules(getModulesByRole(role))}`);
}

console.log("");
console.log("Homepage widgets");
console.log("----------------");
for (const role of roles) {
  console.log(`${role}: ${formatModules(getHomepageModules(role))}`);
}

console.log("");
console.log("Architecture groups");
console.log("-------------------");
for (const group of getModuleArchitectureGroups()) {
  console.log(`${group.title}: ${group.modules.map((module) => module.id).join(", ") || "(none)"}`);
}

const architectureCoverage = getModuleArchitectureCoverage();
if (architectureCoverage.ungroupedModuleIds.length > 0) {
  throw new Error(`Architecture groups missed modules: ${architectureCoverage.ungroupedModuleIds.join(", ")}`);
}

console.log("");
console.log("Modules without BFF binding (accepted background / legacy / integration)");
console.log("------------------------------------------------------------------------");
console.log(formatModules(MODULE_REGISTRY.filter((module) => !hasBffBinding(module) && !getSuspiciousUnboundModules().some((item) => item.id === module.id))));

console.log("");
console.log("Suspicious user-facing modules without BFF binding");
console.log("--------------------------------------------------");
const suspiciousUnboundModules = getSuspiciousUnboundModules();
if (suspiciousUnboundModules.length > 0) {
  throw new Error(`Suspicious user-facing modules without BFF binding: ${formatModules(suspiciousUnboundModules)}`);
}
console.log("(none)");

console.log("");
console.log("Modules with legacy routes");
console.log("--------------------------");
console.log(formatModules(MODULE_REGISTRY.filter((module) =>
  module.routes.some((route) => route.kind === "legacy_admin" || route.kind === "legacy_portal"),
)));
