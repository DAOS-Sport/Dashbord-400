import type { Express } from "express";
import { requireEmployee } from "../auth/legacy-ragic-auth";
import { fetchSwimSchedules, fetchSwimVenues } from "./client";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const registerCollabCoursesRoutes = (app: Express) => {
  app.get("/api/bff/collab-courses/venues", requireEmployee(), async (_req, res) => {
    try {
      const venues = await fetchSwimVenues();
      res.json({ venues, fetchedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: "偕同課場館資料讀取失敗" });
    }
  });

  app.get("/api/bff/collab-courses/schedules", requireEmployee(), async (req, res) => {
    const { startDate, endDate, venueId } = req.query as Record<string, string>;

    if (!startDate || !dateRe.test(startDate) || !endDate || !dateRe.test(endDate)) {
      return res.status(400).json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
    }

    const from = new Date(startDate);
    const to = new Date(endDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return res.status(400).json({ error: "Invalid date range" });
    }

    try {
      const [schedules, venues] = await Promise.all([
        fetchSwimSchedules(startDate, endDate),
        fetchSwimVenues(),
      ]);

      const filtered = venueId
        ? schedules.filter((s) => s.venueId === venueId)
        : schedules;

      res.json({
        schedules: filtered,
        venues,
        startDate,
        endDate,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: "偕同課課表資料讀取失敗" });
    }
  });
};
