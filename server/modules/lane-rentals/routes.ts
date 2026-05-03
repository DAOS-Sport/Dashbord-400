import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { insertLaneRentalSchema, type LaneRental } from "@shared/schema";

interface CallerProfile {
  employeeNumber: string;
  name: string;
  isSystem: boolean;
}

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
}

function getCaller(req: import("express").Request): CallerProfile {
  const session = req.workbenchSession;
  return {
    employeeNumber: session?.userId ?? "unknown",
    name: session?.displayName ?? "未知員工",
    isSystem: !!session?.grantedRoles?.includes?.("system"),
  };
}

// Rollout scope: lane rentals are only enabled for 松山國小 in this phase.
// Adding new facilities should be a deliberate config change here, NOT just a
// caller permissions question — keeping the allowlist server-side enforced
// ensures other facilities can't be created/mutated even by privileged users.
const LANE_RENTAL_ALLOWED_FACILITIES = new Set<string>(["songshan_pool"]);

function canAccessFacility(req: import("express").Request, caller: CallerProfile, facilityKey: string): boolean {
  if (!LANE_RENTAL_ALLOWED_FACILITIES.has(facilityKey)) return false;
  // Only `system` admins bypass facility grants. Supervisors and regular
  // employees must have the facility explicitly granted in their session;
  // this prevents non-Songshan supervisors from touching Songshan rentals.
  if (caller.isSystem) return true;
  if (!req.workbenchSession) return false;
  return req.workbenchSession.grantedFacilities?.includes(facilityKey) ?? false;
}

// Strict update schema — explicitly whitelists the only fields a caller may patch.
// facilityKey / bookingDate / laneCode / createdBy / createdByName / status / id are
// immutable from the client to prevent (a) cross-facility privilege escalation via
// re-targeting and (b) audit-field tampering.
const updateLaneRentalSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  renterName: z.string().min(1).max(100).optional(),
  renterContact: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
}).strict();

function isConflictError(e: unknown): e is Error & { code: string; conflicts?: LaneRental[] } {
  return !!e && typeof e === "object" && (e as { code?: unknown }).code === "LANE_RENTAL_CONFLICT";
}

export function registerLaneRentalRoutes(app: Express, deps: RegisterDeps) {
  const { requireEmployee, requireSupervisor } = deps;

  app.get("/api/lane-rentals", requireEmployee(), async (req, res) => {
    try {
      const facilityKey = String(req.query.facilityKey ?? "").trim();
      const date = req.query.date ? String(req.query.date) : undefined;
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      const caller = getCaller(req);
      if (!canAccessFacility(req, caller, facilityKey)) {
        return res.status(403).json({ message: "無權限存取此館別" });
      }
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "日期格式錯誤 (YYYY-MM-DD)" });
      }
      const items: LaneRental[] = await storage.listLaneRentals({
        facilityKey,
        bookingDate: date,
        status: "active",
      });
      res.json({ items });
    } catch (e) {
      console.error("[lane-rentals] list failed", e);
      res.status(500).json({ message: "載入失敗" });
    }
  });

  app.post("/api/lane-rentals", requireSupervisor(), async (req, res) => {
    try {
      const parsed = insertLaneRentalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const input = parsed.data;
      const caller = getCaller(req);
      if (!canAccessFacility(req, caller, input.facilityKey)) {
        return res.status(403).json({ message: "無權限新增此館別的租借" });
      }
      if (input.startTime >= input.endTime) {
        return res.status(400).json({ message: "結束時間需晚於開始時間" });
      }
      try {
        const item = await storage.createLaneRental({
          ...input,
          createdBy: caller.employeeNumber,
          createdByName: caller.name,
        });
        res.json({ item });
      } catch (e) {
        if (isConflictError(e)) {
          return res.status(409).json({ message: e.message, conflicts: e.conflicts });
        }
        throw e;
      }
    } catch (e) {
      console.error("[lane-rentals] create failed", e);
      res.status(500).json({ message: "建立失敗" });
    }
  });

  app.patch("/api/lane-rentals/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
      const existing = await storage.getLaneRentalById(id);
      if (!existing) return res.status(404).json({ message: "找不到租借" });
      const caller = getCaller(req);
      if (!canAccessFacility(req, caller, existing.facilityKey)) {
        return res.status(403).json({ message: "無權限修改" });
      }
      const partial = updateLaneRentalSchema.safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: partial.error.flatten() });
      }
      const merged = {
        startTime: partial.data.startTime ?? existing.startTime,
        endTime: partial.data.endTime ?? existing.endTime,
      };
      if (merged.startTime >= merged.endTime) {
        return res.status(400).json({ message: "結束時間需晚於開始時間" });
      }
      try {
        const item = await storage.updateLaneRental(id, partial.data);
        if (!item) return res.status(404).json({ message: "找不到租借" });
        res.json({ item });
      } catch (e) {
        if (isConflictError(e)) {
          return res.status(409).json({ message: e.message, conflicts: e.conflicts });
        }
        throw e;
      }
    } catch (e) {
      console.error("[lane-rentals] update failed", e);
      res.status(500).json({ message: "更新失敗" });
    }
  });

  app.delete("/api/lane-rentals/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
      const existing = await storage.getLaneRentalById(id);
      if (!existing) return res.status(404).json({ message: "找不到租借" });
      const caller = getCaller(req);
      if (!canAccessFacility(req, caller, existing.facilityKey)) {
        return res.status(403).json({ message: "無權限刪除" });
      }
      const ok = await storage.deleteLaneRental(id);
      res.json({ ok });
    } catch (e) {
      console.error("[lane-rentals] delete failed", e);
      res.status(500).json({ message: "刪除失敗" });
    }
  });

}
