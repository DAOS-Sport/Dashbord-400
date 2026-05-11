import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { ModuleHealthDto } from "@shared/modules";
import { getModuleDescriptorsByRole, getModuleHealth } from "@shared/modules";
import { getRawInspectorTarget, isRawInspectorPath } from "@shared/system/raw-inspector";
import { healthOk } from "../../shared/observability/health";
import { storage } from "../../storage";
import { requireRole, requireSession } from "../auth/context";

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

const rawInspectorQuerySchema = z.object({
  path: z.string().min(1),
});

const hasPermission = (permissions: string[] | undefined, permission: string) =>
  Boolean(permissions?.includes(permission) || permissions?.some((item) => item.startsWith("system:")));

type ControlCenterSeverity = "normal" | "warning" | "critical";

interface ControlCenterCache {
  expiresAt: number;
  data: unknown;
}

let controlCenterCache: ControlCenterCache | null = null;

const isRecent = (value: unknown, windowMs: number) => {
  if (!value) return false;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) && Date.now() - time <= windowMs;
};

const sortHealth = (items: ModuleHealthDto[]) => {
  const rank: Record<ModuleHealthDto["status"], number> = {
    error: 0,
    degraded: 1,
    not_connected: 2,
    telemetry_pending: 3,
    ready: 4,
  };
  return [...items].sort((a, b) => rank[a.status] - rank[b.status] || a.moduleId.localeCompare(b.moduleId));
};

const safeRead = async <T>(reader: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await reader();
  } catch {
    return fallback;
  }
};

const eventCreatedAt = (event: { observedAt?: Date | string; createdAt?: Date | string }) =>
  (event.observedAt ?? event.createdAt ?? new Date()).toString();

const severityFromWatchdogs = (events: Array<{ severity: string }>): ControlCenterSeverity => {
  if (events.some((event) => event.severity === "critical")) return "critical";
  if (events.some((event) => event.severity === "warning")) return "warning";
  return "normal";
};

export const registerSystemRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/bff/system/control-center", requireSession, requireRole("system"), async (_req, res) => {
    if (controlCenterCache && controlCenterCache.expiresAt > Date.now()) {
      return res.json(controlCenterCache.data);
    }

    const health = sortHealth(getModuleHealth("system"));
    const descriptors = getModuleDescriptorsByRole("system");
    const watchdogEvents = await safeRead(() => storage.listWatchdogEvents(200), []);
    const auditLogs = await safeRead(() => container.repositories.telemetry.listAuditLogs(200), []);
    const last24h = 24 * 60 * 60 * 1000;
    const recentWatchdogs = watchdogEvents.filter((event) => isRecent(eventCreatedAt(event), last24h));
    const criticalWatchdogs = recentWatchdogs.filter((event) => event.severity === "critical");
    const warningOrCriticalWatchdogs = recentWatchdogs.filter((event) => event.severity === "critical" || event.severity === "warning");
    const orphanHealth = health.filter((item) =>
      item.issues.some((issue) => /no routePath|no BFF endpoint/i.test(issue)),
    );
    const recentCriticalEvents = warningOrCriticalWatchdogs
      .slice(0, 5)
      .map((event) => {
        const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {};
        return {
          id: String(event.id),
          title: event.message || event.serviceName || "Watchdog event",
          severity: event.severity,
          source: event.source,
          moduleId: typeof payload.moduleId === "string" ? payload.moduleId : undefined,
          role: typeof payload.role === "string" ? payload.role : undefined,
          createdAt: new Date(eventCreatedAt(event)).toISOString(),
        };
      });
    const latestWatchdog = warningOrCriticalWatchdogs[0] ?? watchdogEvents[0];

    const data = {
      kpi: {
        readyModules: health.filter((item) => item.status === "ready").length,
        degradedModules: health.filter((item) => item.status === "degraded" || item.status === "telemetry_pending").length,
        notConnectedModules: health.filter((item) => item.status === "not_connected").length,
        errorModules: health.filter((item) => item.status === "error").length,
        audit24h: auditLogs.filter((item) => isRecent(item.timestamp, last24h)).length,
        watchdogCritical24h: criticalWatchdogs.length,
      },
      tiles: {
        watchdog: {
          severity: severityFromWatchdogs(recentWatchdogs),
          criticalCount: criticalWatchdogs.length,
          lastEventTitle: latestWatchdog?.message || latestWatchdog?.serviceName || null,
          lastEventAt: latestWatchdog ? new Date(eventCreatedAt(latestWatchdog)).toISOString() : null,
        },
        operations: {
          severity: "normal" as const,
          pendingCount: 0,
          todayHandledCount: 0,
        },
        insights: {
          severity: "normal" as const,
          anomalyHint: null,
        },
        governance: {
          severity: orphanHealth.length > 0 ? "warning" as const : "normal" as const,
          moduleCount: descriptors.length,
          orphanCount: orphanHealth.length,
        },
      },
      recentCriticalEvents,
      generatedAt: new Date().toISOString(),
    };

    controlCenterCache = { expiresAt: Date.now() + 5_000, data };
    return res.json(data);
  });

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

  app.post("/api/bff/system/raw-inspector", requireSession, requireRole("system"), async (req, res) => {
    if (!hasPermission(req.workbenchSession?.permissionsSnapshot, "system:raw-inspector:query")) {
      return res.status(403).json({ message: "SYSTEM_RAW_INSPECTOR_PERMISSION_REQUIRED" });
    }

    const parsed = rawInspectorQuerySchema.safeParse(req.body || {});
    if (!parsed.success || !isRawInspectorPath(parsed.data.path)) {
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: "RAW_INSPECTOR_QUERY_BLOCKED",
        resource: "system.raw-inspector",
        payload: { path: parsed.success ? parsed.data.path : undefined, reason: "not_whitelisted" },
        resultStatus: "failure",
      });
      return res.status(400).json({ message: "RAW_INSPECTOR_TARGET_NOT_ALLOWED" });
    }

    const target = getRawInspectorTarget(parsed.data.path)!;
    const host = req.get("host");
    if (!host) return res.status(400).json({ message: "HOST_REQUIRED" });

    const url = new URL(target.path, `${req.protocol}://${host}`);
    const queriedAt = new Date().toISOString();
    try {
      const upstream = await fetch(url, {
        headers: {
          Accept: "application/json",
          Cookie: req.headers.cookie ?? "",
          "x-correlation-id": `${req.workbenchSession?.userId ?? "system"}-${Date.now()}`,
        },
      });
      const text = await upstream.text();
      const data = text ? JSON.parse(text) : null;
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: "RAW_INSPECTOR_QUERY",
        resource: "system.raw-inspector",
        resourceId: target.path,
        payload: { label: target.label, status: upstream.status },
        resultStatus: upstream.ok ? "success" : "failure",
      });
      return res.status(upstream.ok ? 200 : 502).json({
        path: target.path,
        label: target.label,
        queriedAt,
        status: upstream.status,
        data,
      });
    } catch (error) {
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: "RAW_INSPECTOR_QUERY",
        resource: "system.raw-inspector",
        resourceId: target.path,
        payload: { label: target.label, error: error instanceof Error ? error.message : String(error) },
        resultStatus: "failure",
      });
      return res.status(502).json({ message: "RAW_INSPECTOR_QUERY_FAILED" });
    }
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
