import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { ModuleHealthDto } from "@shared/modules";
import {
  getModuleDescriptorById,
  getModuleDescriptorsByRole,
  getModuleHealth,
} from "@shared/modules";
import type { WorkbenchRole } from "@shared/auth/me";
import { LINE_FEATURES, normalizeLineFeatureAccess } from "@shared/system/line-feature-whitelist";
import { helperEndpoints, helperEnvGroups, helperExternalServices, helperResilienceRules } from "@shared/system/helper-status";
import { announcementWhitelist, cautionQueryPermissionAudit, cautionQueryPermissions, lineFeatureWhitelist, sessionsIndex, userRoleSnapshots, users } from "@shared/schema";
import { and, desc, eq, gte, ilike, isNull, or } from "drizzle-orm";
import type { AuditLogRecord, StoredClientError } from "../telemetry/repository";
import { db } from "../../db";
import { healthOk } from "../../shared/observability/health";
import { storage } from "../../storage";
import { requireRole, requireSession } from "../auth/context";
import { env } from "../../shared/config/env";
import { buildInsightsOverview, buildModuleInsights } from "./insights-service";
import { activeForFeature, isMissingCautionTable, isMissingWhitelistTable, lineWhitelistDto, listLineWhitelist, toNullableDate } from "./line-whitelist-service";

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

const lineFeatureAccessSchema = z.record(z.boolean()).transform((value) => normalizeLineFeatureAccess(value));

const lineWhitelistUpsertSchema = z.object({
  lineUserId: z.string().trim().min(1, "LINE userId 不可為空").max(120),
  employeeNumber: z.string().trim().max(80).optional().nullable(),
  displayName: z.string().trim().min(1, "姓名不可為空").max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  department: z.string().trim().max(160).optional().nullable(),
  status: z.enum(["active", "disabled"]).default("active"),
  featureAccess: lineFeatureAccessSchema.default({}),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
  unlimited: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const lineWhitelistPatchSchema = lineWhitelistUpsertSchema.partial().extend({
  featureAccess: lineFeatureAccessSchema.optional(),
});

const cautionPeriodTypeSchema = z.enum(["unlimited", "range", "today_only"]);

const cautionCreateSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  department: z.string().trim().max(160).optional().nullable(),
  position: z.string().trim().max(120).optional().nullable(),
  periodType: cautionPeriodTypeSchema.default("unlimited"),
  periodStartAt: z.string().trim().optional().nullable(),
  periodEndAt: z.string().trim().optional().nullable(),
  note: z.string().trim().max(200).optional().nullable(),
});

const cautionPeriodPatchSchema = z.object({
  periodType: cautionPeriodTypeSchema,
  periodStartAt: z.string().trim().optional().nullable(),
  periodEndAt: z.string().trim().optional().nullable(),
  changeReason: z.string().trim().min(5).max(300),
});

const cautionStatusPatchSchema = z.object({
  isActive: z.boolean(),
});

const cautionUsageSchema = z.object({
  triggeredBy: z.string().trim().min(1),
  queryTarget: z.string().trim().min(1).max(120),
  success: z.boolean().default(true),
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

const parsePeriodDays = (value: unknown) => {
  const parsed = periodSchema.safeParse(value);
  return parsed.success && parsed.data === "30d" ? 30 : 7;
};

const payloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

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

const isEnvConfigured = (key: string) => Boolean(process.env[key]?.trim());

const helperServiceStatus = () => {
  const services = helperExternalServices.map((service) => {
    const configuredKeys = service.credentialKeys.filter(isEnvConfigured);
    const configured = service.credentialKeys.length === 0 || configuredKeys.length === service.credentialKeys.length;
    return {
      ...service,
      configured,
      status: configured ? "ready" as const : "not_connected" as const,
      missingCredentialKeys: service.credentialKeys.filter((key) => !configuredKeys.includes(key)),
    };
  });
  const envGroups = helperEnvGroups.map((group) => ({
    ...group,
    variables: group.variables.map((variable) => ({
      ...variable,
      configured: isEnvConfigured(variable.name),
      status: isEnvConfigured(variable.name) || variable.defaultValue ? "ready" as const : variable.required ? "missing_required" as const : "not_connected" as const,
    })),
  }));
  const missingRequiredEnv = envGroups
    .flatMap((group) => group.variables)
    .filter((variable) => variable.required && !variable.configured)
    .map((variable) => variable.name);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      externalServices: services.length,
      readyServices: services.filter((service) => service.status === "ready").length,
      exposedEndpoints: helperEndpoints.length,
      missingRequiredEnv,
    },
    services,
    endpoints: helperEndpoints,
    envGroups,
    resilience: helperResilienceRules,
  };
};

