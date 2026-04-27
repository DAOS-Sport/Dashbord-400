import type { AppRole, ModuleDefinition, ModuleImplementationStatus } from "../shared/modules";
import { MODULE_REGISTRY, assertModuleRegistryValid, getHomepageModules, getModulesByRole } from "../shared/modules";

const roles: AppRole[] = ["employee", "supervisor", "system", "SYSTEM_ADMIN"];
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
console.log("Modules without BFF binding");
console.log("---------------------------");
console.log(formatModules(MODULE_REGISTRY.filter((module) => !hasBffBinding(module))));

console.log("");
console.log("Modules with legacy routes");
console.log("--------------------------");
console.log(formatModules(MODULE_REGISTRY.filter((module) =>
  module.routes.some((route) => route.kind === "legacy_admin" || route.kind === "legacy_portal"),
)));
