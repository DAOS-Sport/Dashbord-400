import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import { healthOk } from "../../shared/observability/health";
import { storage } from "../../storage";

const readInternalToken = (req: Request) => {
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const internal = req.headers["x-internal-token"];
  const apiKey = req.headers["x-api-key"];
  return bearer || (Array.isArray(internal) ? internal[0] : internal) || (Array.isArray(apiKey) ? apiKey[0] : apiKey) || "";
};

const watchdogEventSchema = z.object({
  source: z.string().min(1).default("external-watchdog"),
  serviceName: z.string().min(1),
  status: z.enum(["ok", "degraded", "down", "unknown"]),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  message: z.string().optional(),
  payload: z.unknown().optional(),
  observedAt: z.string().optional(),
});

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

  app.get("/api/bff/system/watchdog-events", async (_req, res) => {
    return res.json({ items: await storage.listWatchdogEvents(50) });
  });

  app.get("/api/bff/system/schedule-snapshot", async (req, res) => {
    const facilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : req.workbenchSession?.activeFacility || "xinbei_pool";
    const from = typeof req.query.from === "string" ? req.query.from : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const to = typeof req.query.to === "string" ? req.query.to : from;
    const result = await container.integrations.schedule.getScheduleSnapshot({ facilityKey, from, to });
    if (!result.data) return res.status(502).json({ message: result.meta.fallbackReason, meta: result.meta });
    return res.json(result.data);
  });

  app.post("/api/watchdog/events", async (req, res) => {
    if (!container.config.internalApiToken) return res.status(503).json({ message: "INTERNAL_API_TOKEN is not configured" });
    const token = readInternalToken(req);
    if (!token) return res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" });
    if (token !== container.config.internalApiToken) return res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" });
    const parsed = watchdogEventSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const created = await storage.createWatchdogEvent({
      ...parsed.data,
      message: parsed.data.message ?? null,
      payload: parsed.data.payload === undefined || parsed.data.payload === null || typeof parsed.data.payload !== "object"
        ? null
        : parsed.data.payload as Record<string, unknown>,
      observedAt: parsed.data.observedAt ? new Date(parsed.data.observedAt) : new Date(),
    });
    return res.status(201).json(created);
  });
};
