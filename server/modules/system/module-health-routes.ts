import type { Express } from "express";
import { count } from "drizzle-orm";
import type { AppContainer } from "../../app/container";
import { db } from "../../db";
import { notificationHub, registrationCourses, bookingSnapshots } from "@shared/schema";
import { requireRole, requireSession } from "../auth/context";

const moduleTableCheckers: Record<string, () => Promise<number>> = {
  "notification-center": async () => {
    const [row] = await db.select({ n: count() }).from(notificationHub);
    return row?.n ?? 0;
  },
  "registration-courses": async () => {
    const [row] = await db.select({ n: count() }).from(registrationCourses);
    return row?.n ?? 0;
  },
  "booking-snapshot": async () => {
    const [row] = await db.select({ n: count() }).from(bookingSnapshots);
    return row?.n ?? 0;
  },
};

export const registerModuleHealthRoutes = (app: Express, _container: AppContainer) => {
  app.get("/api/bff/system/module-health/:moduleId", requireSession, requireRole("system"), async (req, res) => {
    const moduleId = String(req.params.moduleId ?? "").trim();
    const checker = moduleTableCheckers[moduleId];
    if (!checker) {
      return res.status(404).json({
        moduleId,
        status: "not_registered",
        message: "No health check registered for this module.",
        checkedAt: new Date().toISOString(),
      });
    }
    try {
      const rowCount = await checker();
      return res.json({
        moduleId,
        status: "ok",
        rowCount,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({
        moduleId,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error during health check.",
        checkedAt: new Date().toISOString(),
      });
    }
  });
};
