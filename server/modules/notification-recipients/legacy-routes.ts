import type { Express, Request } from "express";
import type { AppContainer } from "../../app/container";
import { withCreateMetadata, withUpdateMetadata } from "../../shared/data/write-metadata";
import { storage } from "../../storage";

const legacyWriteActor = (req: Request) => ({
  userId: req.workbenchSession?.userId ?? "legacy-anonymous",
  role: req.workbenchSession?.activeRole ?? "system",
  facilityKey: req.workbenchSession?.activeFacility,
});

const correlationIdFromRequest = (req: Request) => {
  const header = req.headers["x-correlation-id"];
  return Array.isArray(header) ? header[0] : header;
};

export const registerNotificationRecipientLegacyRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/notification-recipients", async (_req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      res.json(recipients);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.post("/api/notification-recipients", async (req, res) => {
    try {
      const { email, label, enabled, notifyNewReport, notifyResolution, facilityKey } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ message: "請提供有效的 email" });
      }
      const recipient = await storage.createRecipient(withCreateMetadata({
        email,
        label: label || null,
        facilityKey: typeof facilityKey === "string" && facilityKey ? facilityKey : undefined,
        enabled: enabled !== false,
        notifyNewReport: notifyNewReport !== false,
        notifyResolution: notifyResolution !== false,
      }, legacyWriteActor(req)));
      const actor = legacyWriteActor(req);
      await container.repositories.telemetry.recordAudit({
        actorId: actor.userId,
        role: actor.role,
        facilityKey: recipient.facilityKey ?? actor.facilityKey,
        action: "NOTIFICATION_RECIPIENT_CREATED",
        resource: "notification_recipients",
        resourceId: String(recipient.id),
        payload: { name: recipient.label ?? null, enabled: recipient.enabled },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.status(201).json(recipient);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.patch("/api/notification-recipients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "無效的 ID" });
      const allowedFields = ["email", "label", "enabled", "notifyNewReport", "notifyResolution"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) sanitized[key] = req.body[key];
      }
      if (sanitized.email !== undefined && (typeof sanitized.email !== "string" || !sanitized.email.includes("@"))) {
        return res.status(400).json({ message: "請提供有效的 email" });
      }
      const actor = legacyWriteActor(req);
      const updated = await storage.updateRecipient(id, withUpdateMetadata(sanitized, actor));
      if (!updated) return res.status(404).json({ message: "找不到此收件者" });
      await container.repositories.telemetry.recordAudit({
        actorId: actor.userId,
        role: actor.role,
        facilityKey: updated.facilityKey ?? actor.facilityKey,
        action: "NOTIFICATION_RECIPIENT_UPDATED",
        resource: "notification_recipients",
        resourceId: String(updated.id),
        payload: { name: updated.label ?? null, enabled: updated.enabled },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.delete("/api/notification-recipients/:id", async (req, res) => {
    try {
      const actor = legacyWriteActor(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "無效的 ID" });
      const existing = (await storage.getAllRecipients()).find((recipient) => recipient.id === id);
      const deleted = await storage.deleteRecipient(id);
      if (!deleted) return res.status(404).json({ message: "找不到此收件者" });
      await container.repositories.telemetry.recordAudit({
        actorId: actor.userId,
        role: actor.role,
        facilityKey: existing?.facilityKey ?? actor.facilityKey,
        action: "NOTIFICATION_RECIPIENT_DELETED",
        resource: "notification_recipients",
        resourceId: String(id),
        payload: { email: existing?.email, name: existing?.label ?? null },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });
};
