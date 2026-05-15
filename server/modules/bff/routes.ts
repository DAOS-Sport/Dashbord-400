import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { registerEmployeeBffRoutes } from "./employee-routes";
import { registerSupervisorBffRoutes } from "./supervisor-routes";
import { registerSystemBffRoutes } from "./system-routes";

export const registerBffRoutes = (app: Express, container: AppContainer) => {
  registerEmployeeBffRoutes(app, container);
  registerSupervisorBffRoutes(app, container);
  registerSystemBffRoutes(app, container);
};
