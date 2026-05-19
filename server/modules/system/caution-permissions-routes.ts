import type { Express, Request, Response } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { AppContainer } from "../../app/container";
import { db } from "../../db";
import { requireRole, requireSession } from "../auth/context";
import { cautionQueryPermissionAudit, cautionQueryPermissions } from "@shared/schema";
import { isMissingCautionTable, toNullableDate } from "./line-whitelist-service";

const readInternalToken = (req: Request) => {
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const internal = req.headers["x-internal-token"];
  const apiKey = req.headers["x-api-key"];
  return bearer || (Array.isArray(internal) ? internal[0] : internal) || (Array.isArray(apiKey) ? apiKey[0] : apiKey) || "";
};

const requireInternalToken = (container: AppContainer, req: Request, res: Response) => {
  if (!container.config.internalApiToken) {
    res.status(503).json({ message: "INTERNAL_API_TOKEN is not configured" });
    return false;
  }
  const token = readInternalToken(req);
  if (!token) {
    res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" });
    return false;
  }
  if (token !== container.config.internalApiToken) {
    res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" });
    return false;
  }
  return true;
};

const safeRead = async <T>(reader: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await reader();
  } catch {
    return fallback;
  }
};

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

export const registerCautionPermissionRoutes = (app: Express, container: AppContainer) => {
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
      const departments = Array.from(new Set(rows.map((row) => row.department).filter(Boolean) as string[])).sort();
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
    const employeesSlot = container.services.ragicCache.getEmployees();
    const result = {
      data: employeesSlot.data,
      meta: { source: employeesSlot.source, status: employeesSlot.error ? "unavailable" as const : "ok" as const, fallbackReason: employeesSlot.error ?? undefined },
    };
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
    if (!requireInternalToken(container, req, res)) return;
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
    if (!requireInternalToken(container, req, res)) return;
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
};