const cautionPeriod = (periodType: z.infer<typeof cautionPeriodTypeSchema>, start?: string | null, end?: string | null) => {
  const now = new Date();
  if (periodType === "today_only") {
    return { startAt: now, endAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
  }
  if (periodType === "range") {
    return { startAt: toNullableDate(start) ?? now, endAt: toNullableDate(end) };
  }
  return { startAt: toNullableDate(start), endAt: null };
};

const cautionStatus = (row: typeof cautionQueryPermissions.$inferSelect, now = new Date()) => {
  if (!row.isActive) return "disabled" as const;
  if (row.permissionStartAt && row.permissionStartAt.getTime() > now.getTime()) return "not_yet_effective" as const;
  if (row.permissionEndAt && row.permissionEndAt.getTime() < now.getTime()) return "expired" as const;
  if (row.permissionEndAt && row.permissionEndAt.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) return "expiring_soon" as const;
  return "active" as const;
};

const cautionDto = (row: typeof cautionQueryPermissions.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  displayName: row.displayName,
  phone: row.phone,
  department: row.department,
  position: row.position,
  isActive: row.isActive,
  status: cautionStatus(row),
  permissionStartAt: row.permissionStartAt ? row.permissionStartAt.toISOString() : null,
  permissionEndAt: row.permissionEndAt ? row.permissionEndAt.toISOString() : null,
  grantedBy: row.grantedBy,
  grantedAt: row.grantedAt.toISOString(),
  note: row.note,
  updatedAt: row.updatedAt.toISOString(),
});

const cautionSnapshot = (row: typeof cautionQueryPermissions.$inferSelect) => cautionDto(row) as unknown as Record<string, unknown>;

const recordCautionAudit = async (
  input: {
    permissionId: number;
    action: "granted" | "enabled" | "disabled" | "period_changed" | "note_changed" | "used";
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    actor: string;
    metadata?: Record<string, unknown> | null;
  },
) => {
  await db.insert(cautionQueryPermissionAudit).values({
    permissionId: input.permissionId,
    action: input.action,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    actor: input.actor,
    metadata: input.metadata ?? null,
  });
};

const cautionCheck = (row: typeof cautionQueryPermissions.$inferSelect | undefined) => {
  if (!row) return { allowed: false, reason: "no_permission" as const };
  if (!row.isActive) return { allowed: false, reason: "disabled" as const, permissionId: row.id };
  const now = new Date();
  if (row.permissionStartAt && row.permissionStartAt > now) {
    return { allowed: false, reason: "not_yet_effective" as const, permissionId: row.id, startAt: row.permissionStartAt.toISOString() };
  }
  if (row.permissionEndAt && row.permissionEndAt < now) {
    return { allowed: false, reason: "expired" as const, permissionId: row.id, expiresAt: row.permissionEndAt.toISOString() };
  }
  return { allowed: true, permissionId: row.id, expiresAt: row.permissionEndAt ? row.permissionEndAt.toISOString() : null };
};

