import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { ModuleHealthDto } from "@shared/modules";
import {
  getModuleDescriptorById,
  getModuleDescriptorsByRole,
  getModuleHealth,
} from "@shared/modules";
import { announcementWhitelist } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { healthOk } from "../../shared/observability/health";
import { storage } from "../../storage";
import { requireRole, requireSession } from "../auth/context";
import { buildInsightsOverview, buildModuleInsights } from "./insights-service";
import { registerCautionPermissionRoutes } from "./caution-permissions-routes";
import { registerHelperStatusRoutes } from "./helper-status-routes";
import { registerLineBotRoutes } from "./line-bot-routes";
import { registerLinebotManagementRoutes } from "./linebot-management-routes";
import { registerLineWhitelistRoutes } from "./line-whitelist-routes";
import { registerSystemOperationsRoutes } from "./operations-routes";

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

const periodSchema = z.enum(["7d", "30d"]).default("7d");

const parsePeriodDays = (value: unknown) => {
  const parsed = periodSchema.safeParse(value);
  return parsed.success && parsed.data === "30d" ? 30 : 7;
};

const payloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const operationActionSet = new Set(["OPS_RESET_SESSION", "OPS_REFRESH_CACHE", "OPS_RESEND_NOTIFICATION"]);

const adapterOverview = (name: string, mode: string, configuredInMode: boolean) => {
  const mockInRealMode = containerModeIsReal() && mode === "mock";
  return {
    name,
    mode,
    configured: mockInRealMode ? false : configuredInMode,
    status: mockInRealMode ? "degraded" : configuredInMode ? "ready" : "not_connected",
    reason: mockInRealMode ? "adapter_is_mock_in_real_mode" : undefined,
  };
};

const containerModeIsReal = () => process.env.DATA_SOURCE_MODE === "real";

