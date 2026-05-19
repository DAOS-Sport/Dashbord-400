import type { Express } from "express";
import { count, desc } from "drizzle-orm";
import type { AppContainer } from "../../app/container";
import { db } from "../../db";
import { notificationHub, registrationCourses, bookingSnapshots } from "@shared/schema";
import { requireRole, requireSession } from "../auth/context";

type ModuleHealthResult = {
  moduleId: string;
  status: "degraded" | "error" | "not_registered";
  tableExists: boolean;
  rowCount: number;
  latestAt?: string | null;
  note: string;
  checkedAt: string;
};

const moduleCheckers: Record<string, () => Promise<Omit<ModuleHealthResult, "moduleId" | "checkedAt">>> = {
  "notification-center": async () => {
    const [row] = await db.select({ n: count() }).from(notificationHub);
    const rowCount = row?.n ?? 0;
    return {
      status: "degraded",
      tableExists: true,
      rowCount,
      note: `notification_hub 資料表已建立，目前 ${rowCount} 筆；通知功能待後續實作接入事件來源。`,
    };
  },
  "registration-courses": async () => {
    const [row] = await db.select({ n: count() }).from(registrationCourses);
    const rowCount = row?.n ?? 0;
    return {
      status: "degraded",
      tableExists: true,
      rowCount,
      note: `registration_courses 資料表已建立，目前 ${rowCount} 筆；課程報名功能待後續外部 provider 接入。`,
    };
  },
  "booking-snapshot": async () => {
    const [countRow] = await db.select({ n: count() }).from(bookingSnapshots);
    const [latestRow] = await db
      .select({ snapshotAt: bookingSnapshots.snapshotAt })
      .from(bookingSnapshots)
      .orderBy(desc(bookingSnapshots.snapshotAt))
      .limit(1);
    const rowCount = countRow?.n ?? 0;
    const latestAt = latestRow?.snapshotAt ? latestRow.snapshotAt.toISOString() : null;
    return {
      status: "degraded",
      tableExists: true,
      rowCount,
      latestAt,
      note: `booking_snapshots 資料表已建立，目前 ${rowCount} 筆${latestAt ? `，最新快照 ${latestAt}` : "，尚無快照資料"}；預約快照功能待 booking adapter 接入。`,
    };
  },
};

export const registerModuleHealthRoutes = (app: Express, _container: AppContainer) => {
  app.get("/api/bff/system/module-health/:moduleId", requireSession, requireRole("system"), async (req, res) => {
    const moduleId = String(req.params.moduleId ?? "").trim();
    const checker = moduleCheckers[moduleId];
    if (!checker) {
      return res.status(404).json({
        moduleId,
        status: "not_registered",
        tableExists: false,
        rowCount: 0,
        note: "此模組 ID 尚未登記 health check。",
        checkedAt: new Date().toISOString(),
      } satisfies ModuleHealthResult);
    }
    try {
      const result = await checker();
      return res.json({
        moduleId,
        ...result,
        checkedAt: new Date().toISOString(),
      } satisfies ModuleHealthResult);
    } catch (error) {
      return res.status(500).json({
        moduleId,
        status: "error",
        tableExists: false,
        rowCount: 0,
        note: error instanceof Error ? error.message : "Health check 執行時發生未知錯誤。",
        checkedAt: new Date().toISOString(),
      } satisfies ModuleHealthResult);
    }
  });
};
