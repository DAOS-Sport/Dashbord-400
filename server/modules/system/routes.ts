import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { ModuleHealthDto } from "@shared/modules";
import {
  calculateCompletionRate,
  calculateDeltaPct,
  classifyInsightAnomaly,
  getModuleDescriptorById,
  getModuleDescriptors,
  getModuleDescriptorsByRole,
  getModuleHealth,
  moduleCompletionEvents,
} from "@shared/modules";
import { getRawInspectorTarget, isRawInspectorPath } from "@shared/system/raw-inspector";
import type { WorkbenchRole } from "@shared/auth/me";
import { facilityLabel } from "@shared/domain/facilities";
import { sessionsIndex, userRoleSnapshots, users } from "@shared/schema";
import { and, desc, eq, gte, ilike, isNull, or } from "drizzle-orm";
import type { AuditLogRecord, StoredClientError, StoredUiEvent } from "../telemetry/repository";
import { db } from "../../db";
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

const opsReasonSchema = z.object({
  reason: z.string().trim().min(3),
});

const refreshCacheSchema = opsReasonSchema.extend({
  cacheKeys: z.array(z.string().trim().min(1)).optional(),
});

const resendNotificationSchema = opsReasonSchema.extend({
  notificationId: z.string().trim().min(1),
});

const periodSchema = z.enum(["7d", "30d"]).default("7d");

type SystemOperationUser = {
  userId: string;
  employeeNumber: string;
  name: string;
  email: string | null;
  role: WorkbenchRole;
  activeFacility: string | null;
  grantedRoles: WorkbenchRole[];
  grantedFacilities: string[];
  lastSeenAt: string | null;
  hasActiveSession: boolean;
};

type InsightsOverview = {
  period: { from: string; to: string; label: string };
  totalEvents: number;
  uniqueUsers: number;
  topModules: Array<{ moduleId: string; label: string; eventCount: number; uniqueUserCount: number; deltaPct: number }>;
  anomalies: Array<{ moduleId: string; label: string; type: "spike" | "drop"; deltaPct: number; currentCount: number; previousCount: number }>;
  byRole: Array<{ role: string; eventCount: number; uniqueUserCount: number }>;
  byFacility: Array<{ facilityKey: string; facilityName: string; eventCount: number }>;
};

type InsightsModuleDetail = {
  moduleId: string;
  label: string;
  current: { eventCount: number; uniqueUserCount: number; completionRate?: number };
  previous: { eventCount: number; uniqueUserCount: number; completionRate?: number };
  delta: { eventCountPct: number; uniqueUserCountPct: number; completionRatePct?: number };
  dailyBreakdown: Array<{ date: string; eventCount: number; uniqueUserCount: number }>;
  topUsers: Array<{ userId: string; name: string; eventCount: number }>;
  topFacilities: Array<{ facilityKey: string; facilityName: string; eventCount: number }>;
};

interface InsightsCacheEntry<T> {
  expiresAt: number;
  data: T;
}

const insightsCache = new Map<string, InsightsCacheEntry<unknown>>();

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const parsePeriodDays = (value: unknown) => {
  const parsed = periodSchema.safeParse(value);
  return parsed.success && parsed.data === "30d" ? 30 : 7;
};

const eventTime = (event: StoredUiEvent | AuditLogRecord) =>
  new Date((event as StoredUiEvent).occurredAt ?? (event as AuditLogRecord).timestamp).getTime();

const inRange = (time: number, from: number, to: number) => Number.isFinite(time) && time >= from && time < to;

const payloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const moduleIdFromRoute = (path?: string) => {
  if (!path) return undefined;
  const clean = path.split("?")[0];
  const exact = getModuleDescriptors().find((module) => module.routePath === clean);
  if (exact) return exact.id;
  const byPrefix = getModuleDescriptors()
    .filter((module) => module.routePath && clean.startsWith(`${module.routePath}/`))
    .sort((a, b) => (b.routePath?.length ?? 0) - (a.routePath?.length ?? 0))[0];
  return byPrefix?.id;
};

