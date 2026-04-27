import type { Express } from "express";
import type { AppRole } from "@shared/modules";
import { listModuleRegistry, listModulesForRole, readModuleRegistryItem } from "./moduleRegistryService";

const appRoles: AppRole[] = ["employee", "supervisor", "system", "SYSTEM_ADMIN"];

const isAppRole = (value: string): value is AppRole =>
  appRoles.includes(value as AppRole);

export const registerModuleRegistryRoutes = (app: Express) => {
  // TODO: Require SYSTEM_ADMIN before exposing this debug surface in production.
  app.get("/api/system/module-registry", (_req, res) => {
    res.json({
      items: listModuleRegistry(),
      warning: "Debug endpoint. Production must restrict this to SYSTEM_ADMIN.",
    });
  });

  app.get("/api/system/module-registry/:id", (req, res) => {
    const item = readModuleRegistryItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Module not found" });
    return res.json(item);
  });

  app.get("/api/system/module-registry-role/:role", (req, res) => {
    const role = req.params.role;
    if (!isAppRole(role)) {
      return res.status(400).json({ message: "Invalid role", allowedRoles: appRoles });
    }
    return res.json(listModulesForRole(role));
  });
};
