import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import {
  courtBatchImportSchema,
  insertCourtReservationSchema,
  COURT_SCHOOL_IDS,
  type CourtSchoolId,
} from "@shared/schema";
import type { AuditEventInput } from "../../shared/telemetry/audit-writer";
import { isValidCourtForSchool } from "@shared/court-config";
import { courtsStorage } from "./storage";
import {
  isGoogleCalendarEnabled,
  getCalendarReservations,
  getCalendarReservationsRange,
} from "./google-calendar";

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
  recordAudit?: (event: AuditEventInput) => Promise<void>;
}

const isCourtSchool = (s: unknown): s is CourtSchoolId =>
  typeof s === "string" && (COURT_SCHOOL_IDS as readonly string[]).includes(s);

function pickSchool(req: Request, res: Response): CourtSchoolId | null {
  const s = req.params.school;
  if (!isCourtSchool(s)) {
    res.status(400).json({ message: `未知的學校：${s}` });
    return null;
  }
  return s;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type CourtCaller = {
  employeeNumber?: string;
  name?: string;
  isSupervisor?: boolean;
};

const getCourtCaller = (req: Request): CourtCaller => {
  const caller = (req as unknown as { caller?: CourtCaller }).caller;
  return caller ?? {
    employeeNumber: req.workbenchSession?.userId,
    name: req.workbenchSession?.displayName,
    isSupervisor: req.workbenchSession?.grantedRoles?.includes("supervisor") || req.workbenchSession?.grantedRoles?.includes("system"),
  };
};

const roleFromRequest = (req: Request, caller: CourtCaller) =>
  req.workbenchSession?.activeRole ?? (caller.isSupervisor ? "supervisor" : "employee");

export function registerCourtsRoutes(app: Express, deps: RegisterDeps): void {
  const auth = deps.requireEmployee();
  const audit = async (
    req: Request,
    input: Omit<AuditEventInput, "actorId" | "role"> & { role?: string },
  ) => {
    if (!deps.recordAudit) return;
    const caller = getCourtCaller(req);
    try {
      await deps.recordAudit({
        actorId: caller.employeeNumber ?? "unknown",
        role: input.role ?? roleFromRequest(req, caller),
        ...input,
      });
    } catch (error) {
      console.warn("[courts] audit write failed:", error);
    }
  };

  app.get(
    "/api/courts/:school/stats",
    auth,
    async (req, res) => {
      const school = pickSchool(req, res);
      if (!school) return;
      try {
        const today = fmtDate(new Date());
        const todayReservations = await courtsStorage.getReservationsByDate(school, today);
        return res.json({
          school,
          today,
          todayCount: todayReservations.length,
          googleCalendarEnabled: isGoogleCalendarEnabled(),
          status: "ok",
          checkedAt: new Date().toISOString(),
        });
      } catch (error) {
        return res.status(500).json({
          school,
          status: "error",
          message: error instanceof Error ? error.message : "Stats fetch failed.",
          checkedAt: new Date().toISOString(),
        });
      }
    },
  );

  app.get(
    "/api/courts/:school/reservations/:date",
    auth,
    async (req, res) => {
      try {
        const school = pickSchool(req, res);
        if (!school) return;
        const date = String(req.params.date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res
            .status(400)
            .json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        const local = await courtsStorage.getReservationsByDate(school, date);

        let googleEvents: any[] = [];
        if (isGoogleCalendarEnabled()) {
          try {
            googleEvents = await getCalendarReservations(school, date);
          } catch (error) {
            console.warn(
              `[courts] Failed to fetch Google Calendar (${school}):`,
              error,
            );
          }
        }

        const reservations = [...local, ...googleEvents];
        await audit(req, {
          action: "COURTS_RESERVATIONS_VIEWED",
          resource: "courts.reservations",
          facilityKey: school,
          payload: { school, date, count: reservations.length },
          resultStatus: "success",
        });
        res.json(reservations);
      } catch (error) {
        console.error(
          "[courts] GET /api/courts/:school/reservations/:date failed:",
          error,
        );
        res.status(500).json({ message: "Failed to fetch reservations" });
      }
    },
  );

  app.get(
    "/api/courts/:school/reservations-month/:yearMonth",
    auth,
    async (req, res) => {
      try {
        const school = pickSchool(req, res);
        if (!school) return;
        const yearMonth = String(req.params.yearMonth);
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
          return res
            .status(400)
            .json({ message: "Invalid yearMonth. Use YYYY-MM." });
        }

        const [yearStr, monthStr] = yearMonth.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const lastDay = new Date(year, month, 0).getDate();
        const startDate = `${yearMonth}-01`;
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

        const local = await courtsStorage.getReservationsByDateRange(
          school,
          startDate,
          endDate,
        );

        let googleEvents: any[] = [];
        if (isGoogleCalendarEnabled()) {
          try {
            googleEvents = await getCalendarReservationsRange(
              school,
              startDate,
              endDate,
            );
          } catch (error) {
            console.warn(
              `[courts] Failed to fetch Google Calendar month (${school}):`,
              error,
            );
          }
        }

        const counts: Record<string, number> = {};
        for (let d = 1; d <= lastDay; d++) {
          counts[`${yearMonth}-${String(d).padStart(2, "0")}`] = 0;
        }
        for (const r of [...local, ...googleEvents]) {
          if (counts[r.date] !== undefined) counts[r.date] += 1;
        }

        await audit(req, {
          action: "COURTS_MONTH_VIEWED",
          resource: "courts.reservations",
          facilityKey: school,
          payload: { school, yearMonth, startDate, endDate, count: local.length + googleEvents.length },
          resultStatus: "success",
        });
        res.json({ yearMonth, counts });
      } catch (error) {
        console.error("[courts] month aggregation failed:", error);
        res.status(500).json({ message: "Failed to fetch month reservations" });
      }
    },
  );

  app.get("/api/courts/:school/search", auth, async (req, res) => {
    try {
      const school = pickSchool(req, res);
      if (!school) return;

      const q = String(req.query.q ?? "").trim();
      if (!q) {
        await audit(req, {
          action: "COURTS_RESERVATION_SEARCHED",
          resource: "courts.search",
          facilityKey: school,
          payload: { school, query: "", count: 0 },
          resultStatus: "success",
        });
        return res.json({ query: "", count: 0, results: [] });
      }

      const today = new Date();
      const defaultStart = new Date(today);
      defaultStart.setDate(defaultStart.getDate() - 90);
      const defaultEnd = new Date(today);
      defaultEnd.setDate(defaultEnd.getDate() + 180);

      const startRaw = String(req.query.startDate ?? "");
      const endRaw = String(req.query.endDate ?? "");
      const startDate = /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
        ? startRaw
        : fmtDate(defaultStart);
      const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
        ? endRaw
        : fmtDate(defaultEnd);

      const local = await courtsStorage.getReservationsByDateRange(
        school,
        startDate,
        endDate,
      );

      let googleEvents: any[] = [];
      if (isGoogleCalendarEnabled()) {
        try {
          googleEvents = await getCalendarReservationsRange(
            school,
            startDate,
            endDate,
          );
        } catch (error) {
          console.warn(
            `[courts] Failed to fetch Google Calendar search (${school}):`,
            error,
          );
        }
      }

      const all = [...local, ...googleEvents];
      const needle = q.toLowerCase();
      const matches = all.filter((r: any) => {
        const name = (r.customerName ?? "").toLowerCase();
        const phone = (r.phone ?? "").toLowerCase();
        const booking = (r.bookingNumber ?? "").toLowerCase();
        return (
          name.includes(needle) ||
          phone.includes(needle) ||
          booking.includes(needle)
        );
      });

      matches.sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.startTime !== b.startTime)
          return a.startTime.localeCompare(b.startTime);
        return a.court - b.court;
      });

      await audit(req, {
        action: "COURTS_RESERVATION_SEARCHED",
        resource: "courts.search",
        facilityKey: school,
        payload: { school, query: q, startDate, endDate, count: matches.length },
        resultStatus: "success",
      });
      res.json({
        query: q,
        startDate,
        endDate,
        count: matches.length,
        results: matches,
      });
    } catch (error) {
      console.error("[courts] Search error:", error);
      res.status(500).json({ message: "搜尋失敗" });
    }
  });

  app.get(
    "/api/courts/:school/admin/reservations",
    auth,
    async (req, res) => {
      try {
        const school = pickSchool(req, res);
        if (!school) return;
        const today = new Date();
        const defaultStart = new Date(today);
        defaultStart.setDate(defaultStart.getDate() - 60);
        const defaultEnd = new Date(today);
        defaultEnd.setDate(defaultEnd.getDate() + 365);

        const startRaw = String(req.query.startDate ?? "");
        const endRaw = String(req.query.endDate ?? "");
        const startDate = /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
          ? startRaw
          : fmtDate(defaultStart);
        const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
          ? endRaw
          : fmtDate(defaultEnd);

        const rows = await courtsStorage.getReservationsByDateRange(
          school,
          startDate,
          endDate,
        );
        await audit(req, {
          action: "COURTS_RESERVATION_ADMIN_LISTED",
          resource: "courts.admin.reservations",
          facilityKey: school,
          payload: { school, startDate, endDate, count: rows.length },
          resultStatus: "success",
        });
        res.json({ startDate, endDate, count: rows.length, results: rows });
      } catch (error) {
        console.error("[courts] admin list failed:", error);
        res.status(500).json({ message: "Failed to fetch reservations" });
      }
    },
  );

  app.post("/api/courts/:school/admin/import", auth, async (req, res) => {
    try {
      const school = pickSchool(req, res);
      if (!school) return;
      const payload = courtBatchImportSchema.parse({ ...req.body, school });

      if (!isValidCourtForSchool(school, payload.court)) {
        return res
          .status(400)
          .json({ message: `場地 ${payload.court} 不屬於 ${school}` });
      }

      const startDate = new Date(`${payload.startDate}T00:00:00`);
      const endDate = new Date(`${payload.endDate}T00:00:00`);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return res.status(400).json({ message: "日期無效" });
      }
      if (endDate < startDate) {
        return res.status(400).json({ message: "結束日期不可早於開始日期" });
      }

      const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      if (toMin(payload.endTime) <= toMin(payload.startTime)) {
        return res.status(400).json({ message: "結束時間需大於開始時間" });
      }

      const created: any[] = [];
      const skipped: { date: string; reason: string }[] = [];
      const wkSet = new Set(payload.weekdays);

      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        if (wkSet.has(cursor.getDay())) {
          const dateStr = fmtDate(cursor);
          const conflict = await courtsStorage.checkConflict(
            school,
            dateStr,
            payload.court,
            payload.startTime,
            payload.endTime,
          );
          if (conflict) {
            skipped.push({ date: dateStr, reason: "已有相同場地時段預約" });
          } else {
            const reservation = await courtsStorage.createReservation({
              school,
              date: dateStr,
              court: payload.court,
              startTime: payload.startTime,
              endTime: payload.endTime,
              customerName: payload.customerName,
              phone: payload.phone || "",
              notes: payload.notes,
              status: payload.status,
              serviceName: payload.serviceName,
              source: "batch",
            });
            created.push(reservation);
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      await audit(req, {
        action: "COURTS_RESERVATION_IMPORTED",
        resource: "courts.admin.import",
        facilityKey: school,
        payload: {
          school,
          court: payload.court,
          startDate: payload.startDate,
          endDate: payload.endDate,
          startTime: payload.startTime,
          endTime: payload.endTime,
          createdCount: created.length,
          skippedCount: skipped.length,
        },
        resultStatus: "success",
      });
      res.json({
        createdCount: created.length,
        skippedCount: skipped.length,
        created,
        skipped,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "參數驗證失敗", errors: error.errors });
      }
      console.error("[courts] Batch import error:", error);
      res.status(500).json({ message: "批次匯入失敗" });
    }
  });

  app.get("/api/courts/:school/admin/sync-logs", auth, async (req, res) => {
    try {
      const school = pickSchool(req, res);
      if (!school) return;
      const limit = Math.min(
        parseInt(String(req.query.limit ?? "50"), 10) || 50,
        200,
      );
      const logs = await courtsStorage.getRecentSyncLogs(school, limit);
      res.json(logs);
    } catch {
      res.status(500).json({ message: "Failed to fetch sync logs" });
    }
  });

  app.get("/api/courts/:school/admin/sync-errors", auth, async (req, res) => {
    try {
      const school = pickSchool(req, res);
      if (!school) return;
      const limit = Math.min(
        parseInt(String(req.query.limit ?? "50"), 10) || 50,
        200,
      );
      const errors = await courtsStorage.getRecentSyncErrors(school, limit);
      res.json(errors);
    } catch {
      res.status(500).json({ message: "Failed to fetch sync errors" });
    }
  });

  app.patch(
    "/api/courts/:school/admin/reservations/:id",
    auth,
    async (req, res) => {
      try {
        const school = pickSchool(req, res);
        if (!school) return;
        const id = String(req.params.id);
        const existing = await courtsStorage.getReservation(id);
        if (!existing) return res.status(404).json({ message: "找不到該預約" });
        if (existing.school !== school) {
          return res.status(403).json({ message: "預約不屬於該學校" });
        }

        const patchSchema = insertCourtReservationSchema.partial().omit({ school: true, source: true });
        const payload = patchSchema.parse(req.body);
        const next = {
          ...existing,
          ...payload,
          school,
          source: existing.source,
        };

        if (!isValidCourtForSchool(school, next.court)) {
          return res
            .status(400)
            .json({ message: `場地 ${next.court} 不屬於 ${school}` });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
          return res.status(400).json({ message: "日期格式須為 YYYY-MM-DD" });
        }
        const toMin = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
        if (!/^\d{2}:\d{2}$/.test(next.startTime) || !/^\d{2}:\d{2}$/.test(next.endTime) || toMin(next.endTime) <= toMin(next.startTime)) {
          return res.status(400).json({ message: "時間格式無效或結束時間未晚於開始時間" });
        }
        const conflict = await courtsStorage.checkConflict(
          school,
          next.date,
          next.court,
          next.startTime,
          next.endTime,
          id,
        );
        if (conflict) {
          return res.status(409).json({ message: "已有相同場地時段預約" });
        }
        const nextStatus = ["confirmed", "pending", "member"].includes(next.status)
          ? (next.status as "confirmed" | "pending" | "member")
          : "confirmed";

        const updated = await courtsStorage.updateReservation(id, {
          date: next.date,
          court: next.court,
          startTime: next.startTime,
          endTime: next.endTime,
          customerName: next.customerName,
          phone: next.phone ?? "",
          notes: next.notes ?? null,
          status: nextStatus,
          serviceName: next.serviceName ?? null,
        });
        await audit(req, {
          action: "COURTS_RESERVATION_UPDATED",
          resource: "courts.reservation",
          resourceId: id,
          facilityKey: school,
          payload: { school, before: existing, after: updated },
          resultStatus: "success",
        });
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "參數驗證失敗", errors: error.errors });
        }
        console.error("[courts] update failed:", error);
        res.status(500).json({ message: "更新失敗" });
      }
    },
  );

  app.delete(
    "/api/courts/:school/admin/reservations/:id",
    auth,
    async (req, res) => {
      try {
        const school = pickSchool(req, res);
        if (!school) return;
        const id = String(req.params.id);
        const r = await courtsStorage.getReservation(id);
        if (!r) return res.status(404).json({ message: "找不到該預約" });
        if (r.school !== school) {
          return res.status(403).json({ message: "預約不屬於該學校" });
        }
        const ok = await courtsStorage.deleteReservation(id);
        if (!ok) return res.status(404).json({ message: "找不到該預約" });
        await audit(req, {
          action: "COURTS_RESERVATION_DELETED",
          resource: "courts.reservation",
          resourceId: id,
          facilityKey: school,
          payload: { school, reservation: r },
          resultStatus: "success",
        });
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "刪除失敗" });
      }
    },
  );
}