const moduleIdFromUiEvent = (event: StoredUiEvent) => {
  const payload = payloadRecord(event.payload);
  const explicit = firstText(payload.moduleId, payload.module, payload.moduleKey);
  if (explicit) return explicit;
  const navEvent = firstText(event.actionType, event.eventType);
  if (navEvent?.startsWith("NAV_CLICK:")) return navEvent.slice("NAV_CLICK:".length);
  return moduleIdFromRoute(event.componentId) ?? moduleIdFromRoute(event.page);
};

const groupCount = <T>(items: T[], keyOf: (item: T) => string | undefined) => {
  const map = new Map<string, { count: number; users: Set<string> }>();
  items.forEach((item) => {
    const key = keyOf(item);
    if (!key) return;
    const current = map.get(key) ?? { count: 0, users: new Set<string>() };
    current.count += 1;
    if ((item as { userId?: string }).userId) current.users.add((item as { userId?: string }).userId!);
    map.set(key, current);
  });
  return map;
};

const moduleLabel = (moduleId: string) => getModuleDescriptorById(moduleId)?.shortName ?? getModuleDescriptorById(moduleId)?.name ?? moduleId;

const isStartEventForModule = (event: StoredUiEvent, moduleId: string) => {
  const binding = moduleCompletionEvents[moduleId];
  if (!binding) return false;
  const expected = binding.startEvent.split(":");
  const action = firstText(event.actionType, event.eventType);
  if (action === binding.startEvent) return true;
  if (expected.length === 2 && action === expected[0] && moduleIdFromUiEvent(event) === expected[1]) return true;
  return action === "CARD_CLICK" && moduleIdFromUiEvent(event) === moduleId;
};

const isCompletionAuditForModule = (audit: AuditLogRecord, moduleId: string) => {
  const binding = moduleCompletionEvents[moduleId];
  return Boolean(binding && audit.action === binding.completionEvent);
};

