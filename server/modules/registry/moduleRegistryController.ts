import type { Express } from "express";
import type { AppRole } from "@shared/modules";
import { requireRole, requireSession } from "../auth/context";
import {
  listHomeLayoutForRole,
  listModuleDescriptors,
  listModuleHealthForRole,
  listModuleRegistry,
  listModulesForRole,
  listNavigationForRoleWithPermissions,
  readModuleRegistryItem,
} from "./moduleRegistryService";

const appRoles: AppRole[] = ["employee", "lifeguard", "supervisor", "system", "SYSTEM_ADMIN"];

const isAppRole = (value: string): value is AppRole =>
  appRoles.includes(value as AppRole);

const hasPermission = (permissions: string[] | undefined, permission: string) =>
  Boolean(permissions?.includes(permission) || permissions?.some((item) => item.startsWith("system:")));

const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? "";

const requireSystemRegistryRead: import("express").RequestHandler = (req, res, next) => {
  if (req.workbenchSession?.activeRole !== "system") {
    return res.status(403).json({ message: "SYSTEM_ROLE_REQUIRED" });
  }
  if (!hasPermission(req.workbenchSession.permissionsSnapshot, "system:module-registry:read")) {
    return res.status(403).json({ message: "SYSTEM_MODULE_REGISTRY_PERMISSION_REQUIRED" });
  }
  return next();
};

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

  app.get("/api/system/module-registry", requireSession, requireRole("system"), requireSystemRegistryRead, (_req, res) => {
    res.json({
      items: listModuleRegistry(),
      visibility: "system-governed",
    });
  });

  app.get("/api/system/module-registry/:id", requireSession, requireRole("system"), requireSystemRegistryRead, (req, res) => {
    const item = readModuleRegistryItem(firstParam(req.params.id));
    if (!item) return res.status(404).json({ message: "Module not found" });
    return res.json(item);
  });

  app.get("/api/system/module-registry-role/:role", requireSession, requireRole("system"), requireSystemRegistryRead, (req, res) => {
    const role = firstParam(req.params.role);
    if (!isAppRole(role)) {
      return res.status(400).json({ message: "Invalid role", allowedRoles: appRoles });
    }
    return res.json(listModulesForRole(role));
  });
};
