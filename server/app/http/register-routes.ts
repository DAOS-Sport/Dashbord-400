import type { Express } from "express";
import type { Server } from "http";
import { createAppContainer } from "../container";
import { registerAuthRoutes } from "../../modules/auth/routes";
import { registerAnnouncementRoutes } from "../../modules/announcements";
import { registerBffRoutes } from "../../modules/bff/routes";
import { registerBackendModules } from "../../modules/register";
import { registerSystemRoutes } from "../../modules/system/routes";
import { registerTelemetryRoutes } from "../../modules/telemetry/routes";
import { registerModuleRegistryRoutes } from "../../modules/registry/moduleRegistryController";
import { registerTaskRoutes } from "../../modules/tasks";

export const registerNewArchitectureRoutes = (_httpServer: Server, app: Express) => {
  const container = createAppContainer();
  registerBackendModules(container);
  registerAuthRoutes(app, container);
  registerAnnouncementRoutes(app, container);
  registerTelemetryRoutes(app, container);
  registerSystemRoutes(app, container);
  registerModuleRegistryRoutes(app);
  registerTaskRoutes(app, container);
  registerBffRoutes(app, container);
};
