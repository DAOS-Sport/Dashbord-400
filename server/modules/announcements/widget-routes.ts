import type { Express } from "express";
import { requireSession } from "../auth/context";
import { getCampaignAnnouncements, getImportantAnnouncements } from "./widget-service";

export function registerAnnouncementWidgetRoutes(app: Express): void {
  app.get("/api/widgets/announcements/important", requireSession, async (req, res, next) => {
    try {
      const facilityKey =
        typeof req.query.facility === "string"
          ? req.query.facility
          : (req.workbenchSession?.activeFacility ?? "");
      const limit = Math.min(
        Number(req.query.limit ?? 5),
        20,
      );
      const data = await getImportantAnnouncements(facilityKey, limit);
      return res.json({ data, total: data.length, facilityKey });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/widgets/announcements/campaigns", requireSession, async (req, res, next) => {
    try {
      const facilityKey =
        typeof req.query.facility === "string"
          ? req.query.facility
          : (req.workbenchSession?.activeFacility ?? "");
      const limit = Math.min(
        Number(req.query.limit ?? 5),
        20,
      );
      const data = await getCampaignAnnouncements(facilityKey, limit);
      return res.json({ data, total: data.length, facilityKey });
    } catch (error) {
      return next(error);
    }
  });
}
