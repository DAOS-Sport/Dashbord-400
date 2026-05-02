import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import {
  insertDailyTaskTemplateSchema,
  insertLifeguardAssignedTaskSchema,
  insertRecurringTaskTemplateSchema,
  insertWaterQualityScheduleSchema,
  insertWaterQualityStandardSchema,
  insertLifeguardHandoverNoteSchema,
  insertWaterQualityRecordSchema,
  type DailyTaskTemplate,
  type LifeguardAssignedTask,
  type RecurringTaskTemplate,
  type WaterQualitySchedule,
  type WorkLogTaskCompletion,
  type LifeguardHandoverNote,
} from "@shared/schema";

interface CallerProfile {
  employeeNumber: string;
  name: string;
  isSupervisor: boolean;
}

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
}

function getCaller(req: import("express").Request): CallerProfile {
  const caller = (req as unknown as { caller?: CallerProfile }).caller;
  return caller ?? {
    employeeNumber: req.workbenchSession?.userId ?? "unknown",
    name: req.workbenchSession?.displayName ?? "未知員工",
    isSupervisor: !!req.workbenchSession?.grantedRoles?.includes?.("supervisor")
      || !!req.workbenchSession?.grantedRoles?.includes?.("system"),
  };
}

/**
 * Authorize the caller to access the given facilityKey.
 * - Supervisors bypass the check.
 * - For workbench-scoped sessions, the facility must be in grantedFacilities.
 * - For direct employee logins (no workbenchSession, e.g. ragic-login), allow
 *   the request — facility scoping for non-supervisor direct logins is enforced
 *   upstream by the portal facility binding.
 */
function canAccessFacility(req: import("express").Request, caller: CallerProfile, facilityKey: string): boolean {
  if (caller.isSupervisor) return true;
  if (req.workbenchSession) {
    return req.workbenchSession.grantedFacilities?.includes(facilityKey) ?? false;
  }
  return true;
}

