import type { Express, Request, Response } from "express";
import type { AppContainer } from "../../app/container";
import { env } from "../../shared/config/env";
import {
  getSystemOverviewFromSources,
  getSystemOverviewMock,
} from "./employee-home";

export const registerSystemBffRoutes = (
  app: Express,
  _container: AppContainer,
) => {
  const systemDashboardHandler = async (_req: Request, res: Response) => {
    return res.json(
      env.dataSourceMode === "mock"
        ? getSystemOverviewMock()
        : await getSystemOverviewFromSources(),
    );
  };

  app.get("/api/bff/system/overview", systemDashboardHandler);
  app.get("/api/bff/system/dashboard", systemDashboardHandler);
};
