import type { Express } from "express";
import { requireEmployee } from "../auth/legacy-ragic-auth";
import { fetchVenues, fetchSchedules } from "./client";

export function registerCollabCoursesRoutes(app: Express) {
  app.get("/api/bff/collab-courses/venues", requireEmployee(), async (_req, res) => {
    try {
      const venues = await fetchVenues();
      res.json(venues);
    } catch (err) {
      res.status(502).json({ message: "無法取得場館清單", error: String(err) });
    }
  });

  app.get("/api/bff/collab-courses/schedules", requireEmployee(), async (req, res) => {
    const { startDate, endDate, venueId } = req.query as Record<string, string>;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }
    try {
      const entries = await fetchSchedules(startDate, endDate, venueId || undefined);
      res.json(entries);
    } catch (err) {
      res.status(502).json({ message: "無法取得課表", error: String(err) });
    }
  });
}