function todayInTaipei(): string {
  const now = new Date();
  const taipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const y = taipei.getFullYear();
  const m = String(taipei.getMonth() + 1).padStart(2, "0");
  const d = String(taipei.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayOf(dateStr: string): number {
  // Return 0=Sun..6=Sat
  return new Date(`${dateStr}T00:00:00+08:00`).getDay();
}

function previousShift(shift: "morning" | "noon" | "night"): "morning" | "noon" | "night" {
  if (shift === "morning") return "night";
  if (shift === "noon") return "morning";
  return "noon";
}

/**
 * Returns the (date, shift) pair to read inbound handover notes from.
 * - For morning shift, the previous shift is the previous day's night shift.
 * - For noon and night shifts, the previous shift is the same day.
 */
function previousShiftRef(currentDate: string, currentShift: "morning" | "noon" | "night"): { date: string; shift: "morning" | "noon" | "night" } {
  const prev = previousShift(currentShift);
  if (currentShift === "morning") {
    const d = new Date(`${currentDate}T00:00:00+08:00`);
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, shift: prev };
  }
  return { date: currentDate, shift: prev };
}

function shouldRunRecurring(template: RecurringTaskTemplate, dateStr: string): boolean {
  const days = template.recurrenceDays ?? [];
  if (template.recurrenceType === "daily") return true;
  if (template.recurrenceType === "weekly") {
    if (days.length === 0) return false;
    return days.includes(weekdayOf(dateStr));
  }
  if (template.recurrenceType === "monthly") {
    const dayOfMonth = Number(dateStr.split("-")[2]);
    return days.includes(dayOfMonth);
  }
  return false;
}

function buildTaskItem(
  source: "daily" | "assigned" | "recurring",
  refId: number,
  taskName: string,
  description: string | null,
  inputType: string,
  inputConfig: Record<string, unknown> | null,
  isRequired: boolean,
  completion: WorkLogTaskCompletion | undefined,
) {
  return {
    source,
    refId,
    taskName,
    description,
    inputType,
    inputConfig: inputConfig ?? null,
    isRequired,
    isCompleted: completion?.isCompleted ?? false,
    inputValue: completion?.inputValue ?? null,
    notes: completion?.notes ?? null,
    completedBy: completion?.completedByName ?? null,
    completedAt: completion?.completedAt ?? null,
  };
}

const todayQuerySchema = z.object({
  facilityKey: z.string().min(1),
  shiftType: z.enum(["morning", "noon", "night"]),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const completeTaskSchema = z.object({
  facilityKey: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: z.enum(["morning", "noon", "night"]),
  taskSource: z.enum(["daily", "assigned", "recurring"]),
  taskRefId: z.number().int().positive(),
  taskName: z.string().min(1),
  isCompleted: z.boolean(),
  inputValue: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

const submitSchema = z.object({
  facilityKey: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: z.enum(["morning", "noon", "night"]),
});

const handoverConfirmIdSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerWorkLogRoutes(app: Express, deps: RegisterDeps) {
  const { requireEmployee, requireSupervisor } = deps;

  // ============ Today aggregator ============
  app.get("/api/work-logs/today", requireEmployee(), async (req, res) => {
    try {
      const parsed = todayQuerySchema.safeParse({
        facilityKey: req.query.facilityKey,
        shiftType: req.query.shiftType,
        workDate: req.query.workDate,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
      }
      const caller = getCaller(req);
      const facilityKey = parsed.data.facilityKey;
      if (!canAccessFacility(req, caller, facilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const workDate = parsed.data.workDate ?? todayInTaipei();
      const shiftType = parsed.data.shiftType;
      const prevRef = previousShiftRef(workDate, shiftType);

      const [dailyTemplates, assignedTasks, recurringTemplates, waterSchedules, completions, prevHandover, existingSubmission] = await Promise.all([
        storage.listDailyTaskTemplates({ facilityKey, shiftType }),
        storage.listLifeguardAssignedTasks({ facilityKey, workDate, shiftType, employeeNumber: caller.employeeNumber, status: "active" }),
        storage.listRecurringTaskTemplates({ facilityKey }),
        storage.listWaterQualitySchedules({ facilityKey, shiftType }),
        storage.listTaskCompletions({ facilityKey, workDate, shiftType }),
        storage.listLifeguardHandoverNotes({ facilityKey, workDate: prevRef.date, fromShift: prevRef.shift, toShift: shiftType, limit: 20 }),
        storage.getDailyReportSubmission({ facilityKey, workDate, shiftType, submittedBy: caller.employeeNumber }),
      ]);

      const completionMap = new Map<string, WorkLogTaskCompletion>();
      for (const c of completions) completionMap.set(`${c.taskSource}:${c.taskRefId}`, c);

      const dailyItems = dailyTemplates
        .filter((t) => t.shiftType === "all" || t.shiftType === shiftType)
        .map((t) => buildTaskItem("daily", t.id, t.taskName, t.description, t.inputType, t.inputConfig, t.isRequired,
          completionMap.get(`daily:${t.id}`)));

      const assignedItems = assignedTasks.map((t) => buildTaskItem("assigned", t.id, t.taskName, t.description, t.inputType, t.inputConfig, t.isRequired,
        completionMap.get(`assigned:${t.id}`)));

      const recurringItems = recurringTemplates
        .filter((t) => shouldRunRecurring(t, workDate))
        .filter((t) => t.shiftType === "all" || t.shiftType === shiftType)
        .map((t) => buildTaskItem("recurring", t.id, t.taskName, t.description, t.inputType, t.inputConfig, t.isRequired,
          completionMap.get(`recurring:${t.id}`)));

      // Water quality slots: time-window priority (the spec uses the schedule entries themselves as "slots" that the
      // employee should fill within the shift). We don't write completions for water — they live in waterQualityRecords.
      const waterRecords = await storage.listWaterQualityRecords({ facilityKey, workDate, shiftType });
      const waterSlots = waterSchedules
        .filter((s) => s.shiftType === "all" || s.shiftType === shiftType)
        .map((s) => {
          const matching = waterRecords.find((r) => r.scheduleId === s.id);
          return {
            scheduleId: s.id,
            poolName: s.poolName,
            scheduledTime: s.scheduledTime,
            isCompleted: !!matching,
            recordId: matching?.id ?? null,
            isAbnormal: matching?.isAbnormal ?? false,
            recordedBy: matching?.recordedByName ?? null,
            recordedAt: matching?.recordedAt ?? null,
          };
        });

      const handoverItems = prevHandover.map((h) => ({
        id: h.id,
        category: h.category,
        content: h.content,
        fromShift: h.fromShift,
        authorName: h.authorName,
        createdAt: h.createdAt,
        isConfirmed: h.isConfirmed,
        confirmedByName: h.confirmedByName,
        confirmedAt: h.confirmedAt,
        canConfirm: !h.isConfirmed,
      }));

      const allTasks = [...dailyItems, ...assignedItems, ...recurringItems];
      const requiredTasks = allTasks.filter((t) => t.isRequired);
      const requiredCompletedCount = requiredTasks.filter((t) => t.isCompleted).length;
      const waterRequiredCount = waterSlots.length;
      const waterCompletedCount = waterSlots.filter((s) => s.isCompleted).length;
      const handoverPendingCount = handoverItems.filter((h) => h.canConfirm).length;

      res.json({
        facility: { facilityKey },
        workDate,
        shiftType,
        weekday: weekdayOf(workDate),
        user: { employeeNumber: caller.employeeNumber, name: caller.name },
        progress: {
          totalRequired: requiredTasks.length + waterRequiredCount,
          totalCompleted: requiredCompletedCount + waterCompletedCount,
          tasksRequired: requiredTasks.length,
          tasksCompleted: requiredCompletedCount,
          waterRequired: waterRequiredCount,
          waterCompleted: waterCompletedCount,
          handoverPending: handoverPendingCount,
        },
        sections: {
          waterQuality: { schedules: waterSlots, records: waterRecords },
          dailyTasks: dailyItems,
          assignedTasks: assignedItems,
          recurringTasks: recurringItems,
          handover: handoverItems,
        },
        submission: existingSubmission ?? null,
      });
    } catch (e) {
      console.error("[work-logs] /today failed", e);
      res.status(500).json({ message: "查詢今日工作失敗" });
    }
  });

  // ============ Task completion (upsert) ============
  app.post("/api/work-logs/tasks/complete", requireEmployee(), async (req, res) => {
    try {
      const parsed = completeTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
      }
      const caller = getCaller(req);
      const data = parsed.data;
      if (!canAccessFacility(req, caller, data.facilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const row = await storage.upsertTaskCompletion({
        facilityKey: data.facilityKey,
        workDate: data.workDate,
        shiftType: data.shiftType,
        taskSource: data.taskSource,
        taskRefId: data.taskRefId,
        taskName: data.taskName,
        isCompleted: data.isCompleted,
        inputValue: data.inputValue ?? null,
        notes: data.notes ?? null,
        completedBy: data.isCompleted ? caller.employeeNumber : null,
        completedByName: data.isCompleted ? caller.name : null,
      });
      res.json({ item: row });
    } catch (e) {
      console.error("[work-logs] complete task failed", e);
      res.status(500).json({ message: "更新任務狀態失敗" });
    }
  });

  // ============ Water quality record ============
  app.post("/api/work-logs/water-quality", requireEmployee(), async (req, res) => {
    try {
      const parsed = insertWaterQualityRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "水質資料錯誤", details: parsed.error.flatten() });
      }
      const caller = getCaller(req);
      if (!canAccessFacility(req, caller, parsed.data.facilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      // Determine abnormal vs standards
      const standards = await storage.listWaterQualityStandards({ facilityKey: parsed.data.facilityKey, poolName: parsed.data.poolName });
      let isAbnormal = parsed.data.isAbnormal ?? false;
      const abnormals: string[] = [];
      for (const s of standards) {
        const raw = parsed.data.measurements?.[s.parameterName];
        if (raw === undefined || raw === null || raw === "") continue;
        const num = typeof raw === "number" ? raw : Number(raw);
        if (Number.isNaN(num)) continue;
        if (s.minValue && num < Number(s.minValue)) abnormals.push(`${s.parameterName} 低於 ${s.minValue}`);
        if (s.maxValue && num > Number(s.maxValue)) abnormals.push(`${s.parameterName} 高於 ${s.maxValue}`);
      }
      if (abnormals.length > 0) isAbnormal = true;

      const row = await storage.createWaterQualityRecord({
        ...parsed.data,
        isAbnormal,
        abnormalNote: parsed.data.abnormalNote ?? (abnormals.length > 0 ? abnormals.join("；") : null),
        recordedBy: caller.employeeNumber,
        recordedByName: caller.name,
      });
      res.json({ item: row });
    } catch (e) {
      console.error("[work-logs] water-quality failed", e);
      res.status(500).json({ message: "儲存水質紀錄失敗" });
    }
  });

  // ============ Lifeguard handover note ============
  app.post("/api/work-logs/handover", requireEmployee(), async (req, res) => {
    try {
      const parsed = insertLifeguardHandoverNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "交接資料錯誤", details: parsed.error.flatten() });
      }
      const caller = getCaller(req);
      if (!canAccessFacility(req, caller, parsed.data.facilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const row = await storage.createLifeguardHandoverNote({
        ...parsed.data,
        authorEmployeeNumber: caller.employeeNumber,
        authorName: caller.name,
      });
      res.json({ item: row });
    } catch (e) {
      console.error("[work-logs] handover create failed", e);
      res.status(500).json({ message: "建立交接事項失敗" });
    }
  });

  app.post("/api/work-logs/handover/:id/confirm", requireEmployee(), async (req, res) => {
    try {
      const parsed = handoverConfirmIdSchema.safeParse({ id: req.params.id });
      if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
      const caller = getCaller(req);
      const existing = await storage.getLifeguardHandoverNoteById(parsed.data.id);
      if (!existing) return res.status(404).json({ message: "找不到交接事項" });
      if (!canAccessFacility(req, caller, existing.facilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const row = await storage.confirmLifeguardHandoverNote(parsed.data.id, {
        employeeNumber: caller.employeeNumber,
        name: caller.name,
      });
      if (!row) return res.status(404).json({ message: "找不到交接事項" });
      res.json({ item: row });
    } catch (e) {
      console.error("[work-logs] handover confirm failed", e);
      res.status(500).json({ message: "確認交接失敗" });
    }
  });

  // ============ Submit daily report ============
  app.post("/api/work-logs/submit", requireEmployee(), async (req, res) => {
    try {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
      const caller = getCaller(req);
      const { facilityKey, workDate, shiftType } = parsed.data;
      if (!canAccessFacility(req, caller, facilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const prevRef = previousShiftRef(workDate, shiftType);

      const [dailyTemplates, assignedTasks, recurringTemplates, waterSchedules, completions, waterRecords, prevHandover] = await Promise.all([
        storage.listDailyTaskTemplates({ facilityKey, shiftType }),
        storage.listLifeguardAssignedTasks({ facilityKey, workDate, shiftType, employeeNumber: caller.employeeNumber, status: "active" }),
        storage.listRecurringTaskTemplates({ facilityKey }),
        storage.listWaterQualitySchedules({ facilityKey, shiftType }),
        storage.listTaskCompletions({ facilityKey, workDate, shiftType }),
        storage.listWaterQualityRecords({ facilityKey, workDate, shiftType }),
        storage.listLifeguardHandoverNotes({ facilityKey, workDate: prevRef.date, fromShift: prevRef.shift, toShift: shiftType, limit: 50 }),
      ]);

      const completionMap = new Map<string, WorkLogTaskCompletion>();
      for (const c of completions) completionMap.set(`${c.taskSource}:${c.taskRefId}`, c);

      const missing: Array<{ source: string; taskName: string }> = [];
      const checkRequired = (source: string, refId: number, name: string, isRequired: boolean) => {
        if (!isRequired) return;
        const c = completionMap.get(`${source}:${refId}`);
        if (!c?.isCompleted) missing.push({ source, taskName: name });
      };

      for (const t of dailyTemplates.filter((x) => x.shiftType === "all" || x.shiftType === shiftType)) {
        checkRequired("daily", t.id, t.taskName, t.isRequired);
      }
      for (const t of assignedTasks) checkRequired("assigned", t.id, t.taskName, t.isRequired);
      for (const t of recurringTemplates.filter((x) => shouldRunRecurring(x, workDate)).filter((x) => x.shiftType === "all" || x.shiftType === shiftType)) {
        checkRequired("recurring", t.id, t.taskName, t.isRequired);
      }
      for (const s of waterSchedules.filter((x) => x.shiftType === "all" || x.shiftType === shiftType)) {
        const matched = waterRecords.find((r) => r.scheduleId === s.id);
        if (!matched) missing.push({ source: "water", taskName: `${s.poolName} ${s.scheduledTime}` });
      }
      const unconfirmedHandover = prevHandover.filter((h) => !h.isConfirmed);
      for (const h of unconfirmedHandover) {
        missing.push({ source: "handover", taskName: `未確認交接：${h.content.slice(0, 20)}` });
      }

      if (missing.length > 0) {
        return res.status(400).json({ message: "尚有未完成項目，無法送出", missing });
      }

      const totalRequired = dailyTemplates.length + assignedTasks.length + recurringTemplates.length + waterSchedules.length;
      const totalCompleted = completions.filter((c) => c.isCompleted).length + waterRecords.length;

      const row = await storage.createDailyReportSubmission({
        facilityKey, workDate, shiftType,
        submittedBy: caller.employeeNumber,
        submittedByName: caller.name,
        status: "submitted",
        totalRequired,
        totalCompleted,
        summary: {
          dailyTaskCount: dailyTemplates.length,
          assignedTaskCount: assignedTasks.length,
          recurringTaskCount: recurringTemplates.length,
          waterQualityCount: waterRecords.length,
          abnormalCount: waterRecords.filter((r) => r.isAbnormal).length,
        },
      });
      res.json({ item: row });
    } catch (e) {
      console.error("[work-logs] submit failed", e);
      res.status(500).json({ message: "送出日報失敗" });
    }
  });

  // ============ Admin / Supervisor: templates CRUD ============
  app.get("/api/work-logs/admin/daily-templates", requireSupervisor(), async (req, res) => {
    const facilityKey = String(req.query.facilityKey || "");
    if (!facilityKey) return res.status(400).json({ message: "facilityKey 必填" });
    res.json({ items: await storage.listDailyTaskTemplates({ facilityKey, includeInactive: true }) });
  });

  app.post("/api/work-logs/admin/daily-templates", requireSupervisor(), async (req, res) => {
    const parsed = insertDailyTaskTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
    res.json({ item: await storage.createDailyTaskTemplate(parsed.data) });
  });

  app.patch("/api/work-logs/admin/daily-templates/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const row = await storage.updateDailyTaskTemplate(id, req.body);
    if (!row) return res.status(404).json({ message: "找不到項目" });
    res.json({ item: row });
  });

  app.delete("/api/work-logs/admin/daily-templates/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteDailyTaskTemplate(id);
    if (!ok) return res.status(404).json({ message: "找不到項目" });
    res.json({ ok: true });
  });

  app.get("/api/work-logs/admin/assigned-tasks", requireSupervisor(), async (req, res) => {
    const facilityKey = String(req.query.facilityKey || "");
    if (!facilityKey) return res.status(400).json({ message: "facilityKey 必填" });
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json({ items: await storage.listLifeguardAssignedTasks({ facilityKey, status }) });
  });

  app.post("/api/work-logs/admin/assigned-tasks", requireSupervisor(), async (req, res) => {
    const parsed = insertLifeguardAssignedTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
    const caller = getCaller(req);
    res.json({ item: await storage.createLifeguardAssignedTask({
      ...parsed.data,
      assignedBy: caller.employeeNumber,
      assignedByName: caller.name,
    }) });
  });

  app.patch("/api/work-logs/admin/assigned-tasks/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const row = await storage.updateLifeguardAssignedTask(id, req.body);
    if (!row) return res.status(404).json({ message: "找不到項目" });
    res.json({ item: row });
  });

  app.delete("/api/work-logs/admin/assigned-tasks/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteLifeguardAssignedTask(id);
    if (!ok) return res.status(404).json({ message: "找不到項目" });
    res.json({ ok: true });
  });

  app.get("/api/work-logs/admin/recurring-templates", requireSupervisor(), async (req, res) => {
    const facilityKey = String(req.query.facilityKey || "");
    if (!facilityKey) return res.status(400).json({ message: "facilityKey 必填" });
    res.json({ items: await storage.listRecurringTaskTemplates({ facilityKey, includeInactive: true }) });
  });

  app.post("/api/work-logs/admin/recurring-templates", requireSupervisor(), async (req, res) => {
    const parsed = insertRecurringTaskTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
    res.json({ item: await storage.createRecurringTaskTemplate(parsed.data) });
  });

  app.patch("/api/work-logs/admin/recurring-templates/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const row = await storage.updateRecurringTaskTemplate(id, req.body);
    if (!row) return res.status(404).json({ message: "找不到項目" });
    res.json({ item: row });
  });

  app.delete("/api/work-logs/admin/recurring-templates/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteRecurringTaskTemplate(id);
    if (!ok) return res.status(404).json({ message: "找不到項目" });
    res.json({ ok: true });
  });

  app.get("/api/work-logs/admin/water-schedules", requireSupervisor(), async (req, res) => {
    const facilityKey = String(req.query.facilityKey || "");
    if (!facilityKey) return res.status(400).json({ message: "facilityKey 必填" });
    res.json({ items: await storage.listWaterQualitySchedules({ facilityKey, includeInactive: true }) });
  });

  app.post("/api/work-logs/admin/water-schedules", requireSupervisor(), async (req, res) => {
    const parsed = insertWaterQualityScheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
    res.json({ item: await storage.createWaterQualitySchedule(parsed.data) });
  });

  app.patch("/api/work-logs/admin/water-schedules/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const row = await storage.updateWaterQualitySchedule(id, req.body);
    if (!row) return res.status(404).json({ message: "找不到項目" });
    res.json({ item: row });
  });

  app.delete("/api/work-logs/admin/water-schedules/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteWaterQualitySchedule(id);
    if (!ok) return res.status(404).json({ message: "找不到項目" });
    res.json({ ok: true });
  });

  app.get("/api/work-logs/admin/water-standards", requireSupervisor(), async (req, res) => {
    const facilityKey = String(req.query.facilityKey || "");
    if (!facilityKey) return res.status(400).json({ message: "facilityKey 必填" });
    res.json({ items: await storage.listWaterQualityStandards({ facilityKey, includeInactive: true }) });
  });

  app.post("/api/work-logs/admin/water-standards", requireSupervisor(), async (req, res) => {
    const parsed = insertWaterQualityStandardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "參數錯誤", details: parsed.error.flatten() });
    res.json({ item: await storage.createWaterQualityStandard(parsed.data) });
  });

  app.patch("/api/work-logs/admin/water-standards/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const row = await storage.updateWaterQualityStandard(id, req.body);
    if (!row) return res.status(404).json({ message: "找不到項目" });
    res.json({ item: row });
  });

  app.delete("/api/work-logs/admin/water-standards/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteWaterQualityStandard(id);
    if (!ok) return res.status(404).json({ message: "找不到項目" });
    res.json({ ok: true });
  });

  // Supervisor review queue
  app.get("/api/work-logs/admin/submissions", requireSupervisor(), async (req, res) => {
    const facilityKey = req.query.facilityKey ? String(req.query.facilityKey) : undefined;
    const workDate = req.query.workDate ? String(req.query.workDate) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json({ items: await storage.listDailyReportSubmissions({ facilityKey, workDate, status, limit: 200 }) });
  });

  app.post("/api/work-logs/admin/submissions/:id/approve", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const caller = getCaller(req);
    const row = await storage.updateDailyReportSubmissionReview(id, {
      status: "approved",
      reviewedBy: caller.employeeNumber,
      reviewedByName: caller.name,
      reviewNote: typeof req.body?.reviewNote === "string" ? req.body.reviewNote : null,
    });
    if (!row) return res.status(404).json({ message: "找不到日報" });
    res.json({ item: row });
  });

  app.post("/api/work-logs/admin/submissions/:id/return", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const caller = getCaller(req);
    const row = await storage.updateDailyReportSubmissionReview(id, {
      status: "returned",
      reviewedBy: caller.employeeNumber,
      reviewedByName: caller.name,
      reviewNote: typeof req.body?.reviewNote === "string" ? req.body.reviewNote : "請補正",
    });
    if (!row) return res.status(404).json({ message: "找不到日報" });
    res.json({ item: row });
  });
}

// Re-export some helpers for tests / debugging
export { todayInTaipei, weekdayOf, previousShift, shouldRunRecurring };
export type { DailyTaskTemplate, LifeguardAssignedTask, RecurringTaskTemplate, WaterQualitySchedule, LifeguardHandoverNote };
