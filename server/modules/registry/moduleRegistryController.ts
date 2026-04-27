import type { Express } from "express";
import type { AppRole } from "@shared/modules";
import { requireSession } from "../auth/context";
import {
  listHomeLayoutForRole,
  listModuleDescriptors,
  listModuleHealthForRole,
  listModuleRegistry,
  listModulesForRole,
  listNavigationForRoleWithPermissions,
  readModuleRegistryItem,
} from "./moduleRegistryService";

const appRoles: AppRole[] = ["employee", "supervisor", "system", "SYSTEM_ADMIN"];

const isAppRole = (value: string): value is AppRole =>
  appRoles.includes(value as AppRole);

export const registerModuleRegistryRoutes = (app: Express) => {
  app.get("/api/modules/registry", requireSession, (req, res) => {
    const role = req.workbenchSession!.activeRole;
    const includeTechnical = role === "system";
    res.json({
      items: listModuleDescriptors(role, includeTechnical),
      role,
      visibility: includeTechnical ? "technical" : "public",
    });
  });

  app.get("/api/modules/navigation", requireSession, (req, res) => {
    const session = req.workbenchSession!;
    res.json({
      role: session.activeRole,
      items: listNavigationForRoleWithPermissions(session.activeRole, session.permissionsSnapshot),
    });
  });

  app.get("/api/modules/home-layout", requireSession, (req, res) => {
    const session = req.workbenchSession!;
    res.json({
      role: session.activeRole,
      cards: listHomeLayoutForRole(session.activeRole, session.permissionsSnapshot),
    });
  });

  app.get("/api/modules/health", requireSession, (req, res) => {
    const session = req.workbenchSession!;
    res.json({
      role: session.activeRole,
      items: listModuleHealthForRole(
        session.activeRole === "system" ? undefined : session.activeRole,
        session.permissionsSnapshot,
      ),
    });
  });

  app.patch("/api/modules/:moduleId/settings", requireSession, (req, res) => {
    if (req.workbenchSession!.activeRole !== "system") {
      return res.status(403).json({ message: "Only system role can update module settings in this round" });
    }
    return res.status(202).json({
      accepted: true,
      moduleId: req.params.moduleId,
      status: "not_persisted",
      message: "Module settings API is registered; DB persistence is reserved for module_settings migration rollout.",
    });
  });

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
