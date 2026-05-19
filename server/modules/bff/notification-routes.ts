import type { Express } from "express";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { WorkbenchRole } from "@shared/auth/me";
import { facilityLabel } from "@shared/domain/facilities";
import { notificationDeliveries, notificationHub } from "@shared/schema";
import { db } from "../../db";
import { env } from "../../shared/config/env";
import { storage } from "../../storage";
import { requireRole, requireSession } from "../auth/context";

const notificationInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1200),
  level: z.enum(["info", "success", "warning", "danger"]).default("info"),
  targetRole: z.enum(["employee", "lifeguard", "supervisor", "system", "all"]).default("employee"),
  facilityKey: z.string().trim().min(1).max(120).nullable().optional(),
  actionUrl: z.string().trim().max(2048).nullable().optional(),
});

type SourceStatus = {
  connected: boolean;
  source: "postgres" | "not-configured";
  errorMessage?: string;
};

const disconnected = (errorMessage = "通知資料源未連線"): { items: never[]; unreadCount: 0; sourceStatus: SourceStatus } => ({
  items: [],
  unreadCount: 0,
  sourceStatus: {
    connected: false,
    source: "not-configured",
    errorMessage,
  },
});

const roleScopeFor = (role: WorkbenchRole) => [role, "all"];

const facilityScopeFor = (role: WorkbenchRole, activeFacility: string, grantedFacilities: string[]) => {
  if (role === "supervisor" || role === "system") {
    return grantedFacilities.length ? grantedFacilities : activeFacility ? [activeFacility] : [];
  }
  return activeFacility ? [activeFacility] : [];
};

const toIso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? null;