const lineBotAdminFetch = async (path: string, method: string, body?: unknown) => {
  const token = env.lineBotAdminToken;
  if (!token) return null;
  const response = await fetch(`${env.lineBotBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  return response;
};

const pushLineBotInterviewUser = async (
  row: typeof lineFeatureWhitelist.$inferSelect,
  mode: "create" | "update" | "delete",
) => {
  if (!env.lineBotAdminToken) return;
  const access = normalizeLineFeatureAccess(row.featureAccess);
  const shouldActivate = mode !== "delete" && row.status === "active" && Boolean(access["interview"]);
  const payload = {
    userId: row.lineUserId,
    displayName: row.displayName,
    employeeNumber: row.employeeNumber ?? undefined,
    department: row.department ?? undefined,
  };
  if (shouldActivate) {
    if (mode === "update") {
      const patchResp = await lineBotAdminFetch(`/api/admin/interview-users/${encodeURIComponent(row.lineUserId)}`, "PATCH", payload);
      if (patchResp?.status === 404) {
        const postResp = await lineBotAdminFetch("/api/admin/interview-users", "POST", payload);
        if (postResp && !postResp.ok) throw new Error(`HTTP ${postResp.status}`);
      } else if (patchResp && !patchResp.ok) {
        throw new Error(`HTTP ${patchResp.status}`);
      }
    } else {
      const resp = await lineBotAdminFetch("/api/admin/interview-users", "POST", payload);
      if (resp && !resp.ok) throw new Error(`HTTP ${resp.status}`);
    }
  } else {
    const resp = await lineBotAdminFetch(`/api/admin/interview-users/${encodeURIComponent(row.lineUserId)}`, "DELETE");
    if (resp && !resp.ok && resp.status !== 404) throw new Error(`HTTP ${resp.status}`);
  }
};

const pushLineBotVipEntry = async (
  row: typeof lineFeatureWhitelist.$inferSelect,
  mode: "create" | "update" | "delete",
) => {
  if (!env.lineBotAdminToken) return;
  const access = normalizeLineFeatureAccess(row.featureAccess);
  const shouldBeVip = mode !== "delete" && row.status === "active" && Boolean(access["vip-announcement"]);
  if (shouldBeVip) {
    if (mode === "update") {
      const listResp = await lineBotAdminFetch("/api/admin/whitelist", "GET");
      if (listResp?.ok) {
        const list = await listResp.json() as Array<{ id: string | number; userId?: string }>;
        const existing = list.find((e) => e.userId === row.lineUserId);
        if (existing?.id) {
          const patchResp = await lineBotAdminFetch(`/api/admin/whitelist/${encodeURIComponent(String(existing.id))}`, "PATCH", { displayName: row.displayName });
          if (patchResp && !patchResp.ok) throw new Error(`HTTP ${patchResp.status}`);
          return;
        }
      }
    }
    const resp = await lineBotAdminFetch("/api/admin/whitelist", "POST", {
      userId: row.lineUserId,
      displayName: row.displayName,
    });
    if (resp && !resp.ok) throw new Error(`HTTP ${resp.status}`);
  } else {
    const listResp = await lineBotAdminFetch("/api/admin/whitelist", "GET");
    if (!listResp?.ok) return;
    const list = await listResp.json() as Array<{ id: string | number; userId?: string }>;
    const entry = list.find((e) => e.userId === row.lineUserId);
    if (entry?.id) {
      const resp = await lineBotAdminFetch(`/api/admin/whitelist/${encodeURIComponent(String(entry.id))}`, "DELETE");
      if (resp && !resp.ok && resp.status !== 404) throw new Error(`HTTP ${resp.status}`);
    }
  }
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

  app.get("/api/bff/system/helper-status", requireSession, requireRole("system"), (_req, res) => {
    return res.json(helperServiceStatus());
  });

  app.get("/api/bff/system/line-whitelist", requireSession, requireRole("system"), async (_req, res) => {
    const result = await listLineWhitelist();
    return res.json({
      generatedAt: new Date().toISOString(),
      storageStatus: result.storageStatus,
      error: result.error,
      features: LINE_FEATURES,
      summary: {
        total: result.items.length,
        active: result.items.filter((item) => item.status === "active").length,
        disabled: result.items.filter((item) => item.status === "disabled").length,
        interviewEnabled: result.items.filter((item) => item.status === "active" && item.featureAccess.interview).length,
      },
      items: result.items,
    });
  });

  app.get("/api/bff/system/line-whitelist/candidates", requireSession, requireRole("system"), async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const result = await safeRead(
      () => container.integrations.ragicAuth.listActiveEmployees(),
      { data: null, meta: { source: "ragic-employees", status: "unavailable" as const, fallbackReason: "Ragic employees lookup failed" } },
    );
    if (result.data === null) {
      return res.status(503).json({
        message: "Ragic 員工資料暫時無法存取，請稍後再試",
        sourceStatus: result.meta,
        items: [],
      });
    }
    const employees = result.data
      .map((employee) => ({
        lineUserId: employee.lineUserId || employee.userId || employee.employeeNumber,
        employeeNumber: employee.employeeNumber,
        displayName: employee.displayName,
        phone: employee.phone ?? "",
        department: employee.department ?? employee.departments?.join(", ") ?? "",
        title: employee.title ?? "",
        source: result.meta.source,
      }))
      .filter((employee) => {
        if (!query) return true;
        const haystack = `${employee.lineUserId} ${employee.employeeNumber} ${employee.displayName} ${employee.phone} ${employee.department}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 30);
    return res.json({ items: employees, sourceStatus: result.meta });
  });

  app.post("/api/bff/system/line-whitelist/import-interview-users", requireSession, requireRole("system"), async (req, res) => {
    // 1. Fetch 8 interview users from LINE Bot
    let lineBotUsers: Array<{ userId: string; userName: string }> = [];
    try {
      const token = env.lineBotAdminToken;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const resp = await fetch(`${env.lineBotBaseUrl}/api/admin/interview-users`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const json = await resp.json() as { users?: Array<{ userId: string; userName: string }> };
        lineBotUsers = json.users ?? [];
      }
    } catch (_) { /* fallback to empty */ }
    if (lineBotUsers.length === 0) {
      return res.status(502).json({ message: "無法從 LINE Bot 取得面試名單，請確認 LINE Bot 服務狀態。" });
    }

    // 2. Fetch Ragic employees for enrichment
    const ragicResult = await safeRead(
      () => container.integrations.ragicAuth.listActiveEmployees(),
      { data: null, meta: { source: "ragic-employees", status: "unavailable" as const, fallbackReason: "Ragic unavailable" } },
    );
    const ragicEmployees = ragicResult.data ?? [];

    // 3. Match by name, upsert each
    const results: Array<{
      lineUserId: string; userName: string;
      ragicMatch: boolean; employeeNumber?: string; department?: string; phone?: string;
      action: "created" | "updated" | "error"; error?: string;
    }> = [];

    for (const lu of lineBotUsers) {
      const ragic = ragicEmployees.find((e) => e.displayName === lu.userName);
      const values = {
        lineUserId: lu.userId,
        displayName: lu.userName,
        employeeNumber: ragic?.employeeNumber || null,
        phone: ragic?.phone || null,
        department: ragic?.department || null,
        status: "active" as const,
        featureAccess: { interview: true } as Record<string, boolean>,
        unlimited: true,
        startsAt: null,
        endsAt: null,
        notes: null,
        source: "ragic" as const,
        createdBy: req.workbenchSession?.userId,
        createdByName: req.workbenchSession?.displayName,
        updatedBy: req.workbenchSession?.userId,
        updatedByName: req.workbenchSession?.displayName,
        updatedAt: new Date(),
      };
      try {
        const [existing] = await db.select().from(lineFeatureWhitelist)
          .where(eq(lineFeatureWhitelist.lineUserId, lu.userId)).limit(1);
        let row: typeof lineFeatureWhitelist.$inferSelect;
        if (existing) {
          // Merge featureAccess: keep existing features, add interview=true
          const merged = { ...(existing.featureAccess as Record<string, boolean> ?? {}), interview: true };
          [row] = await db.update(lineFeatureWhitelist)
            .set({ ...values, featureAccess: merged })
            .where(eq(lineFeatureWhitelist.id, existing.id)).returning();
        } else {
          [row] = await db.insert(lineFeatureWhitelist).values(values).returning();
        }
        // Fire-and-forget push to LINE Bot
        pushLineBotInterviewUser(row, existing ? "update" : "create").catch(() => {});
        results.push({ lineUserId: lu.userId, userName: lu.userName, ragicMatch: Boolean(ragic), employeeNumber: ragic?.employeeNumber, department: ragic?.department, phone: ragic?.phone, action: existing ? "updated" : "created" });
      } catch (err) {
        results.push({ lineUserId: lu.userId, userName: lu.userName, ragicMatch: Boolean(ragic), action: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }

    await container.repositories.telemetry.recordAudit({
      actorId: req.workbenchSession?.userId,
      role: req.workbenchSession?.activeRole,
      facilityKey: req.workbenchSession?.activeFacility,
      action: "LINE_WHITELIST_IMPORT_INTERVIEW",
      resource: "system.line-feature-whitelist",
      payload: { total: results.length, matched: results.filter((r) => r.ragicMatch).length },
      resultStatus: "success",
    }).catch(() => {});

    return res.json({
      total: results.length,
      matched: results.filter((r) => r.ragicMatch).length,
      unmatched: results.filter((r) => !r.ragicMatch).length,
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
      errors: results.filter((r) => r.action === "error").length,
      results,
    });
  });

  // Alias matching task spec contract — same handler as /api/bff/system/line-whitelist/candidates
  app.get("/api/system/whitelist/ragic-search", requireSession, requireRole("system"), async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const result = await safeRead(
      () => container.integrations.ragicAuth.listActiveEmployees(),
      { data: null, meta: { source: "ragic-employees", status: "unavailable" as const, fallbackReason: "Ragic employees lookup failed" } },
    );
    if (result.data === null) {
      return res.status(503).json({ message: "Ragic 員工資料暫時無法存取，請稍後再試", sourceStatus: result.meta, items: [] });
    }
    const employees = result.data
      .map((employee) => ({
        lineUserId: employee.lineUserId || employee.userId || employee.employeeNumber,
        employeeNumber: employee.employeeNumber,
        displayName: employee.displayName,
        phone: employee.phone ?? "",
        department: employee.department ?? employee.departments?.join(", ") ?? "",
        title: employee.title ?? "",
        source: result.meta.source,
      }))
      .filter((employee) => {
        if (!query) return true;
        const haystack = `${employee.lineUserId} ${employee.employeeNumber} ${employee.displayName} ${employee.phone} ${employee.department}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 30);
    return res.json({ items: employees, sourceStatus: result.meta });
  });

  app.post("/api/bff/system/line-whitelist", requireSession, requireRole("system"), async (req, res) => {
    const parsed = lineWhitelistUpsertSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const input = parsed.data;
    const values = {
      lineUserId: input.lineUserId,
      employeeNumber: input.employeeNumber || null,
      displayName: input.displayName,
      phone: input.phone || null,
      department: input.department || null,
      status: input.status,
      featureAccess: input.featureAccess,
      startsAt: toNullableDate(input.startsAt),
      endsAt: input.unlimited ? null : toNullableDate(input.endsAt),
      unlimited: input.unlimited,
      notes: input.notes || null,
      source: "ragic",
      createdBy: req.workbenchSession?.userId,
      createdByName: req.workbenchSession?.displayName,
      updatedBy: req.workbenchSession?.userId,
      updatedByName: req.workbenchSession?.displayName,
      updatedAt: new Date(),
    };
    try {
      const [existing] = await db
        .select()
        .from(lineFeatureWhitelist)
        .where(eq(lineFeatureWhitelist.lineUserId, input.lineUserId))
        .limit(1);
      const [row] = existing
        ? await db
            .update(lineFeatureWhitelist)
            .set(values)
            .where(eq(lineFeatureWhitelist.id, existing.id))
            .returning()
        : await db
            .insert(lineFeatureWhitelist)
            .values(values)
            .returning();
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: existing ? "LINE_WHITELIST_UPDATED" : "LINE_WHITELIST_CREATED",
        resource: "system.line-feature-whitelist",
        resourceId: String(row.id),
        payload: { lineUserId: row.lineUserId, displayName: row.displayName, featureAccess: row.featureAccess, status: row.status },
        resultStatus: "success",
      });
      const pushMode = existing ? "update" : "create";
      (async () => {
        try { await pushLineBotInterviewUser(row, pushMode); } catch (err) {
          await container.repositories.telemetry.recordAudit({ actorId: req.workbenchSession?.userId, role: req.workbenchSession?.activeRole, facilityKey: req.workbenchSession?.activeFacility, action: "LINE_BOT_INTERVIEW_PUSH_FAILED", resource: "system.line-bot-push", payload: { lineUserId: row.lineUserId, error: String(err) }, resultStatus: "failure" }).catch(() => {});
        }
        try { await pushLineBotVipEntry(row, pushMode); } catch (err) {
          await container.repositories.telemetry.recordAudit({ actorId: req.workbenchSession?.userId, role: req.workbenchSession?.activeRole, facilityKey: req.workbenchSession?.activeFacility, action: "LINE_BOT_VIP_PUSH_FAILED", resource: "system.line-bot-push", payload: { lineUserId: row.lineUserId, error: String(err) }, resultStatus: "failure" }).catch(() => {});
        }
      })();
      return res.status(existing ? 200 : 201).json(lineWhitelistDto(row));
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.patch("/api/bff/system/line-whitelist/:id", requireSession, requireRole("system"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    const parsed = lineWhitelistPatchSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const input = parsed.data;
    const updateValues: Partial<typeof lineFeatureWhitelist.$inferInsert> = {
      updatedBy: req.workbenchSession?.userId,
      updatedByName: req.workbenchSession?.displayName,
      updatedAt: new Date(),
    };
    if (input.lineUserId !== undefined) updateValues.lineUserId = input.lineUserId;
    if (input.employeeNumber !== undefined) updateValues.employeeNumber = input.employeeNumber || null;
    if (input.displayName !== undefined) updateValues.displayName = input.displayName;
    if (input.phone !== undefined) updateValues.phone = input.phone || null;
    if (input.department !== undefined) updateValues.department = input.department || null;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.featureAccess !== undefined) updateValues.featureAccess = input.featureAccess;
    if (input.startsAt !== undefined) updateValues.startsAt = toNullableDate(input.startsAt);
    if (input.unlimited !== undefined) updateValues.unlimited = input.unlimited;
    if (input.endsAt !== undefined || input.unlimited === true) updateValues.endsAt = input.unlimited ? null : toNullableDate(input.endsAt);
    if (input.notes !== undefined) updateValues.notes = input.notes || null;
    try {
      const [row] = await db
        .update(lineFeatureWhitelist)
        .set(updateValues)
        .where(eq(lineFeatureWhitelist.id, id))
        .returning();
      if (!row) return res.status(404).json({ message: "WHITELIST_ENTRY_NOT_FOUND" });
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: "LINE_WHITELIST_UPDATED",
        resource: "system.line-feature-whitelist",
        resourceId: String(row.id),
        payload: { lineUserId: row.lineUserId, displayName: row.displayName, featureAccess: row.featureAccess, status: row.status },
        resultStatus: "success",
      });
      (async () => {
        try { await pushLineBotInterviewUser(row, "update"); } catch (err) {
          await container.repositories.telemetry.recordAudit({ actorId: req.workbenchSession?.userId, role: req.workbenchSession?.activeRole, facilityKey: req.workbenchSession?.activeFacility, action: "LINE_BOT_INTERVIEW_PUSH_FAILED", resource: "system.line-bot-push", payload: { lineUserId: row.lineUserId, error: String(err) }, resultStatus: "failure" }).catch(() => {});
        }
        try { await pushLineBotVipEntry(row, "update"); } catch (err) {
          await container.repositories.telemetry.recordAudit({ actorId: req.workbenchSession?.userId, role: req.workbenchSession?.activeRole, facilityKey: req.workbenchSession?.activeFacility, action: "LINE_BOT_VIP_PUSH_FAILED", resource: "system.line-bot-push", payload: { lineUserId: row.lineUserId, error: String(err) }, resultStatus: "failure" }).catch(() => {});
        }
      })();
      return res.json(lineWhitelistDto(row));
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.delete("/api/bff/system/line-whitelist/:id", requireSession, requireRole("system"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    try {
      const [row] = await db.select().from(lineFeatureWhitelist).where(eq(lineFeatureWhitelist.id, id)).limit(1);
      if (!row) return res.status(404).json({ message: "WHITELIST_ENTRY_NOT_FOUND" });
      await db.delete(lineFeatureWhitelist).where(eq(lineFeatureWhitelist.id, id));
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: "LINE_WHITELIST_DELETED",
        resource: "system.line-feature-whitelist",
        resourceId: String(id),
        payload: { lineUserId: row.lineUserId, displayName: row.displayName },
        resultStatus: "success",
      });
      (async () => {
        try { await pushLineBotInterviewUser(row, "delete"); } catch (err) {
          await container.repositories.telemetry.recordAudit({ actorId: req.workbenchSession?.userId, role: req.workbenchSession?.activeRole, facilityKey: req.workbenchSession?.activeFacility, action: "LINE_BOT_INTERVIEW_PUSH_FAILED", resource: "system.line-bot-push", payload: { lineUserId: row.lineUserId, error: String(err) }, resultStatus: "failure" }).catch(() => {});
        }
        try { await pushLineBotVipEntry(row, "delete"); } catch (err) {
          await container.repositories.telemetry.recordAudit({ actorId: req.workbenchSession?.userId, role: req.workbenchSession?.activeRole, facilityKey: req.workbenchSession?.activeFacility, action: "LINE_BOT_VIP_PUSH_FAILED", resource: "system.line-bot-push", payload: { lineUserId: row.lineUserId, error: String(err) }, resultStatus: "failure" }).catch(() => {});
        }
      })();
      return res.json({ ok: true });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.get("/api/bff/system/line-bot/service-status", requireSession, requireRole("system"), async (_req, res) => {
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", services: [] });
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, services: [] });
      return res.json(await upstream.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "無法連線";
      return res.status(502).json({ message, services: [] });
    }
  });

  app.get("/api/bff/system/line-bot/service-status/snapshots", requireSession, requireRole("system"), async (_req, res) => {
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", items: [] });
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status/snapshots`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, items: [] });
      const data = await upstream.json() as unknown;
      return res.json(Array.isArray(data) ? { items: data } : data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "無法連線";
      return res.status(502).json({ message, items: [] });
    }
  });

  const lineBotProxy = (upstreamPath: string) => async (req: express.Request, res: express.Response) => {
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured" });
    const paramId = (req.params as Record<string, string | undefined>).id ?? (req.params as Record<string, string | undefined>).userId;
    const targetPath = paramId ? `${upstreamPath}/${encodeURIComponent(paramId)}` : upstreamPath;
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `${env.lineBotBaseUrl}${targetPath}${qs ? `?${qs}` : ""}`;
    const hasBody = ["POST", "PATCH", "PUT"].includes(req.method);
    try {
      const upstream = await fetch(url, {
        method: req.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: hasBody ? JSON.stringify(req.body || {}) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      const data = await upstream.json().catch(() => null);
      return res.status(upstream.status).json(data ?? { ok: upstream.ok });
    } catch (err) {
      return res.status(502).json({ message: err instanceof Error ? err.message : "無法連線" });
    }
  };

  app.get("/api/bff/system/line-bot/interview-users", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));
  app.post("/api/bff/system/line-bot/interview-users", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));
  app.patch("/api/bff/system/line-bot/interview-users/:userId", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));
  app.delete("/api/bff/system/line-bot/interview-users/:userId", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));

  app.get("/api/bff/system/line-bot/vip-whitelist", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));
  app.post("/api/bff/system/line-bot/vip-whitelist", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));
  app.patch("/api/bff/system/line-bot/vip-whitelist/:id", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));
  app.delete("/api/bff/system/line-bot/vip-whitelist/:id", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));

  app.get("/api/internal/line-whitelist/check", async (req, res) => {
    if (!container.config.internalApiToken) return res.status(503).json({ message: "INTERNAL_API_TOKEN is not configured" });
    const token = readInternalToken(req);
    if (!token) return res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" });
    if (token !== container.config.internalApiToken) return res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" });
    const lineUserId = typeof req.query.lineUserId === "string" ? req.query.lineUserId.trim() : "";
    const feature = typeof req.query.feature === "string" ? req.query.feature.trim() : "";
    if (!lineUserId || !feature) return res.status(400).json({ message: "lineUserId and feature are required" });
    try {
      const [row] = await db
        .select()
        .from(lineFeatureWhitelist)
        .where(eq(lineFeatureWhitelist.lineUserId, lineUserId))
        .limit(1);
      return res.json({
        allowed: row ? activeForFeature(row, feature) : false,
        feature,
        lineUserId,
        entry: row ? lineWhitelistDto(row) : null,
      });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.get("/api/cms/system/caution-permissions", requireSession, requireRole("system"), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const dept = typeof req.query.dept === "string" ? req.query.dept.trim().toLowerCase() : "";
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    try {
      const rows = await db
        .select()
        .from(cautionQueryPermissions)
        .orderBy(desc(cautionQueryPermissions.grantedAt), desc(cautionQueryPermissions.id));
      const items = rows
        .map(cautionDto)
        .filter((item) => status === "all" || item.status === status || (status === "active" && item.status === "expiring_soon"))
        .filter((item) => !dept || (item.department ?? "").toLowerCase() === dept)
        .filter((item) => {
          if (!query) return true;
          return `${item.userId} ${item.displayName} ${item.phone ?? ""} ${item.department ?? ""} ${item.position ?? ""}`.toLowerCase().includes(query);
        });
      const departments = Array.from(new Set(rows.map((row) => row.department).filter((value): value is string => Boolean(value)))).sort();
      return res.json({
        generatedAt: new Date().toISOString(),
        storageStatus: "ready",
        departments,
        summary: {
          total: rows.length,
          active: rows.filter((row) => cautionStatus(row) === "active" || cautionStatus(row) === "expiring_soon").length,
          disabled: rows.filter((row) => cautionStatus(row) === "disabled").length,
          expired: rows.filter((row) => cautionStatus(row) === "expired").length,
          expiringSoon: rows.filter((row) => cautionStatus(row) === "expiring_soon").length,
        },
        items,
      });
    } catch (error) {
      if (isMissingCautionTable(error)) {
        return res.json({
          generatedAt: new Date().toISOString(),
          storageStatus: "schema_pending",
          error: "caution_query_permissions tables are not created yet. Run migration 0012_caution_query_permissions.sql or npm run db:push.",
          departments: [],
          summary: { total: 0, active: 0, disabled: 0, expired: 0, expiringSoon: 0 },
          items: [],
        });
      }
      throw error;
    }
  });

  app.get("/api/cms/system/caution-permissions/candidates", requireSession, requireRole("system"), async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const result = await safeRead(
      () => container.integrations.ragicAuth.listActiveEmployees(),
      { data: null, meta: { source: "ragic-employees", status: "unavailable" as const, fallbackReason: "Ragic employees lookup failed" } },
    );
    let activeUserIds = new Set<string>();
    try {
      const rows = await db.select().from(cautionQueryPermissions).where(eq(cautionQueryPermissions.isActive, true));
      activeUserIds = new Set(rows.map((row) => row.userId));
    } catch (error) {
      if (!isMissingCautionTable(error)) throw error;
    }
    const items = (result.data ?? [])
      .map((employee) => ({
        userId: employee.lineUserId || employee.userId || employee.employeeNumber,
        employeeNumber: employee.employeeNumber,
        displayName: employee.displayName,
        phone: employee.phone ?? "",
        department: employee.department ?? employee.departments?.join(", ") ?? "",
        position: employee.title ?? "",
        enabled: !activeUserIds.has(employee.lineUserId || employee.userId || employee.employeeNumber),
        source: result.meta.source,
      }))
      .filter((employee) => employee.enabled)
      .filter((employee) => {
        if (!query) return true;
        return `${employee.userId} ${employee.employeeNumber} ${employee.displayName} ${employee.phone} ${employee.department} ${employee.position}`.toLowerCase().includes(query);
      })
      .slice(0, 50);
    return res.json({ items, sourceStatus: result.meta });
  });

  app.post("/api/cms/system/caution-permissions", requireSession, requireRole("system"), async (req, res) => {
    const parsed = cautionCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const input = parsed.data;
    const period = cautionPeriod(input.periodType, input.periodStartAt, input.periodEndAt);
    const actor = req.workbenchSession?.displayName || req.workbenchSession?.userId || "system";
    try {
      const [existing] = await db.select().from(cautionQueryPermissions).where(eq(cautionQueryPermissions.userId, input.userId)).limit(1);
      const values = {
        userId: input.userId,
        displayName: input.displayName,
        phone: input.phone || null,
        department: input.department || null,
        position: input.position || null,
        isActive: true,
        permissionStartAt: period.startAt,
        permissionEndAt: period.endAt,
        grantedBy: actor,
        note: input.note || null,
        updatedAt: new Date(),
      };
      const [row] = existing
        ? await db.update(cautionQueryPermissions).set(values).where(eq(cautionQueryPermissions.id, existing.id)).returning()
        : await db.insert(cautionQueryPermissions).values(values).returning();
      await recordCautionAudit({
        permissionId: row.id,
        action: "granted",
        beforeState: existing ? cautionSnapshot(existing) : null,
        afterState: cautionSnapshot(row),
        actor,
        metadata: { periodType: input.periodType, note: input.note ?? null },
      });
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: existing ? "CAUTION_PERMISSION_UPDATED" : "CAUTION_PERMISSION_GRANTED",
        resource: "system.caution-query-permissions",
        resourceId: String(row.id),
        payload: { userId: row.userId, displayName: row.displayName, status: cautionStatus(row) },
        resultStatus: "success",
      });
      return res.status(existing ? 200 : 201).json(cautionDto(row));
    } catch (error) {
      if (isMissingCautionTable(error)) return res.status(503).json({ message: "CAUTION_PERMISSION_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.patch("/api/cms/system/caution-permissions/:id/period", requireSession, requireRole("system"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    const parsed = cautionPeriodPatchSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const input = parsed.data;
    const period = cautionPeriod(input.periodType, input.periodStartAt, input.periodEndAt);
    const actor = req.workbenchSession?.displayName || req.workbenchSession?.userId || "system";
    try {
      const [before] = await db.select().from(cautionQueryPermissions).where(eq(cautionQueryPermissions.id, id)).limit(1);
      if (!before) return res.status(404).json({ message: "PERMISSION_NOT_FOUND" });
      const [row] = await db
        .update(cautionQueryPermissions)
        .set({ permissionStartAt: period.startAt, permissionEndAt: period.endAt, updatedAt: new Date() })
        .where(eq(cautionQueryPermissions.id, id))
        .returning();
      await recordCautionAudit({
        permissionId: row.id,
        action: "period_changed",
        beforeState: cautionSnapshot(before),
        afterState: cautionSnapshot(row),
        actor,
        metadata: { changeReason: input.changeReason, periodType: input.periodType },
      });
      return res.json(cautionDto(row));
    } catch (error) {
      if (isMissingCautionTable(error)) return res.status(503).json({ message: "CAUTION_PERMISSION_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.patch("/api/cms/system/caution-permissions/:id/status", requireSession, requireRole("system"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    const parsed = cautionStatusPatchSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const actor = req.workbenchSession?.displayName || req.workbenchSession?.userId || "system";
    try {
      const [before] = await db.select().from(cautionQueryPermissions).where(eq(cautionQueryPermissions.id, id)).limit(1);
      if (!before) return res.status(404).json({ message: "PERMISSION_NOT_FOUND" });
      const [row] = await db
        .update(cautionQueryPermissions)
        .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
        .where(eq(cautionQueryPermissions.id, id))
        .returning();
      await recordCautionAudit({
        permissionId: row.id,
        action: row.isActive ? "enabled" : "disabled",
        beforeState: cautionSnapshot(before),
        afterState: cautionSnapshot(row),
        actor,
      });
      return res.json(cautionDto(row));
    } catch (error) {
      if (isMissingCautionTable(error)) return res.status(503).json({ message: "CAUTION_PERMISSION_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.get("/api/cms/system/caution-permissions/check", async (req, res) => {
    if (!container.config.internalApiToken) return res.status(503).json({ message: "INTERNAL_API_TOKEN is not configured" });
    const token = readInternalToken(req);
    if (!token) return res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" });
    if (token !== container.config.internalApiToken) return res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" });
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userId) return res.status(400).json({ message: "userId is required" });
    try {
      const [row] = await db.select().from(cautionQueryPermissions).where(eq(cautionQueryPermissions.userId, userId)).limit(1);
      return res.json(cautionCheck(row));
    } catch (error) {
      if (isMissingCautionTable(error)) return res.status(503).json({ message: "CAUTION_PERMISSION_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.get("/api/cms/system/caution-permissions/:id/audit", requireSession, requireRole("system"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    try {
      const rows = await db
        .select()
        .from(cautionQueryPermissionAudit)
        .where(eq(cautionQueryPermissionAudit.permissionId, id))
        .orderBy(desc(cautionQueryPermissionAudit.createdAt));
      return res.json({
        items: rows.map((row) => ({
          id: row.id,
          permissionId: row.permissionId,
          action: row.action,
          beforeState: row.beforeState,
          afterState: row.afterState,
          actor: row.actor,
          metadata: row.metadata,
          createdAt: row.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      if (isMissingCautionTable(error)) return res.status(503).json({ message: "CAUTION_PERMISSION_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.post("/api/cms/system/caution-permissions/:id/log-usage", async (req, res) => {
    if (!container.config.internalApiToken) return res.status(503).json({ message: "INTERNAL_API_TOKEN is not configured" });
    const token = readInternalToken(req);
    if (!token) return res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" });
    if (token !== container.config.internalApiToken) return res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    const parsed = cautionUsageSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    try {
      const [row] = await db.select().from(cautionQueryPermissions).where(eq(cautionQueryPermissions.id, id)).limit(1);
      if (!row) return res.status(404).json({ message: "PERMISSION_NOT_FOUND" });
      await recordCautionAudit({
        permissionId: row.id,
        action: "used",
        actor: parsed.data.triggeredBy,
        metadata: { queryTarget: parsed.data.queryTarget, success: parsed.data.success },
      });
      return res.status(201).json({ ok: true });
    } catch (error) {
      if (isMissingCautionTable(error)) return res.status(503).json({ message: "CAUTION_PERMISSION_SCHEMA_PENDING" });
      throw error;
    }
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

  app.get("/api/internal/service-health", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", services: [] });
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, services: [] });
      return res.json(await upstream.json());
    } catch (err) {
      return res.status(502).json({ message: err instanceof Error ? err.message : "無法連線", services: [] });
    }
  });

  app.get("/api/internal/service-health/snapshots", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", items: [] });
    const hours = Math.min(Number(req.query.hours) || 24, 168);
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status/snapshots?hours=${hours}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, items: [] });
      const data = await upstream.json() as unknown;
      return res.json(Array.isArray(data) ? { items: data } : data);
    } catch (err) {
      return res.status(502).json({ message: err instanceof Error ? err.message : "無法連線", items: [] });
    }
  });

  app.get("/api/internal/interview-users", async (req, res) => {
    if (!requireInternalToken(req, res)) return;
    try {
      const rows = await db.select().from(lineFeatureWhitelist).orderBy(desc(lineFeatureWhitelist.updatedAt));
      const items = rows
        .filter((row) => row.status === "active" && activeForFeature(row, "interview"))
        .map((row) => lineWhitelistDto(row));
      return res.json({ items, total: items.length });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
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
