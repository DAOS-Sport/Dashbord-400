import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { corsMiddleware } from "./app/http/cors";
import { registerNewArchitectureRoutes } from "./app/http/register-routes";
import { registerAnomalyLegacyRoutes } from "./modules/anomalies/legacy-routes";
import { registerLegacyRagicAuthRoutes, requireEmployee, requireSupervisor } from "./modules/auth/legacy-ragic-auth";
import { registerExternalProxyLegacyRoutes } from "./modules/external-proxy/legacy-routes";
import { registerNotificationRecipientLegacyRoutes } from "./modules/notification-recipients/legacy-routes";
import { registerPortalHandoverRoutes } from "./modules/portal/handover-routes";
import { registerPortalContentRoutes } from "./modules/portal/content-routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(corsMiddleware);

  const container = registerNewArchitectureRoutes(httpServer, app);

  // Block direct static access to work-log photos. They MUST be fetched via
  // the auth-gated proxy at /api/storage/objects/* which enforces facility
  // scoping. This protects mock-mode uploads where bytes also live on disk.
  app.use("/uploads/work-logs", (_req, res) => {
    res.status(403).json({ message: "請改用 /api/storage/objects/ 取得工作日誌照片" });
  });
  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  registerAnomalyLegacyRoutes(app, container);

  registerNotificationRecipientLegacyRoutes(app, container);

  // Mount Work Logs (工作日誌) module
  const { registerWorkLogRoutes } = await import("./modules/work-logs/routes");
  registerWorkLogRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerLaneRentalRoutes } = await import("./modules/lane-rentals/routes");
  registerLaneRentalRoutes(app, { requireEmployee, requireSupervisor });

  const { registerParkingRoutes } = await import("./modules/parking/routes");
  registerParkingRoutes(app, { requireEmployee, requireSupervisor });

  const { registerAnnouncementWidgetRoutes } = await import("./modules/announcements/widget-routes");
  registerAnnouncementWidgetRoutes(app);

  const { registerCourtsRoutes } = await import("./modules/courts/routes");
  registerCourtsRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  // Object Storage routes (presigned upload + /objects/:path proxy).
  const { registerObjectStorageRoutes } = await import("./replit_integrations/object_storage");
  registerObjectStorageRoutes(app);

  const { registerAnnouncementGroupRoutes } = await import("./modules/announcement-groups/routes");
  registerAnnouncementGroupRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerAnnouncementOverlayRoutes } = await import("./modules/announcement-overlays/routes");
  registerAnnouncementOverlayRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerLifeguardOperationRoutes } = await import("./modules/lifeguard/routes");
  registerLifeguardOperationRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  }, container);

  registerLegacyRagicAuthRoutes(app);

  app.post("/api/hr-audit", async (req, res) => {
    res.status(503).json({
      message: "稽核 API 尚未接入，待體育署 API 與 Ragic 慎用名單介接完成後即可使用",
    });
  });

  registerExternalProxyLegacyRoutes(app);

  registerPortalHandoverRoutes(app, container, { requireEmployee, requireSupervisor });


  registerPortalContentRoutes(app, container, { requireEmployee, requireSupervisor });

  const { registerGroupBroadcastRoutes } = await import("./modules/group-broadcasts/routes");
  registerGroupBroadcastRoutes(app, { requireEmployee, requireSupervisor });

  return httpServer;
}
