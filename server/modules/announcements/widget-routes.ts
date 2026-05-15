import type { Express, Request } from "express";
import { requireSession } from "../auth/context";
import {
  getCampaignAnnouncements,
  getImportantAnnouncements,
} from "./widget-service";

// Resolve facilityKey from query param or session, then verify access.
// Uses Express Request which already has workbenchSession via declaration merging
// in server/modules/auth/context.ts — no `any` cast needed.
function resolveAndAuthorize(
  req: Request,
  facilityParam: unknown,
): { facilityKey: string; statusCode: number; error?: string } {
  const facilityKey =
    typeof facilityParam === "string" && facilityParam
      ? facilityParam
      : req.workbenchSession?.activeFacility ?? "";

  if (!facilityKey) {
    return { facilityKey: "", statusCode: 400, error: "facility 為必填" };
  }

  const granted = req.workbenchSession?.grantedFacilities ?? [];
  if (!granted.includes(facilityKey)) {
    return { facilityKey, statusCode: 403, error: "無此場館的存取權限" };
  }

  return { facilityKey, statusCode: 200 };
}

export function registerAnnouncementWidgetRoutes(app: Express): void {
  app.get(
    "/api/widgets/announcements/important",
    requireSession,
    async (req: Request, res, next) => {
      try {
        const { facilityKey, statusCode, error } = resolveAndAuthorize(
          req,
          req.query.facility,
        );
        if (error) return res.status(statusCode).json({ message: error });

        const role =
          typeof req.query.role === "string" ? req.query.role : undefined;
        const limit = Math.min(
          Number(req.query.limit ?? 5) || 5,
          20,
        );

        const data = await getImportantAnnouncements(facilityKey, role, limit);
        return res.json({ data, total: data.length, facilityKey });
      } catch (err) {
        return next(err);
      }
    },
  );

  app.get(
    "/api/widgets/announcements/campaigns",
    requireSession,
    async (req: Request, res, next) => {
      try {
        const { facilityKey, statusCode, error } = resolveAndAuthorize(
          req,
          req.query.facility,
        );
        if (error) return res.status(statusCode).json({ message: error });

        const limit = Math.min(
          Number(req.query.limit ?? 5) || 5,
          20,
        );

        const data = await getCampaignAnnouncements(facilityKey, limit);
        return res.json({ data, total: data.length, facilityKey });
      } catch (err) {
        return next(err);
      }
    },
  );
}