const buildInsightsOverview = async (container: AppContainer, periodDays: number): Promise<InsightsOverview> => {
  const key = `overview:${periodDays}`;
  const cached = insightsCache.get(key) as InsightsCacheEntry<InsightsOverview> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const now = Date.now();
  const windowMs = periodDays * 24 * 60 * 60 * 1000;
  const currentFrom = now - windowMs;
  const previousFrom = currentFrom - windowMs;
  const uiEvents = await safeRead(() => container.repositories.telemetry.listUiEvents(2000), []);

  const currentEvents = uiEvents.filter((event) => inRange(eventTime(event), currentFrom, now));
  const previousEvents = uiEvents.filter((event) => inRange(eventTime(event), previousFrom, currentFrom));
  const currentByModule = groupCount(currentEvents, moduleIdFromUiEvent);
  const previousByModule = groupCount(previousEvents, moduleIdFromUiEvent);

  const topModules = Array.from(currentByModule.entries())
    .map(([moduleId, value]) => {
      const previous = previousByModule.get(moduleId)?.count ?? 0;
      return {
        moduleId,
        label: moduleLabel(moduleId),
        eventCount: value.count,
        uniqueUserCount: value.users.size,
        deltaPct: calculateDeltaPct(value.count, previous),
      };
    })
    .sort((a, b) => b.eventCount - a.eventCount || a.moduleId.localeCompare(b.moduleId))
    .slice(0, 10);

  const anomalies = Array.from(new Set([...Array.from(currentByModule.keys()), ...Array.from(previousByModule.keys())]))
    .map((moduleId) => {
      const currentCount = currentByModule.get(moduleId)?.count ?? 0;
      const previousCount = previousByModule.get(moduleId)?.count ?? 0;
      const type = classifyInsightAnomaly(currentCount, previousCount);
      if (!type) return null;
      return {
        moduleId,
        label: moduleLabel(moduleId),
        type,
        deltaPct: calculateDeltaPct(currentCount, previousCount),
        currentCount,
        previousCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  const byRole = Array.from(groupCount(currentEvents, (event) => event.role ?? "unknown").entries())
    .map(([role, value]) => ({ role, eventCount: value.count, uniqueUserCount: value.users.size }))
    .sort((a, b) => b.eventCount - a.eventCount);

  const byFacility = Array.from(groupCount(currentEvents, (event) => event.facilityKey ?? "unknown").entries())
    .map(([facilityKey, value]) => ({ facilityKey, facilityName: facilityKey === "unknown" ? "未知場館" : facilityLabel(facilityKey), eventCount: value.count }))
    .sort((a, b) => b.eventCount - a.eventCount);

  const data = {
    period: {
      from: new Date(currentFrom).toISOString(),
      to: new Date(now).toISOString(),
      label: `近 ${periodDays} 天`,
    },
    totalEvents: currentEvents.length,
    uniqueUsers: new Set(currentEvents.map((event) => event.userId).filter(Boolean)).size,
    topModules,
    anomalies,
    byRole,
    byFacility,
  };
  insightsCache.set(key, { expiresAt: Date.now() + 5 * 60_000, data });
  return data;
};

const buildModuleInsights = async (
  container: AppContainer,
  moduleId: string,
  periodDays: number,
): Promise<InsightsModuleDetail> => {
  const key = `module:${moduleId}:${periodDays}`;
  const cached = insightsCache.get(key) as InsightsCacheEntry<InsightsModuleDetail> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const now = Date.now();
  const windowMs = periodDays * 24 * 60 * 60 * 1000;
  const currentFrom = now - windowMs;
  const previousFrom = currentFrom - windowMs;
  const [uiEvents, auditRows] = await Promise.all([
    safeRead(() => container.repositories.telemetry.listUiEvents(2000), []),
    safeRead(() => container.repositories.telemetry.listAuditLogs(1000), []),
  ]);
  const currentEvents = uiEvents.filter((event) => moduleIdFromUiEvent(event) === moduleId && inRange(eventTime(event), currentFrom, now));
  const previousEvents = uiEvents.filter((event) => moduleIdFromUiEvent(event) === moduleId && inRange(eventTime(event), previousFrom, currentFrom));
  const currentAudits = auditRows.filter((audit) => isCompletionAuditForModule(audit, moduleId) && inRange(eventTime(audit), currentFrom, now));
  const previousAudits = auditRows.filter((audit) => isCompletionAuditForModule(audit, moduleId) && inRange(eventTime(audit), previousFrom, currentFrom));
  const currentStarts = currentEvents.filter((event) => isStartEventForModule(event, moduleId)).length;
  const previousStarts = previousEvents.filter((event) => isStartEventForModule(event, moduleId)).length;
  const currentRate = calculateCompletionRate(currentStarts, currentAudits.length);
  const previousRate = calculateCompletionRate(previousStarts, previousAudits.length);

  const days = Array.from({ length: periodDays }, (_, index) => {
    const start = new Date(currentFrom + index * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const rows = currentEvents.filter((event) => inRange(eventTime(event), start.getTime(), end.getTime()));
    return {
      date: isoDate(start),
      eventCount: rows.length,
      uniqueUserCount: new Set(rows.map((event) => event.userId).filter(Boolean)).size,
    };
  });

  const byUser = Array.from(groupCount(currentEvents, (event) => event.userId ?? undefined).entries())
    .map(([userId, value]) => ({ userId, name: userId, eventCount: value.count }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 5);
  const byFacility = Array.from(groupCount(currentEvents, (event) => event.facilityKey ?? "unknown").entries())
    .map(([facilityKey, value]) => ({ facilityKey, facilityName: facilityKey === "unknown" ? "未知場館" : facilityLabel(facilityKey), eventCount: value.count }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 5);

  const data = {
    moduleId,
    label: moduleLabel(moduleId),
    current: {
      eventCount: currentEvents.length,
      uniqueUserCount: new Set(currentEvents.map((event) => event.userId).filter(Boolean)).size,
      completionRate: currentRate,
    },
    previous: {
      eventCount: previousEvents.length,
      uniqueUserCount: new Set(previousEvents.map((event) => event.userId).filter(Boolean)).size,
      completionRate: previousRate,
    },
    delta: {
      eventCountPct: calculateDeltaPct(currentEvents.length, previousEvents.length),
      uniqueUserCountPct: calculateDeltaPct(
        new Set(currentEvents.map((event) => event.userId).filter(Boolean)).size,
        new Set(previousEvents.map((event) => event.userId).filter(Boolean)).size,
      ),
      completionRatePct: currentRate !== undefined && previousRate !== undefined ? calculateDeltaPct(currentRate, previousRate) : undefined,
    },
    dailyBreakdown: days,
    topUsers: byUser,
    topFacilities: byFacility,
  };
  insightsCache.set(key, { expiresAt: Date.now() + 5 * 60_000, data });
  return data;
};

const latestRoleSnapshot = async (userId: string) => {
  const [row] = await db
    .select()
    .from(userRoleSnapshots)
    .where(eq(userRoleSnapshots.userId, userId))
    .orderBy(desc(userRoleSnapshots.capturedAt))
    .limit(1);
  return row;
};

const activeSessionsForUser = async (userId: string) =>
  db
    .select()
    .from(sessionsIndex)
    .where(and(eq(sessionsIndex.userId, userId), isNull(sessionsIndex.revokedAt), gte(sessionsIndex.expiresAt, new Date())))
    .orderBy(desc(sessionsIndex.lastActive))
    .limit(20);

const toWorkbenchRoles = (roles: string[] | null | undefined): WorkbenchRole[] => {
  const allowed = new Set<WorkbenchRole>(["employee", "lifeguard", "supervisor", "system"]);
  const normalized = (roles ?? []).filter((role): role is WorkbenchRole => allowed.has(role as WorkbenchRole));
  return normalized.length ? normalized : ["employee"];
};

const operationUserFromRows = async (user: { id: string; username: string }): Promise<SystemOperationUser> => {
  const [snapshot, sessions] = await Promise.all([
    safeRead(() => latestRoleSnapshot(user.id), undefined),
    safeRead(() => activeSessionsForUser(user.id), []),
  ]);
  const role = (sessions[0]?.activeRole as WorkbenchRole | undefined) ?? toWorkbenchRoles(snapshot?.grantedRoles)[0] ?? "employee";
  return {
    userId: user.id,
    employeeNumber: user.username,
    name: user.username,
    email: user.username.includes("@") ? user.username : null,
    role,
    activeFacility: sessions[0]?.activeFacility ?? snapshot?.grantedFacilities?.[0] ?? null,
    grantedRoles: toWorkbenchRoles(snapshot?.grantedRoles),
    grantedFacilities: snapshot?.grantedFacilities ?? [],
    lastSeenAt: sessions[0]?.lastActive ? new Date(sessions[0].lastActive).toISOString() : null,
    hasActiveSession: sessions.length > 0,
  };
};

const searchOperationUsers = async (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const like = `%${trimmed}%`;
  const rows = await db
    .select()
    .from(users)
    .where(or(ilike(users.username, like), ilike(users.id, like)))
    .orderBy(users.username)
    .limit(10);
  return Promise.all(rows.map(operationUserFromRows));
};

const getOperationUser = async (userId: string) => {
  const user = await storage.getUser(userId).catch(() => undefined);
  return user ? operationUserFromRows(user) : undefined;
};

const isSystemTarget = (user: SystemOperationUser) =>
  user.role === "system" || user.grantedRoles.includes("system");

const readTargetUserId = (audit: AuditLogRecord) => {
  const payload = payloadRecord(audit.payload);
  return firstText(payload.targetUserId, (payload.target as Record<string, unknown> | undefined)?.["userId"]);
};

const recordOpsAudit = async (
  container: AppContainer,
  req: Request,
  input: {
    action: string;
    target: SystemOperationUser;
    reason: string;
    result: "pending" | "success" | "partial" | "failed";
    details?: Record<string, unknown>;
  },
) => {
  await container.repositories.telemetry.recordAudit({
    actorId: req.workbenchSession?.userId,
    role: req.workbenchSession?.activeRole,
    facilityKey: req.workbenchSession?.activeFacility,
    action: input.action,
    resource: "system.operations",
    resourceId: input.target.userId,
    payload: {
      targetUserId: input.target.userId,
      targetUserName: input.target.name,
      targetUserRole: input.target.role,
      reason: input.reason,
      performedBy: {
        userId: req.workbenchSession?.userId,
        name: req.workbenchSession?.displayName,
        role: req.workbenchSession?.activeRole,
      },
      result: input.result,
      details: input.details ?? {},
    },
    resultStatus: input.result === "success" ? "success" : input.result === "pending" ? "pending" : "failure",
  });
};

const compactAudit = (audit: AuditLogRecord) => ({
  action: audit.action,
  resource: audit.resource,
  payload: audit.payload,
  createdAt: audit.timestamp,
});

const compactClientError = (error: StoredClientError) => ({
  message: error.message,
  page: error.page,
  componentId: error.componentId,
  createdAt: error.receivedAt,
});

const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const operationActionSet = new Set(["OPS_RESET_SESSION", "OPS_REFRESH_CACHE", "OPS_RESEND_NOTIFICATION"]);

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

  app.get("/api/bff/system/operations/user-search", requireSession, requireRole("system"), async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const items = await safeRead(() => searchOperationUsers(query), []);
    return res.json({ items });
  });

  app.get("/api/bff/system/operations/user/:userId", requireSession, requireRole("system"), async (req, res) => {
    const userId = routeParam(req.params.userId);
    const user = await getOperationUser(userId);
    if (!user) return res.status(404).json({ message: "USER_NOT_FOUND" });

    const [auditRows, clientErrors] = await Promise.all([
      safeRead(() => container.repositories.telemetry.listAuditLogs(500), []),
      safeRead(() => container.repositories.telemetry.listClientErrors(200), []),
    ]);
    const sessions = await safeRead(() => activeSessionsForUser(user.userId), []);
    const activeRole = user.role;
    const visibleModules = getModuleDescriptorsByRole(activeRole)
      .filter((module) => module.routePath && module.navVisible)
      .map((module) => ({
        moduleId: module.id,
        label: module.shortName ?? module.name,
        route: module.routePath!,
        status: module.stage,
      }));

    return res.json({
      identity: {
        employeeNumber: user.employeeNumber,
        name: user.name,
        email: user.email,
        role: user.role,
        grantedRoles: user.grantedRoles,
        activeFacility: user.activeFacility,
        grantedFacilities: user.grantedFacilities,
      },
      session: {
        active: sessions.length > 0,
        sessionId: sessions[0]?.sessionIdHash ?? null,
        issuedAt: sessions[0]?.issuedAt ? new Date(sessions[0].issuedAt).toISOString() : null,
        lastSeenAt: sessions[0]?.lastActive ? new Date(sessions[0].lastActive).toISOString() : null,
        ip: null,
        userAgent: null,
      },
      recentAudit: auditRows
        .filter((audit) => audit.actorId === user.userId || readTargetUserId(audit) === user.userId)
        .slice(0, 50)
        .map(compactAudit),
      recentClientErrors: clientErrors
        .filter((error) => error.userId === user.userId)
        .slice(0, 20)
        .map(compactClientError),
      recentFailedNotifications: [],
      visibleModules,
    });
  });

  app.post("/api/bff/system/operations/user/:userId/reset-session", requireSession, requireRole("system"), async (req, res) => {
    const parsed = opsReasonSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "REASON_REQUIRED", errors: parsed.error.flatten() });
    const target = await getOperationUser(routeParam(req.params.userId));
    if (!target) return res.status(404).json({ message: "USER_NOT_FOUND" });
    if (isSystemTarget(target)) return res.status(403).json({ message: "SYSTEM_USER_INTERVENTION_FORBIDDEN" });

    await recordOpsAudit(container, req, {
      action: "OPS_ASSIST_RESET_SESSION",
      target,
      reason: parsed.data.reason,
      result: "pending",
    });

    try {
      const cleared = await safeRead(
        async () => db.delete(sessionsIndex).where(eq(sessionsIndex.userId, target.userId)).returning({ id: sessionsIndex.id }),
        [],
      );
      await recordOpsAudit(container, req, {
        action: "OPS_RESET_SESSION",
        target,
        reason: parsed.data.reason,
        result: "success",
        details: { sessionsCleared: cleared.length, source: "sessions_index" },
      });
      return res.json({ ok: true, sessionsCleared: cleared.length });
    } catch (error) {
      await recordOpsAudit(container, req, {
        action: "OPS_RESET_SESSION",
        target,
        reason: parsed.data.reason,
        result: "failed",
        details: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
      return res.status(500).json({ message: "RESET_SESSION_FAILED" });
    }
  });

  app.post("/api/bff/system/operations/user/:userId/refresh-cache", requireSession, requireRole("system"), async (req, res) => {
    const parsed = refreshCacheSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "REASON_REQUIRED", errors: parsed.error.flatten() });
    const target = await getOperationUser(routeParam(req.params.userId));
    if (!target) return res.status(404).json({ message: "USER_NOT_FOUND" });
    if (isSystemTarget(target)) return res.status(403).json({ message: "SYSTEM_USER_INTERVENTION_FORBIDDEN" });

    await recordOpsAudit(container, req, {
      action: "OPS_ASSIST_REFRESH_CACHE",
      target,
      reason: parsed.data.reason,
      result: "pending",
    });

    const keysCleared = parsed.data.cacheKeys?.length
      ? parsed.data.cacheKeys
      : [
          `employee-home:${target.userId}`,
          `facility-list:${target.userId}`,
          `module-visibility:${target.userId}`,
        ];
    await recordOpsAudit(container, req, {
      action: "OPS_REFRESH_CACHE",
      target,
      reason: parsed.data.reason,
      result: "success",
      details: { keysCleared, mode: "lightweight_invalidate_hook" },
    });
    return res.json({ ok: true, keysCleared });
  });

  app.post("/api/bff/system/operations/user/:userId/resend-notification", requireSession, requireRole("system"), async (req, res) => {
    const parsed = resendNotificationSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "REASON_AND_NOTIFICATION_REQUIRED", errors: parsed.error.flatten() });
    const target = await getOperationUser(routeParam(req.params.userId));
    if (!target) return res.status(404).json({ message: "USER_NOT_FOUND" });
    if (isSystemTarget(target)) return res.status(403).json({ message: "SYSTEM_USER_INTERVENTION_FORBIDDEN" });

    await recordOpsAudit(container, req, {
      action: "OPS_ASSIST_RESEND_NOTIFICATION",
      target,
      reason: parsed.data.reason,
      result: "pending",
      details: { notificationId: parsed.data.notificationId },
    });
    await recordOpsAudit(container, req, {
      action: "OPS_RESEND_NOTIFICATION",
      target,
      reason: parsed.data.reason,
      result: "failed",
      details: { notificationId: parsed.data.notificationId, errorMessage: "no_notification_system" },
    });
    return res.json({ ok: false, notificationStatus: "failed", errorMessage: "no_notification_system" });
  });

  app.get("/api/bff/system/operations/recent-assists", requireSession, requireRole("system"), async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
    const rows = await safeRead(() => container.repositories.telemetry.listAuditLogs(500), []);
    return res.json({
      items: rows
        .filter((row) => row.action.startsWith("OPS_"))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          action: row.action,
          resource: row.resource,
          payload: row.payload,
          resultStatus: row.resultStatus,
          createdAt: row.timestamp,
        })),
    });
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
