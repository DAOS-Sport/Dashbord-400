import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { healthOk } from "../../shared/observability/health";

export const registerSystemRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/bff/system/health-overview", (_req, res) => {
    return res.json({
      status: "ok",
      checkedAt: new Date().toISOString(),
      services: [
        healthOk("api", "Express API is running"),
        healthOk("bff", "BFF route registry is active"),
        healthOk("config", `DATA_SOURCE_MODE=${container.config.dataSourceMode}`),
        {
          name: "database",
          status: container.config.databaseUrl ? "ok" : "degraded",
          checkedAt: new Date().toISOString(),
          detail: container.config.databaseUrl
            ? `DATABASE_PROFILE=${container.config.databaseProfile}`
            : "DATABASE_URL is not configured; mock profile only",
        },
      ],
    });
  });

  app.get("/api/bff/system/integration-overview", (_req, res) => {
    return res.json({
      checkedAt: new Date().toISOString(),
      adapters: [
        {
          name: "replit-data",
          mode: container.config.replitDataAdapterMode,
          configured: container.config.replitDataAdapterMode === "mock" || Boolean(container.config.lineBotBaseUrl && container.config.lineBotInternalToken),
        },
        { name: "ragic-auth", mode: container.config.ragicAdapterMode, configured: container.config.ragicAdapterMode === "mock" || Boolean(container.config.ragicApiKey) },
        { name: "schedule", mode: container.config.scheduleAdapterMode, configured: container.config.scheduleAdapterMode === "mock" || Boolean(container.config.smartScheduleBaseUrl && container.config.smartScheduleApiToken) },
        { name: "booking", mode: container.config.bookingAdapterMode, configured: container.config.bookingAdapterMode === "mock" },
        { name: "storage", mode: container.config.storageAdapterMode, configured: true },
        { name: "redis", mode: container.config.redisUrl ? "real" : "mock", configured: Boolean(container.config.redisUrl) },
      ],
    });
  });
};
