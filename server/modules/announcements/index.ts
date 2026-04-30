import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { BackendModule } from "../_shared/module";
import { requireSession } from "../auth/context";
import { storage } from "../../storage";
import { env } from "../../shared/config/env";

const acknowledgementSchema = z.object({
  facilityKey: z.string().min(1).optional(),
});

const isGrantedFacility = (req: Request, facilityKey: string) =>
  Boolean(req.workbenchSession?.grantedFacilities.includes(facilityKey));

export const registerAnnouncementRoutes = (app: Express, _container: AppContainer) => {
  app.get("/api/announcements/acknowledgements", requireSession, async (req, res, next) => {
    try {
      if (!env.databaseUrl) {
        return res.json({ items: [] });
      }
      const facilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const items = await storage.listAnnouncementAcknowledgements({ facilityKey, userId: req.workbenchSession!.userId });
      return res.json({ items });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/announcements/:id/ack", requireSession, async (req, res, next) => {
    try {
      const input = acknowledgementSchema.parse(req.body);
      const announcementId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) ?? "";
      if (!announcementId) return res.status(400).json({ message: "Invalid announcement id" });
      const facilityKey = input.facilityKey || req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const acknowledgement = await storage.acknowledgeAnnouncement({
        announcementId,
        facilityKey,
        userId: req.workbenchSession!.userId,
        employeeName: req.workbenchSession!.displayName,
      });
      await storage.recordPortalEvent({
        employeeNumber: req.workbenchSession!.userId,
        employeeName: req.workbenchSession!.displayName,
        facilityKey,
        eventType: "announcement_ack",
        target: announcementId,
        targetLabel: "announcement acknowledgement",
      }).catch(() => undefined);
      return res.status(201).json(acknowledgement);
    } catch (error) {
      return next(error);
    }
  });
};

export const announcementsModule: BackendModule = {
  name: "announcements",
  responsibility: "Announcements, required acknowledgements, supervisor publishing and read-status overview",
};
