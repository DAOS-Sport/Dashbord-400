import type { AppRole, ModuleId } from "@shared/modules";
import {
  MODULE_REGISTRY,
  assertModuleRegistryValid,
  getHomepageModules,
  getModuleById,
  getModulesByRole,
  isModuleId,
} from "@shared/modules";

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
