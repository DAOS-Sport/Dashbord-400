import type { Express } from "express";
import type { UiEventDto, ClientErrorDto } from "@shared/telemetry/events";
import type { AppContainer } from "../../app/container";
import { allowTokenBucket } from "../../shared/security/rate-limit";

export const registerTelemetryRoutes = (app: Express, container: AppContainer) => {
  app.post("/api/telemetry/ui-events", async (req, res) => {
    const key = req.workbenchSession?.userId || req.ip || "anonymous";
    if (!allowTokenBucket(`ui-events:${key}`, 10, 1000)) {
      return res.status(429).json({ message: "Too many telemetry events" });
    }

    const event = req.body as UiEventDto;
    await container.repositories.telemetry.recordUiEvent({
      ...event,
      userId: req.workbenchSession?.userId,
      role: req.workbenchSession?.activeRole,
      facilityKey: req.workbenchSession?.activeFacility,
      receivedAt: new Date().toISOString(),
    });

    return res.status(202).json({ accepted: true });
  });

  app.post("/api/telemetry/client-error", async (req, res) => {
    const error = req.body as ClientErrorDto;
    await container.repositories.telemetry.recordClientError({
      ...error,
      userId: req.workbenchSession?.userId,
      role: req.workbenchSession?.activeRole,
      facilityKey: req.workbenchSession?.activeFacility,
      receivedAt: new Date().toISOString(),
    });

    await container.repositories.telemetry.recordAudit({
      actorId: req.workbenchSession?.userId,
      role: req.workbenchSession?.activeRole,
      facilityKey: req.workbenchSession?.activeFacility,
      action: "CLIENT_ERROR_REPORTED",
      resource: "telemetry.client-error",
      payload: { message: error.message, page: error.page, componentId: error.componentId },
      correlationId: error.correlationId,
      resultStatus: "success",
    });

    return res.status(202).json({ accepted: true });
  });

  app.get("/api/bff/system/ui-event-overview", async (_req, res) => {
    return res.json(await container.repositories.telemetry.getUiEventOverview());
  });

  app.get("/api/telemetry/module-events", async (_req, res) => {
    const overview = await container.repositories.telemetry.getUiEventOverview();
    return res.json({
      items: overview.latestEvents.map((event) => ({
        eventType: event.eventType,
        moduleId: typeof event.payload === "object" && event.payload && "moduleId" in event.payload
          ? (event.payload as { moduleId?: string }).moduleId
          : undefined,
        routePath: event.page,
        role: event.role,
        facilityKey: event.facilityKey,
        occurredAt: event.occurredAt ?? event.receivedAt,
      })),
      total: overview.totalEvents,
    });
  });
};
