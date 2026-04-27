import type { AppRole, ModuleId } from "@shared/modules";
import { getHomepageModules, getModuleById, getModulesByRole } from "@shared/modules";

export const useModulesForRole = (role: AppRole) => getModulesByRole(role);

export const useHomepageModules = (role: AppRole) => getHomepageModules(role);

export const useModule = (id: ModuleId) => getModuleById(id);
