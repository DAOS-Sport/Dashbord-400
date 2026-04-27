import type { AppRole, ModuleId } from "@shared/modules";
import {
  MODULE_REGISTRY,
  assertModuleRegistryValid,
  canAccessRoute,
  canManageModule,
  canViewModule,
  getHomeLayoutCards,
  getHomepageModules,
  getModuleDescriptors,
  getModuleDescriptorsByRole,
  getModuleHealth,
  getModuleById,
  getModulesByRole,
  getNavigationModules,
  isModuleId,
} from "@shared/modules";
import type { WorkbenchRole } from "@shared/auth/me";

export const listModuleRegistry = () => {
  assertModuleRegistryValid();
  return MODULE_REGISTRY;
};

export const readModuleRegistryItem = (id: string) => {
  if (!isModuleId(id)) return undefined;
  assertModuleRegistryValid();
  return getModuleById(id as ModuleId);
};

export const listModulesForRole = (role: AppRole) => {
  assertModuleRegistryValid();
  return {
    role,
    modules: getModulesByRole(role),
    homepageModules: getHomepageModules(role),
  };
};

export const listModuleDescriptors = (role?: WorkbenchRole, includeTechnical = false) => {
  assertModuleRegistryValid();
  const descriptors = role ? getModuleDescriptorsByRole(role) : getModuleDescriptors();
  if (includeTechnical) return descriptors;
  return descriptors.map(({ dependencies, requiredPermissions, telemetryEvents, ...publicDescriptor }) => ({
    ...publicDescriptor,
    dependencies: dependencies.length ? dependencies : [],
    requiredPermissions: [],
    telemetryEvents,
  }));
};

export const listNavigationForRole = (role: WorkbenchRole) => {
  assertModuleRegistryValid();
  return getNavigationModules(role);
};

export const listNavigationForRoleWithPermissions = (role: WorkbenchRole, permissionsSnapshot?: string[]) => {
  assertModuleRegistryValid();
  return getNavigationModules(role, permissionsSnapshot);
};

export const listHomeLayoutForRole = (role: WorkbenchRole, permissionsSnapshot?: string[]) => {
  assertModuleRegistryValid();
  return getHomeLayoutCards(role, permissionsSnapshot);
};

export const listModuleHealthForRole = (role?: WorkbenchRole, permissionsSnapshot?: string[]) => {
  assertModuleRegistryValid();
  return getModuleHealth(role, permissionsSnapshot);
};

export const modulePolicy = {
  canViewModule,
  canManageModule,
  canAccessRoute,
};
