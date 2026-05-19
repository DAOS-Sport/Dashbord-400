import type { AppContainer } from "../app/container";
import type { BackendModule } from "./_shared/module";
import { announcementsModule } from "./announcements";
import { anomaliesModule } from "./anomalies";
import { authModule } from "./auth";
import { bffModule } from "./bff";
import { dashboardModule } from "./dashboard";
import { integrationsModule } from "./integrations";
import { portalModule } from "./portal";
import { registryModule } from "./registry";
import { schedulesModule } from "./schedules";
import { systemModule } from "./system";
import { telemetryModule } from "./telemetry";
import { usersModule } from "./users";

export const backendModules: BackendModule[] = [
  authModule,
  usersModule,
  portalModule,
  announcementsModule,
  anomaliesModule,
  schedulesModule,
  dashboardModule,
  telemetryModule,
  systemModule,
  registryModule,
  integrationsModule,
  bffModule,
];

export const registerBackendModules = (container: AppContainer) => {
  for (const module of backendModules) {
    module.register?.(container);
  }

  return backendModules;
};
