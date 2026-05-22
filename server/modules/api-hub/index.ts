import express, { type Express } from "express";
import type { Server } from "http";
import path from "path";
import { createAppContainer } from "../../app/container";
import { corsMiddleware } from "../../app/http/cors";
import { registerBackendModules } from "../register";
import { registerTelemetryRoutes } from "../telemetry/routes";
import { registerAuthRoutes } from "../auth/routes";
import { registerAnnouncementRoutes } from "../announcements";
import { registerSystemRoutes } from "../system/routes";
import { registerModuleRegistryRoutes } from "../registry/moduleRegistryController";
import { registerHandoverRoutes } from "../handover";
import { registerBffRoutes } from "../bff/routes";
import { registerCollabCoursesRoutes } from "../collab-courses/routes";
import { registerAnomalyLegacyRoutes } from "../anomalies/legacy-routes";
import { registerLegacyRagicAuthRoutes, requireEmployee, requireSupervisor } from "../auth/legacy-ragic-auth";
import { registerExternalProxyLegacyRoutes } from "../external-proxy/legacy-routes";
import { registerNotificationRecipientLegacyRoutes } from "../notification-recipients/legacy-routes";
import { registerPortalHandoverRoutes } from "../portal/handover-routes";
import { registerPortalContentRoutes } from "../portal/content-routes";
import { apiHubErrorHandler } from "./errors";

export { apiRouteManifest, apiRouteManifestGeneratedFrom } from "./route-manifest";
export type { ApiRouteManifestEntry, ApiRouteMethod } from "./route-manifest";

export const registerApiHub = async (_httpServer: Server, app: Express): Promise<void> => {
  app.use(corsMiddleware);

  const container = createAppContainer();
  container.services.ragicCache.start();
  registerBackendModules(container);

  registerTelemetryRoutes(app, container);
  registerAuthRoutes(app, container);
  registerAnnouncementRoutes(app, container);
  registerSystemRoutes(app, container);
  registerModuleRegistryRoutes(app);
  registerHandoverRoutes(app);
  registerBffRoutes(app, container);
  registerCollabCoursesRoutes(app);

  // Block direct static access to work-log photos. They MUST be fetched via
  // the auth-gated proxy at /api/storage/objects/* which enforces facility
  // scoping. This protects mock-mode uploads where bytes also live on disk.
  app.use("/uploads/work-logs", (_req, res) => {
    res.status(403).json({ message: "請改用 /api/storage/objects/ 取得工作日誌照片" });
  });
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  registerAnomalyLegacyRoutes(app, container);
  registerNotificationRecipientLegacyRoutes(app, container);

  const { registerWorkLogRoutes } = await import("../work-logs/routes");
  registerWorkLogRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerLaneRentalRoutes } = await import("../lane-rentals/routes");
  registerLaneRentalRoutes(app, { requireEmployee, requireSupervisor });

  const { registerParkingRoutes } = await import("../parking/routes");
  registerParkingRoutes(app, { requireEmployee, requireSupervisor });

  const { registerAnnouncementWidgetRoutes } = await import("../announcements/widget-routes");
  registerAnnouncementWidgetRoutes(app);

  const { registerCourtsRoutes } = await import("../courts/routes");
  registerCourtsRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerObjectStorageRoutes } = await import("../../replit_integrations/object_storage");
  registerObjectStorageRoutes(app);

  const { registerAnnouncementGroupRoutes } = await import("../announcement-groups/routes");
  registerAnnouncementGroupRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerAnnouncementOverlayRoutes } = await import("../announcement-overlays/routes");
  registerAnnouncementOverlayRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  });

  const { registerLifeguardOperationRoutes } = await import("../lifeguard/routes");
  registerLifeguardOperationRoutes(app, {
    requireEmployee,
    requireSupervisor,
    recordAudit: (event) => container.repositories.telemetry.recordAudit(event),
  }, container);

  registerLegacyRagicAuthRoutes(app);

  app.post("/api/hr-audit", async (_req, res) => {
    res.status(503).json({
      message: "稽核 API 尚未接入，待體育署 API 與 Ragic 慎用名單介接完成後即可使用",
    });
  });

  registerExternalProxyLegacyRoutes(app);
  registerPortalHandoverRoutes(app, container, { requireEmployee, requireSupervisor });
  registerPortalContentRoutes(app, container, { requireEmployee, requireSupervisor });

  const { registerGroupBroadcastRoutes } = await import("../group-broadcasts/routes");
  registerGroupBroadcastRoutes(app, { requireEmployee, requireSupervisor });

  app.use(apiHubErrorHandler);
};