export const registerSystemRoutes = (app: Express, container: AppContainer) => {
  registerCautionPermissionRoutes(app, container);
  registerHelperStatusRoutes(app);
  registerLineBotRoutes(app, container);
  registerLinebotManagementRoutes(app, container);
  registerLineWhitelistRoutes(app, container);
  registerSystemOperationsRoutes(app, container);

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
    const pendingAssistsLast24h = auditLogs.filter((item) =>
      item.action.startsWith("OPS_ASSIST_") &&
      (item.resultStatus === "pending" || payloadRecord(item.payload).result === "pending") &&
      isRecent(item.timestamp, last24h),
    ).length;
    const handledSinceToday = todayStart();
    const completedAssistsToday = auditLogs.filter((item) => {
      const time = new Date(item.timestamp).getTime();
      return operationActionSet.has(item.action) && item.resultStatus === "success" && Number.isFinite(time) && time >= handledSinceToday;
    }).length;
    const insightsOverview = await safeRead(() => buildInsightsOverview(container, 7), undefined);
    const insightAnomaly = insightsOverview?.anomalies[0];
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
          severity: pendingAssistsLast24h > 5 ? "warning" as const : "normal" as const,
          pendingCount: pendingAssistsLast24h,
          todayHandledCount: completedAssistsToday,
        },
        insights: {
          severity: insightAnomaly ? "warning" as const : "normal" as const,
          anomalyHint: insightAnomaly
            ? `${insightAnomaly.label} 使用次數${insightAnomaly.type === "drop" ? "下降" : "上升"} ${Math.abs(insightAnomaly.deltaPct)}%`
            : null,
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

  app.get("/api/bff/system/health-overview", requireSession, requireRole("system"), (_req, res) => {
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
            : "NEON_DATABASE_URL/DATABASE_URL is not configured; mock profile only",
        },
      ],
    });
  });

  app.get("/api/bff/system/integration-overview", requireSession, requireRole("system"), (_req, res) => {
    return res.json({
      checkedAt: new Date().toISOString(),
      adapters: [
        adapterOverview("replit-data", container.config.replitDataAdapterMode, container.config.replitDataAdapterMode === "mock" || Boolean(container.config.lineBotBaseUrl && container.config.lineBotInternalToken)),
        adapterOverview("ragic-auth", container.config.ragicAdapterMode, container.config.ragicAdapterMode === "mock" || Boolean(container.config.ragicApiKey)),
        adapterOverview("schedule", container.config.scheduleAdapterMode, container.config.scheduleAdapterMode === "mock" || Boolean(container.config.smartScheduleBaseUrl && container.config.smartScheduleApiToken)),
        adapterOverview("booking", container.config.bookingAdapterMode, container.config.bookingAdapterMode === "mock"),
        adapterOverview("storage", container.config.storageAdapterMode, true),
        adapterOverview("redis", container.config.redisUrl ? "real" : "mock", Boolean(container.config.redisUrl)),
      ],
    });
  });

  app.get("/api/bff/system/watchdog-events", requireSession, requireRole("system"), async (_req, res) => {
    return res.json({ items: await storage.listWatchdogEvents(50) });
  });

  app.get("/api/bff/system/insights/overview", requireSession, requireRole("system"), async (req, res) => {
    const periodDays = parsePeriodDays(req.query.period);
    return res.json(await buildInsightsOverview(container, periodDays));
  });

  app.get("/api/bff/system/insights/module/:moduleId", requireSession, requireRole("system"), async (req, res) => {
    const moduleId = routeParam(req.params.moduleId);
    const module = getModuleDescriptorById(moduleId);
    if (!module) return res.status(404).json({ message: "MODULE_NOT_FOUND" });
    const periodDays = parsePeriodDays(req.query.period);
    return res.json(await buildModuleInsights(container, moduleId, periodDays));
  });

  app.get("/api/bff/system/schedule-snapshot", requireSession, requireRole("system"), async (req, res) => {
    const facilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : req.workbenchSession?.activeFacility || "xinbei_pool";
    const from = typeof req.query.from === "string" ? req.query.from : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const to = typeof req.query.to === "string" ? req.query.to : from;
    const result = await container.integrations.schedule.getScheduleSnapshot({ facilityKey, from, to });
    if (!result.data) return res.status(502).json({ message: result.meta.fallbackReason, meta: result.meta });
    return res.json(result.data);
  });

  const requireInternalToken = (req: Parameters<typeof readInternalToken>[0], res: import("express").Response): boolean => {
    if (!container.config.internalApiToken) { res.status(503).json({ message: "INTERNAL_API_TOKEN not configured" }); return false; }
    const tok = readInternalToken(req);
    if (!tok) { res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" }); return false; }
    if (tok !== container.config.internalApiToken) { res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" }); return false; }
    return true;
  };

  const awSchema = z.object({
    userId: z.string().min(1).max(200),
    userName: z.string().min(1).max(200),
    role: z.string().max(100).nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
  });
  const awPatchSchema = awSchema.partial().required({ userId: true });

  app.get("/api/internal/announcement-whitelist", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    const rows = await db.select().from(announcementWhitelist).orderBy(desc(announcementWhitelist.createdAt));
    return res.json({ items: rows, total: rows.length });
  });

  app.post("/api/internal/announcement-whitelist", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    const parsed = awSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const { userId, userName, role, note, isActive } = parsed.data;
    const [existing] = await db.select().from(announcementWhitelist).where(eq(announcementWhitelist.userId, userId)).limit(1);
    if (existing) return res.status(409).json({ message: "USER_ALREADY_EXISTS", entry: existing });
    const [row] = await db.insert(announcementWhitelist).values({
      userId, userName, role: role ?? null, note: note ?? null, isActive: isActive ?? true,
    }).returning();
    return res.status(201).json(row);
  });

  app.patch("/api/internal/announcement-whitelist/:userId", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    const userId = req.params.userId?.trim();
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const parsed = awPatchSchema.omit({ userId: true }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const [existing] = await db.select().from(announcementWhitelist).where(eq(announcementWhitelist.userId, userId)).limit(1);
    if (!existing) return res.status(404).json({ message: "USER_NOT_FOUND" });
    const updates: Partial<typeof announcementWhitelist.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.userName !== undefined) updates.userName = parsed.data.userName;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role ?? null;
    if (parsed.data.note !== undefined) updates.note = parsed.data.note ?? null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    const [row] = await db.update(announcementWhitelist).set(updates).where(eq(announcementWhitelist.userId, userId)).returning();
    return res.json(row);
  });

  app.delete("/api/internal/announcement-whitelist/:userId", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    const userId = req.params.userId?.trim();
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const [existing] = await db.select().from(announcementWhitelist).where(eq(announcementWhitelist.userId, userId)).limit(1);
    if (!existing) return res.status(404).json({ message: "USER_NOT_FOUND" });
    await db.delete(announcementWhitelist).where(eq(announcementWhitelist.userId, userId));
    return res.json({ ok: true, deleted: existing });
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
