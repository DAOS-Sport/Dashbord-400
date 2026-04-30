import type { Express, Request } from "express";
import { z } from "zod";
import type { BackendModule } from "../_shared/module";
import { requireSession } from "../auth/context";
import { storage } from "../../storage";
import type { HandoverItemDto, HandoverListDto, HandoverSummaryDto } from "@shared/domain/workbench";
import type { InsertOperationalHandover, OperationalHandover } from "@shared/schema";

const createHandoverSchema = z.object({
  facilityKey: z.string().min(1).optional(),
  title: z.string().min(1, "標題不可為空").max(140, "標題過長"),
  content: z.string().min(1, "內容不可為空").max(2000, "內容過長"),
  dueDate: z.string().min(1, "請指定到期日期"),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

const replyHandoverSchema = z.object({
  reportNote: z.string().min(1, "回覆不可為空").max(1200, "回覆過長"),
});

const isDatabaseUnavailable = () => !process.env.DATABASE_URL;

const sendDatabaseUnavailable = (res: import("express").Response) =>
  res.status(503).json({
    message: "資料庫尚未連線，請在部署環境設定 DATABASE_URL 後使用櫃台交接寫入功能。",
    code: "DATABASE_NOT_CONNECTED",
  });

const isGrantedFacility = (req: Request, facilityKey: string) =>
  Boolean(req.workbenchSession?.grantedFacilities.includes(facilityKey));

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const statusForHandover = (handover: OperationalHandover, now = new Date()): HandoverItemDto["status"] => {
  if (handover.status === "done") return "completed";
  if (handover.dueAt && handover.dueAt.getTime() < now.getTime()) return "expired";
  return "pending";
};

const mapHandoverItem = (handover: OperationalHandover, now = new Date()): HandoverItemDto => ({
  id: String(handover.id),
  facilityKey: handover.facilityKey,
  title: handover.title,
  content: handover.content,
  dueDate: handover.dueAt?.toISOString() ?? `${handover.targetDate}T23:59:59.000Z`,
  preview: handover.content.slice(0, 120),
  status: statusForHandover(handover, now),
  priority: handover.priority === "high" || handover.priority === "low" ? handover.priority : "normal",
  createdBy: handover.createdByName || handover.createdByEmployeeNumber || "員工",
  createdAt: handover.createdAt?.toISOString?.() ?? new Date().toISOString(),
  updatedAt: handover.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  reportNote: handover.reportNote,
});

const listFacilityHandovers = async (facilityKey: string) => {
  const handovers = await storage.listOperationalHandovers({ facilityKey, limit: 200 });
  const now = new Date();
  return handovers
    .map((handover) => mapHandoverItem(handover, now))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
};

const buildSummary = (items: HandoverItemDto[]): HandoverSummaryDto => {
  const pending = items
    .filter((item) => item.status === "pending")
    .filter((item) => new Date(item.dueDate).getTime() >= Date.now())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return {
    moduleId: "handover",
    title: "交辦事項",
    items: pending.slice(0, 5).map(({ id, title, dueDate, preview, status }) => ({ id, title, dueDate, preview, status })),
    totalPending: pending.length,
    sourceStatus: {
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
  };
};

export const registerHandoverRoutes = (app: Express) => {
  app.get("/api/bff/employee/handover/summary", requireSession, async (req, res, next) => {
    try {
      const facilityKey = req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const items = await listFacilityHandovers(facilityKey);
      return res.json(buildSummary(items));
    } catch (error) {
      const dto: HandoverSummaryDto = {
        moduleId: "handover",
        title: "交辦事項",
        items: [],
        totalPending: 0,
        sourceStatus: {
          connected: false,
          errorMessage: error instanceof Error ? error.message : "交辦事項資料暫時無法取得",
        },
      };
      return res.json(dto);
    }
  });

  app.get("/api/bff/employee/handover/list", requireSession, async (req, res, next) => {
    try {
      const facilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const items = await listFacilityHandovers(facilityKey);
      const dto: HandoverListDto = {
        moduleId: "handover",
        items,
        sourceStatus: {
          connected: true,
          lastSyncedAt: new Date().toISOString(),
        },
      };
      return res.json(dto);
    } catch (error) {
      const dto: HandoverListDto = {
        moduleId: "handover",
        items: [],
        sourceStatus: {
          connected: false,
          errorMessage: error instanceof Error ? error.message : "交辦事項資料暫時無法取得",
        },
      };
      return res.json(dto);
    }
  });

  app.post("/api/handover", requireSession, async (req, res, next) => {
    try {
      const input = createHandoverSchema.parse(req.body);
      const facilityKey = input.facilityKey || req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const dueAt = parseDate(input.dueDate);
      if (!dueAt) return res.status(400).json({ message: "Invalid dueDate" });
      const handover: InsertOperationalHandover = {
        facilityKey,
        title: input.title,
        content: input.content,
        priority: input.priority ?? "normal",
        status: "pending",
        targetDate: input.dueDate.slice(0, 10),
        targetShiftLabel: "交辦事項",
        visibleFrom: null,
        dueAt,
        assigneeEmployeeNumber: null,
        assigneeName: null,
        claimedByEmployeeNumber: null,
        claimedByName: null,
        createdByEmployeeNumber: req.workbenchSession!.userId,
        createdByName: req.workbenchSession!.displayName,
        reportedByEmployeeNumber: null,
        reportedByName: null,
        reportNote: null,
        linkedActionType: null,
        linkedActionUrl: null,
      };
      const created = await storage.createOperationalHandover(handover);
      await storage.recordPortalEvent({
        employeeNumber: req.workbenchSession!.userId,
        employeeName: req.workbenchSession!.displayName,
        facilityKey,
        eventType: "handover_create",
        target: String(created.id),
        targetLabel: created.title,
        metadata: JSON.stringify({ source: "employee-handover-api" }),
      }).catch(() => undefined);
      return res.status(201).json(mapHandoverItem(created));
    } catch (error) {
      if (isDatabaseUnavailable()) return sendDatabaseUnavailable(res);
      return next(error);
    }
  });

  app.patch("/api/handover/:id/complete", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid handover id" });
      const handover = await storage.getOperationalHandoverById(id);
      if (!handover) return res.status(404).json({ message: "Handover item not found" });
      if (!isGrantedFacility(req, handover.facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const updated = await storage.updateOperationalHandover(id, {
        status: "done",
        reportedByEmployeeNumber: req.workbenchSession!.userId,
        reportedByName: req.workbenchSession!.displayName,
        completedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ message: "Handover item not found" });
      await storage.recordPortalEvent({
        employeeNumber: req.workbenchSession!.userId,
        employeeName: req.workbenchSession!.displayName,
        facilityKey: updated.facilityKey,
        eventType: "handover_report",
        target: String(updated.id),
        targetLabel: updated.title,
        metadata: JSON.stringify({ status: "done", source: "employee-handover-api" }),
      }).catch(() => undefined);
      return res.json(mapHandoverItem(updated));
    } catch (error) {
      if (isDatabaseUnavailable()) return sendDatabaseUnavailable(res);
      return next(error);
    }
  });

  app.patch("/api/handover/:id/read", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid handover id" });
      const handover = await storage.getOperationalHandoverById(id);
      if (!handover) return res.status(404).json({ message: "Handover item not found" });
      if (!isGrantedFacility(req, handover.facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const updated = await storage.updateOperationalHandover(id, {
        ...(handover.status === "pending" ? { status: "claimed" as const } : {}),
        claimedByEmployeeNumber: req.workbenchSession!.userId,
        claimedByName: req.workbenchSession!.displayName,
      });
      if (!updated) return res.status(404).json({ message: "Handover item not found" });
      return res.json(mapHandoverItem(updated));
    } catch (error) {
      if (isDatabaseUnavailable()) return sendDatabaseUnavailable(res);
      return next(error);
    }
  });

  app.patch("/api/handover/:id/reply", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid handover id" });
      const input = replyHandoverSchema.parse(req.body);
      const handover = await storage.getOperationalHandoverById(id);
      if (!handover) return res.status(404).json({ message: "Handover item not found" });
      if (!isGrantedFacility(req, handover.facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const notePrefix = req.workbenchSession!.displayName || req.workbenchSession!.userId;
      const nextNote = [handover.reportNote, `${notePrefix}: ${input.reportNote}`].filter(Boolean).join("\n");
      const updated = await storage.updateOperationalHandover(id, {
        reportNote: nextNote,
        reportedByEmployeeNumber: req.workbenchSession!.userId,
        reportedByName: req.workbenchSession!.displayName,
      });
      if (!updated) return res.status(404).json({ message: "Handover item not found" });
      return res.json(mapHandoverItem(updated));
    } catch (error) {
      if (isDatabaseUnavailable()) return sendDatabaseUnavailable(res);
      return next(error);
    }
  });

  app.delete("/api/handover/:id", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid handover id" });
      const handover = await storage.getOperationalHandoverById(id);
      if (!handover) return res.status(404).json({ message: "Handover item not found" });
      if (!isGrantedFacility(req, handover.facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const ok = await storage.deleteOperationalHandover(id);
      return res.json({ ok });
    } catch (error) {
      if (isDatabaseUnavailable()) return sendDatabaseUnavailable(res);
      return next(error);
    }
  });
};

export const handoverModule: BackendModule = {
  name: "handover",
  responsibility: "Employee front desk handover BFF summary, list, create, and completion flow",
};
