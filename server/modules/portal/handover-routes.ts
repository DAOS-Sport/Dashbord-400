import type { Express, RequestHandler, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { EmployeeProfile } from "../auth/legacy-ragic-auth";
import type { OperationalHandover } from "@shared/schema";
import { findFacilityLineGroup, findScheduleRegionKey } from "@shared/domain/facilities";
import { env } from "../../shared/config/env";
import { withEmployeeCreateMetadata, withUpdateMetadata } from "../../shared/data/write-metadata";
import { storage } from "../../storage";

const correlationIdFromRequest = (req: Request) => {
  const header = req.headers["x-correlation-id"];
  return Array.isArray(header) ? header[0] : header;
};

const readScheduleText = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value.trim() : fallback);

const readScheduleNestedText = (value: unknown, keys: string[], fallback = "") => {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  for (const key of keys) {
    const text = readScheduleText(row[key]);
    if (text) return text;
  }
  return fallback;
};

const inferShiftLabelFromStart = (startsAt: string) => {
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) return "";
  const hour = parsed.getHours();
  if (hour >= 16) return "晚班";
  if (hour >= 12) return "中班";
  return "早班";
};

const resolveOperationalHandoverAssignee = async (input: {
  facilityKey: string;
  targetDate: string;
  targetShiftLabel: string;
}): Promise<{ assigneeEmployeeNumber: string | null; assigneeName: string | null; scheduleRawId?: string; matchedBy?: string; confidence?: number }> => {
  if (!env.smartScheduleBaseUrl || !env.smartScheduleApiToken) return { assigneeEmployeeNumber: null, assigneeName: null };
  const url = new URL("/api/internal/export/snapshot", env.smartScheduleBaseUrl);
  url.searchParams.set("facilityKey", findScheduleRegionKey(input.facilityKey));
  url.searchParams.set("from", input.targetDate);
  url.searchParams.set("to", input.targetDate);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${env.smartScheduleApiToken}`,
    "X-Internal-Token": env.smartScheduleApiToken,
    "X-API-Key": env.smartScheduleApiToken,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return { assigneeEmployeeNumber: null, assigneeName: null };
    const payload = await response.json() as Record<string, unknown>;
    const facility = findFacilityLineGroup(input.facilityKey);
    const rows = Array.isArray(payload.schedules) ? payload.schedules : [];
    const matched = rows
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      .find((row) => {
        const venue = row.venue && typeof row.venue === "object" ? row.venue as Record<string, unknown> : {};
        const shift = row.shift && typeof row.shift === "object" ? row.shift as Record<string, unknown> : {};
        const assignment = row.assignment && typeof row.assignment === "object" ? row.assignment as Record<string, unknown> : {};
        const venueNames = [
          readScheduleText(venue.name),
          readScheduleText(venue.shortName),
          ...((Array.isArray(venue.aliases) ? venue.aliases : []) as unknown[]).map((item) => readScheduleText(item)),
        ].filter(Boolean);
        const start = readScheduleText(shift.startAt);
        const period = readScheduleText(shift.period, inferShiftLabelFromStart(start));
        const label = `${readScheduleText(shift.label)} ${readScheduleText(shift.name)} ${period}`;
        const sameFacility = !facility || venueNames.length === 0 || venueNames.some((name) => [facility.shortName, facility.fullName, ...facility.ragicDepartmentAliases].some((alias) => name.includes(alias) || alias.includes(name)));
        const active = ["", "scheduled", "changed", "completed"].includes(readScheduleText(assignment.status));
        return active && sameFacility && (
          label.includes(input.targetShiftLabel) ||
          (input.targetShiftLabel.includes("早") && period === "early") ||
          (input.targetShiftLabel.includes("中") && period === "mid") ||
          (input.targetShiftLabel.includes("晚") && period === "late")
        );
      });
    if (!matched) return { assigneeEmployeeNumber: null, assigneeName: null };
    const employee = matched.employee && typeof matched.employee === "object" ? matched.employee as Record<string, unknown> : {};
    return {
      assigneeEmployeeNumber: readScheduleText(employee.employeeNumber) || null,
      assigneeName: readScheduleText(employee.name) || null,
      scheduleRawId: readScheduleText(matched.rawId),
      matchedBy: "date+facility+period",
      confidence: 0.9,
    };
  } catch {
    return { assigneeEmployeeNumber: null, assigneeName: null };
  } finally {
    clearTimeout(timeout);
  }
};

export const registerPortalHandoverRoutes = (
  app: Express,
  container: AppContainer,
  auth: { requireEmployee: () => RequestHandler; requireSupervisor: () => RequestHandler },
) => {
  const { requireEmployee, requireSupervisor } = auth;
  // -------- Portal: Handover (員工 KEY) --------
  app.get("/api/portal/handovers", async (req, res) => {
    try {
      const facilityKey = String(req.query.facilityKey || "");
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const items = await storage.listHandovers(facilityKey, limit);
      res.json({ items });
    } catch (err) {
      const m = err instanceof Error ? err.message : "查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/handovers", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertHandoverEntrySchema } = await import("@shared/schema");
      const role = req.workbenchSession?.activeRole ?? (caller.isSupervisor ? "supervisor" : "employee");
      // Force author identity from authenticated caller (do not trust body)
      const parsed = insertHandoverEntrySchema.safeParse({
        ...(req.body || {}),
        authorEmployeeNumber: caller.employeeNumber,
        authorName: caller.name,
        createdByRole: role,
        source: "manual",
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const created = await storage.createHandover(parsed.data);
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role,
        facilityKey: parsed.data.facilityKey,
        action: "HANDOVER_ENTRY_CREATED",
        resource: "handover_entries",
        resourceId: String(created.id),
        payload: { contentPreview: parsed.data.content.slice(0, 50) },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      // 也順便記一筆 portal event
      await storage.recordPortalEvent({
        employeeNumber: parsed.data.authorEmployeeNumber || null,
        employeeName: parsed.data.authorName || null,
        facilityKey: parsed.data.facilityKey,
        eventType: "handover_create",
        target: String(created.id),
        targetLabel: parsed.data.content.slice(0, 50),
        metadata: null,
      });
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/handovers/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const entry = await storage.getHandoverById(id);
      if (!entry) return res.status(404).json({ message: "找不到資料" });
      if (!caller.isSupervisor && entry.authorEmployeeNumber !== caller.employeeNumber) {
        return res.status(403).json({ message: "僅作者或主管可刪除" });
      }
      const ok = await storage.deleteHandover(id);
      if (!ok) return res.status(404).json({ message: "找不到資料" });
      res.json({ ok: true });
    } catch (err) {
      const m = err instanceof Error ? err.message : "刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  const linkedActionUrlSchema = z.string().max(2048).refine((value) => (
    value.startsWith("/") || z.string().url().safeParse(value).success
  ), "連結格式不正確");

  const operationalHandoverCreateBodySchema = z.object({
    facilityKey: z.string().min(1),
    title: z.string().min(1).max(120),
    content: z.string().min(1).max(2000),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetShiftLabel: z.string().min(1).optional(),
    visibleFrom: z.string().datetime().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    assigneeEmployeeNumber: z.string().optional().nullable(),
    assigneeName: z.string().optional().nullable(),
    linkedActionType: z.string().optional().nullable(),
    linkedActionUrl: linkedActionUrlSchema.optional().nullable(),
  });

  const operationalHandoverPatchBodySchema = z.object({
    title: z.string().min(1).max(120).optional(),
    content: z.string().min(1).max(2000).optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    status: z.enum(["pending", "claimed", "in_progress", "reported", "done", "cancelled"]).optional(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetShiftLabel: z.string().min(1).optional(),
    visibleFrom: z.string().datetime().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    assigneeEmployeeNumber: z.string().optional().nullable(),
    assigneeName: z.string().optional().nullable(),
    linkedActionType: z.string().optional().nullable(),
    linkedActionUrl: linkedActionUrlSchema.optional().nullable(),
  });

  const operationalHandoverReportBodySchema = z.object({
    status: z.enum(["claimed", "in_progress", "reported", "done"]).default("reported"),
    reportNote: z.string().max(2000).optional().nullable(),
  });

  const toDateOrNull = (value: string | null | undefined) => value ? new Date(value) : null;
  const datePartFromIso = (value: string | null | undefined) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
  };

  const canAccessFacility = (req: import("express").Request, facilityKey: string) =>
    !req.workbenchSession || req.workbenchSession.grantedFacilities.includes(facilityKey);

  const mapOperationalHandoverForResponse = (handover: OperationalHandover) => ({
    ...handover,
    visibleFrom: handover.visibleFrom?.toISOString?.() ?? handover.visibleFrom,
    dueAt: handover.dueAt?.toISOString?.() ?? handover.dueAt,
    completedAt: handover.completedAt?.toISOString?.() ?? handover.completedAt,
    createdAt: handover.createdAt?.toISOString?.() ?? handover.createdAt,
    updatedAt: handover.updatedAt?.toISOString?.() ?? handover.updatedAt,
  });

  // -------- Portal: Operational Handovers / 交班交接 --------
  app.get("/api/portal/operational-handovers", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const requestedFacilityKey = req.query.facilityKey ? String(req.query.facilityKey) : req.workbenchSession?.activeFacility;
      if (!requestedFacilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      if (!caller.isSupervisor && !canAccessFacility(req, requestedFacilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const items = await storage.listOperationalHandovers({
        facilityKey: requestedFacilityKey,
        status: req.query.status ? String(req.query.status) : undefined,
        targetDate: req.query.targetDate ? String(req.query.targetDate) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ items: items.map(mapOperationalHandoverForResponse) });
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接查詢失敗";
      console.error("[operational-handovers:list_failed]", err);
      res.json({
        items: [],
        sourceStatus: {
          connected: false,
          errorMessage: m,
        },
      });
    }
  });

  app.post("/api/portal/operational-handovers", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const body = req.body || {};
      const parsed = operationalHandoverCreateBodySchema.safeParse({
        ...body,
        targetDate: body.targetDate || datePartFromIso(body.dueAt),
        targetShiftLabel: body.targetShiftLabel || "櫃台交辦",
      });
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      if (!canAccessFacility(req, parsed.data.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const targetDate = parsed.data.targetDate ?? datePartFromIso(parsed.data.dueAt);
      const targetShiftLabel = parsed.data.targetShiftLabel ?? "櫃台交辦";
      const resolvedAssignee = parsed.data.assigneeEmployeeNumber || parsed.data.assigneeName
        ? { assigneeEmployeeNumber: parsed.data.assigneeEmployeeNumber ?? null, assigneeName: parsed.data.assigneeName ?? null }
        : await resolveOperationalHandoverAssignee({
          facilityKey: parsed.data.facilityKey,
          targetDate,
          targetShiftLabel,
        });
      const created = await storage.createOperationalHandover(withEmployeeCreateMetadata({
        facilityKey: parsed.data.facilityKey,
        title: parsed.data.title,
        content: parsed.data.content,
        priority: parsed.data.priority,
        status: "pending",
        targetDate,
        targetShiftLabel,
        visibleFrom: toDateOrNull(parsed.data.visibleFrom),
        dueAt: toDateOrNull(parsed.data.dueAt),
        assigneeEmployeeNumber: resolvedAssignee.assigneeEmployeeNumber,
        assigneeName: resolvedAssignee.assigneeName,
        createdByEmployeeNumber: caller.employeeNumber,
        createdByName: caller.name,
        linkedActionType: parsed.data.linkedActionType ?? null,
        linkedActionUrl: parsed.data.linkedActionUrl ?? null,
      }, {
        userId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: parsed.data.facilityKey,
      }, caller.name));
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: parsed.data.facilityKey,
        action: "OPERATIONAL_HANDOVER_CREATED",
        resource: "operational_handovers",
        resourceId: String(created.id),
        payload: { title: created.title },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      await storage.recordPortalEvent({
        employeeNumber: caller.employeeNumber,
        employeeName: caller.name,
        facilityKey: parsed.data.facilityKey,
        eventType: "handover_create",
        target: String(created.id),
        targetLabel: created.title,
        metadata: JSON.stringify({
          targetDate: created.targetDate,
          targetShiftLabel: created.targetShiftLabel,
          autoAssigned: Boolean(resolvedAssignee.assigneeEmployeeNumber || resolvedAssignee.assigneeName),
          scheduleRawId: resolvedAssignee.scheduleRawId,
          matchedBy: resolvedAssignee.matchedBy,
          confidence: resolvedAssignee.confidence,
        }),
      });
      res.status(201).json(mapOperationalHandoverForResponse(created));
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/operational-handovers/:id", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getOperationalHandoverById(id);
      if (!existing) return res.status(404).json({ message: "找不到交班交接" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const parsed = operationalHandoverPatchBodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const updated = await storage.updateOperationalHandover(id, withUpdateMetadata({
        ...parsed.data,
        visibleFrom: parsed.data.visibleFrom === undefined ? undefined : toDateOrNull(parsed.data.visibleFrom),
        dueAt: parsed.data.dueAt === undefined ? undefined : toDateOrNull(parsed.data.dueAt),
        completedAt: parsed.data.status === "done" ? new Date() : undefined,
      }, {
        userId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: existing.facilityKey,
      }));
      if (updated) {
        await container.repositories.telemetry.recordAudit({
          actorId: caller.employeeNumber,
          role: "supervisor",
          facilityKey: existing.facilityKey,
          action: "OPERATIONAL_HANDOVER_UPDATED",
          resource: "operational_handovers",
          resourceId: String(updated.id),
          payload: { title: updated.title, status: updated.status },
          correlationId: correlationIdFromRequest(req),
          resultStatus: "success",
        });
      }
      res.json(updated ? mapOperationalHandoverForResponse(updated) : null);
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/operational-handovers/:id/report", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getOperationalHandoverById(id);
      if (!existing) return res.status(404).json({ message: "找不到交班交接" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const parsed = operationalHandoverReportBodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const updated = await storage.updateOperationalHandover(id, withUpdateMetadata({
        status: parsed.data.status,
        reportNote: parsed.data.reportNote ?? null,
        claimedByEmployeeNumber: parsed.data.status === "claimed" ? caller.employeeNumber : undefined,
        claimedByName: parsed.data.status === "claimed" ? caller.name : undefined,
        reportedByEmployeeNumber: caller.employeeNumber,
        reportedByName: caller.name,
        completedAt: parsed.data.status === "done" ? new Date() : null,
      }, {
        userId: caller.employeeNumber,
        role: caller.isSupervisor ? "supervisor" : "employee",
        facilityKey: existing.facilityKey,
      }));
      if (updated) {
        await container.repositories.telemetry.recordAudit({
          actorId: caller.employeeNumber,
          role: caller.isSupervisor ? "supervisor" : "employee",
          facilityKey: existing.facilityKey,
          action: "OPERATIONAL_HANDOVER_REPORTED",
          resource: "operational_handovers",
          resourceId: String(updated.id),
          payload: { title: updated.title, status: updated.status },
          correlationId: correlationIdFromRequest(req),
          resultStatus: "success",
        });
      }
      await storage.recordPortalEvent({
        employeeNumber: caller.employeeNumber,
        employeeName: caller.name,
        facilityKey: existing.facilityKey,
        eventType: parsed.data.status === "claimed" ? "handover_claim" : "handover_report",
        target: String(existing.id),
        targetLabel: existing.title,
        metadata: JSON.stringify({ status: parsed.data.status }),
      });
      res.json(updated ? mapOperationalHandoverForResponse(updated) : null);
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接回報失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/operational-handovers/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getOperationalHandoverById(id);
      if (!existing) return res.status(404).json({ message: "找不到交班交接" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const ok = await storage.deleteOperationalHandover(id);
      res.json({ ok });
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接刪除失敗";
      res.status(500).json({ message: m });
    }
  });
};