export const registerWorkbenchNotificationRoutes = (app: Express) => {
  app.get("/api/bff/workbench/notifications", requireSession, async (req, res) => {
    if (!env.databaseUrl) return res.json(disconnected());

    const session = req.workbenchSession!;
    const roleScope = roleScopeFor(session.activeRole);
    const facilityScope = facilityScopeFor(session.activeRole, session.activeFacility, session.grantedFacilities);

    try {
      const targetRoleFilter = or(isNull(notificationHub.targetRole), inArray(notificationHub.targetRole, roleScope));
      const facilityFilter = facilityScope.length
        ? or(isNull(notificationHub.facilityKey), inArray(notificationHub.facilityKey, facilityScope))
        : isNull(notificationHub.facilityKey);
      const notifications = await db
        .select()
        .from(notificationHub)
        .where(and(targetRoleFilter, facilityFilter))
        .orderBy(desc(notificationHub.createdAt))
        .limit(50);

      const ids = notifications.map((item) => item.id);
      if (!ids.length) {
        return res.json({
          items: [],
          unreadCount: 0,
          sourceStatus: { connected: true, source: "postgres" as const },
        });
      }

      let deliveries = await db
        .select()
        .from(notificationDeliveries)
        .where(and(eq(notificationDeliveries.recipientUserId, session.userId), inArray(notificationDeliveries.notificationId, ids)));
      const existingIds = new Set(deliveries.map((item) => item.notificationId));
      const missing = notifications.filter((item) => !existingIds.has(item.id));

      if (missing.length) {
        await db
          .insert(notificationDeliveries)
          .values(
            missing.map((item) => ({
              notificationId: item.id,
              recipientUserId: session.userId,
              recipientRole: session.activeRole,
              facilityKey: item.facilityKey ?? session.activeFacility,
            })),
          )
          .onConflictDoNothing()
          .catch(() => undefined);
        deliveries = await db
          .select()
          .from(notificationDeliveries)
          .where(and(eq(notificationDeliveries.recipientUserId, session.userId), inArray(notificationDeliveries.notificationId, ids)));
      }

      const deliveryByNotificationId = new Map(deliveries.map((item) => [item.notificationId, item]));
      const items = notifications.map((item) => {
        const delivery = deliveryByNotificationId.get(item.id);
        const facilityName = item.facilityKey ? facilityLabel(item.facilityKey) : "全場館";
        return {
          deliveryId: delivery ? String(delivery.id) : `notification:${item.id}`,
          notificationId: item.id,
          title: item.title,
          body: item.body,
          level: item.level,
          targetRole: item.targetRole ?? "all",
          facilityKey: item.facilityKey,
          facilityName,
          actionUrl: item.actionUrl,
          source: item.source,
          createdAt: toIso(item.createdAt),
          readAt: toIso(delivery?.readAt ?? item.readAt),
          createdByName: item.createdByName,
        };
      });

      return res.json({
        items,
        unreadCount: items.filter((item) => !item.readAt).length,
        sourceStatus: { connected: true, source: "postgres" as const },
      });
    } catch (error) {
      return res.json(disconnected(error instanceof Error ? error.message : "通知資料源未連線"));
    }
  });

  app.patch("/api/bff/workbench/notifications/:deliveryId/read", requireSession, async (req, res) => {
    if (!env.databaseUrl) return res.status(503).json(disconnected());

    const session = req.workbenchSession!;
    const rawId = String(req.params.deliveryId || "");
    const explicitDeliveryId = Number(rawId);
    const rawNotificationId = rawId.startsWith("notification:") ? Number(rawId.replace("notification:", "")) : undefined;
    const now = new Date();

    try {
      if (Number.isFinite(explicitDeliveryId) && explicitDeliveryId > 0) {
        const [updated] = await db
          .update(notificationDeliveries)
          .set({ readAt: now, updatedAt: now })
          .where(and(eq(notificationDeliveries.id, explicitDeliveryId), eq(notificationDeliveries.recipientUserId, session.userId)))
          .returning();
        if (updated) return res.json({ ok: true, deliveryId: String(updated.id), readAt: toIso(updated.readAt) });
      }

      if (!rawNotificationId || !Number.isFinite(rawNotificationId)) {
        return res.status(400).json({ message: "INVALID_NOTIFICATION_DELIVERY" });
      }

      const [created] = await db
        .insert(notificationDeliveries)
        .values({
          notificationId: rawNotificationId,
          recipientUserId: session.userId,
          recipientRole: session.activeRole,
          facilityKey: session.activeFacility,
          readAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [notificationDeliveries.notificationId, notificationDeliveries.recipientUserId],
          set: { readAt: now, updatedAt: now },
        })
        .returning();
      return res.json({ ok: true, deliveryId: String(created.id), readAt: toIso(created.readAt) });
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "通知狀態更新失敗" });
    }
  });

  app.post(
    "/api/bff/workbench/notifications",
    requireSession,
    requireRole("supervisor", "system"),
    async (req, res) => {
      if (!env.databaseUrl) return res.status(503).json(disconnected());

      const session = req.workbenchSession!;
      const parsed = notificationInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "INVALID_NOTIFICATION_PAYLOAD", issues: parsed.error.flatten() });

      const facilityKey = parsed.data.facilityKey === "all" ? null : parsed.data.facilityKey ?? session.activeFacility ?? null;
      if (facilityKey && !session.grantedRoles.includes("system") && !session.grantedFacilities.includes(facilityKey)) {
        return res.status(403).json({ message: "Facility is not granted" });
      }

      try {
        const [created] = await db
          .insert(notificationHub)
          .values({
            title: parsed.data.title,
            body: parsed.data.body,
            level: parsed.data.level,
            targetRole: parsed.data.targetRole === "all" ? null : parsed.data.targetRole,
            facilityKey,
            actionUrl: parsed.data.actionUrl || null,
            source: "manual",
            createdByUserId: session.userId,
            createdByName: session.displayName,
            createdByRole: session.activeRole,
          })
          .returning();

        await storage
          .recordPortalEvent({
            employeeNumber: session.userId,
            employeeName: session.displayName,
            facilityKey: facilityKey ?? session.activeFacility,
            eventType: "resource_create",
            target: "notification_hub",
            targetLabel: created.title,
            metadata: JSON.stringify({
              notificationId: created.id,
              targetRole: created.targetRole ?? "all",
              source: "workbench-notification-center",
            }),
          })
          .catch(() => undefined);

        return res.status(201).json({
          id: created.id,
          title: created.title,
          body: created.body,
          level: created.level,
          targetRole: created.targetRole ?? "all",
          facilityKey: created.facilityKey,
          actionUrl: created.actionUrl,
          createdAt: toIso(created.createdAt),
        });
      } catch (error) {
        return res.status(500).json({ message: error instanceof Error ? error.message : "通知建立失敗" });
      }
    },
  );
};
