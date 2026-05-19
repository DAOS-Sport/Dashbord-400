import type { Express, Request } from "express";
import { z } from "zod";
import { and, desc, eq, gte, ilike, isNull, or } from "drizzle-orm";
import type { WorkbenchRole } from "@shared/auth/me";
import { getModuleDescriptorsByRole } from "@shared/modules";
import { sessionsIndex, userRoleSnapshots, users } from "@shared/schema";
import type { AppContainer } from "../../app/container";
import { db } from "../../db";
import { storage } from "../../storage";
import type { AuditLogRecord, StoredClientError } from "../telemetry/repository";
import { requireRole, requireSession } from "../auth/context";

const opsReasonSchema = z.object({
  reason: z.string().trim().min(3),
});

const refreshCacheSchema = opsReasonSchema.extend({
  cacheKeys: z.array(z.string().trim().min(1)).optional(),
});

const resendNotificationSchema = opsReasonSchema.extend({
  notificationId: z.string().trim().min(1),
});

const safeRead = async <T>(reader: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await reader();
  } catch {
    return fallback;
  }
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

export const registerSystemOperationsRoutes = (app: Express, container: AppContainer) => {
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
};
