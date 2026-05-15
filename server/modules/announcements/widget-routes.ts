import type { Express } from "express";
import { requireSession } from "../auth/context";
import {
  getCampaignAnnouncements,
  getImportantAnnouncements,
} from "./widget-service";

function resolveAndAuthorize(
  req: Express["request"] & { workbenchSession?: { activeFacility: string; grantedFacilities: string[] } },
  facilityParam: unknown,
): { facilityKey: string; error?: string } {
  const facilityKey =
    typeof facilityParam === "string" && facilityParam
      ? facilityParam
      : req.workbenchSession?.activeFacility ?? "";

  if (!facilityKey) return { facilityKey: "", error: "facility 為必填" };

  const granted = req.workbenchSession?.grantedFacilities ?? [];
  if (!granted.includes(facilityKey)) {
    return { facilityKey, error: "無此場館的存取權限" };
  }

  return { facilityKey };
}

export function registerAnnouncementWidgetRoutes(app: Express): void {
  app.get(
    "/api/widgets/announcements/important",
    requireSession,
    async (req, res, next) => {
      try {
        const { facilityKey, error } = resolveAndAuthorize(req as any, req.query.facility);
        if (error) return res.status(403).json({ message: error });

        const role =
          typeof req.query.role === "string" ? req.query.role : undefined;
        const limit = Math.min(Number(req.query.limit ?? 5), 20);

        const data = await getImportantAnnouncements(facilityKey, role, limit);
        return res.json({ data, total: data.length, facilityKey });
      } catch (error) {
        return next(error);
      }
    },
  );

  app.get(
    "/api/widgets/announcements/campaigns",
    requireSession,
    async (req, res, next) => {
      try {
        const { facilityKey, error } = resolveAndAuthorize(req as any, req.query.facility);
        if (error) return res.status(403).json({ message: error });

        const limit = Math.min(Number(req.query.limit ?? 5), 20);

        const data = await getCampaignAnnouncements(facilityKey, limit);
        return res.json({ data, total: data.length, facilityKey });
      } catch (error) {
        return next(error);
      }
    },
  );
}
