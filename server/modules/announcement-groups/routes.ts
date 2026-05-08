import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { facilityLineGroups } from "@shared/domain/facilities";
import { insertFacilityAnnouncementGroupSchema } from "@shared/schema";
import type { AuditEventInput } from "../../shared/telemetry/audit-writer";
import { env } from "../../shared/config/env";
import { storage } from "../../storage";
import { clearLineMessagesCache, fetchLineMessages } from "./client";
import { readFacilityLineAnnouncements } from "./service";

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
  recordAudit?: (event: AuditEventInput) => Promise<void>;
}

type AnnouncementCaller = {
  employeeNumber?: string;
  name?: string;
  isSupervisor?: boolean;
};

const groupQuerySchema = z.object({
  facilityKey: z.string().min(1),
  hours: z.coerce.number().int().min(1).max(168).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const idParamSchema = z.coerce.number().int().positive();

const isFacilityKey = (value: string) =>
  facilityLineGroups.some((facility) => facility.facilityKey === value);

const getCaller = (req: Request): AnnouncementCaller => {
  const caller = (req as unknown as { caller?: AnnouncementCaller }).caller;
  return caller ?? {
    employeeNumber: req.workbenchSession?.userId,
    name: req.workbenchSession?.displayName,
    isSupervisor: req.workbenchSession?.grantedRoles?.includes("supervisor") || req.workbenchSession?.grantedRoles?.includes("system"),
  };
};

const canAccessFacility = (req: Request, facilityKey: string) => {
  if (req.workbenchSession?.grantedRoles?.includes("system")) return true;
  if (req.workbenchSession?.grantedRoles?.includes("supervisor")) return true;
  return req.workbenchSession?.grantedFacilities?.includes(facilityKey) ?? true;
};

const correlationIdFromRequest = (req: Request) => {
  const header = req.headers["x-correlation-id"];
  return Array.isArray(header) ? header[0] : header;
};

export function registerAnnouncementGroupRoutes(app: Express, deps: RegisterDeps): void {
  const audit = async (
    req: Request,
    input: Omit<AuditEventInput, "actorId" | "role"> & { role?: string },
  ) => {
    if (!deps.recordAudit) return;
    const caller = getCaller(req);
    try {
      await deps.recordAudit({
        actorId: caller.employeeNumber ?? "unknown",
        role: input.role ?? req.workbenchSession?.activeRole ?? (caller.isSupervisor ? "supervisor" : "employee"),
        correlationId: correlationIdFromRequest(req),
        ...input,
      });
    } catch (error) {
      console.warn("[announcement-groups] audit write failed:", error);
    }
  };

  app.get("/api/integrations/announcement-groups/messages", deps.requireEmployee(), async (req, res) => {
    const parsed = groupQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "查詢參數錯誤", errors: parsed.error.flatten() });
    const { facilityKey, hours, limit } = parsed.data;
    if (!isFacilityKey(facilityKey)) return res.status(400).json({ message: "未知場館" });
    if (!canAccessFacility(req, facilityKey)) return res.status(403).json({ message: "無此館別權限" });

    try {
      const payload = await readFacilityLineAnnouncements({ facilityKey, hours, limit });
      await audit(req, {
        action: "ANNOUNCEMENT_GROUP_MESSAGES_VIEWED",
        resource: "facility_announcement_groups",
        facilityKey,
        payload: { groupCount: payload.groups.length, announcementCount: payload.announcements.length, connected: payload.sourceStatus.connected },
        resultStatus: "success",
      });
      res.json(payload);
    } catch (error) {
      await audit(req, {
        action: "ANNOUNCEMENT_GROUP_MESSAGES_VIEWED",
        resource: "facility_announcement_groups",
        facilityKey,
        payload: { error: error instanceof Error ? error.message : "unknown" },
        resultStatus: "failure",
      });
      console.error("[announcement-groups] employee message fetch failed", error);
      res.status(502).json({ error: "公告群組資料暫時無法取得", code: "UPSTREAM_ERROR" });
    }
  });

  app.get("/api/admin/announcement-groups", deps.requireSupervisor(), async (req, res) => {
    const facilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined;
    const isActive = req.query.isActive === undefined ? undefined : String(req.query.isActive) === "true";
    const items = await storage.listAnnouncementGroups({ facilityKey, isActive });
    res.json({
      items,
      sourceStatus: {
        connected: Boolean(env.lineBotAdminToken),
        errorMessage: env.lineBotAdminToken ? null : "LINE_BOT_ADMIN_TOKEN 未設定",
      },
    });
  });

  app.post("/api/admin/announcement-groups", deps.requireSupervisor(), async (req, res) => {
    const caller = getCaller(req);
    const parsed = insertFacilityAnnouncementGroupSchema.safeParse({
      ...req.body,
      createdBy: req.body?.createdBy ?? caller.employeeNumber ?? req.workbenchSession?.userId ?? null,
    });
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    try {
      const created = await storage.createAnnouncementGroup(parsed.data);
      await audit(req, {
        action: "ANNOUNCEMENT_GROUP_CREATED",
        resource: "facility_announcement_groups",
        resourceId: String(created.id),
        facilityKey: created.facilityKey,
        payload: { label: created.label, lineGroupId: created.lineGroupId, isActive: created.isActive },
        resultStatus: "success",
      });
      res.status(201).json(created);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ message: "此場館已綁定同一個 LINE 群組" });
      console.error("[announcement-groups] create failed", error);
      res.status(500).json({ message: "建立失敗" });
    }
  });

  app.patch("/api/admin/announcement-groups/:id", deps.requireSupervisor(), async (req, res) => {
    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "id 錯誤" });
    const parsed = insertFacilityAnnouncementGroupSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const { createdBy: _createdBy, ...patch } = parsed.data;
    const updated = await storage.updateAnnouncementGroup(id.data, patch);
    if (!updated) return res.status(404).json({ message: "找不到公告群組綁定" });
    await audit(req, {
      action: "ANNOUNCEMENT_GROUP_UPDATED",
      resource: "facility_announcement_groups",
      resourceId: String(updated.id),
      facilityKey: updated.facilityKey,
      payload: { patch },
      resultStatus: "success",
    });
    res.json(updated);
  });

  app.delete("/api/admin/announcement-groups/:id", deps.requireSupervisor(), async (req, res) => {
    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "id 錯誤" });
    const existing = await storage.getAnnouncementGroupById(id.data);
    if (!existing) return res.status(404).json({ message: "找不到公告群組綁定" });
    const ok = await storage.deleteAnnouncementGroup(id.data);
    if (!ok) return res.status(404).json({ message: "找不到公告群組綁定" });
    await audit(req, {
      action: "ANNOUNCEMENT_GROUP_DELETED",
      resource: "facility_announcement_groups",
      resourceId: String(existing.id),
      facilityKey: existing.facilityKey,
      payload: { label: existing.label, lineGroupId: existing.lineGroupId },
      resultStatus: "success",
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/announcement-groups/:id/test-fetch", deps.requireSupervisor(), async (req, res) => {
    const id = idParamSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "id 錯誤" });
    const group = await storage.getAnnouncementGroupById(id.data);
    if (!group) return res.status(404).json({ message: "找不到公告群組綁定" });

    clearLineMessagesCache();
    try {
      const response = await fetchLineMessages({
        groupId: group.lineGroupId,
        hours: group.lookbackHours,
        type: "text",
        limit: 5,
      });
      const latest = response.messages.find((message) => message.type === "text" && message.text) ?? null;
      await audit(req, {
        action: "ANNOUNCEMENT_GROUP_TEST_FETCHED",
        resource: "facility_announcement_groups",
        resourceId: String(group.id),
        facilityKey: group.facilityKey,
        payload: { sampleCount: response.messages.length, hasLatestMessage: Boolean(latest) },
        resultStatus: "success",
      });
      res.json({
        ok: true,
        sampleCount: response.messages.length,
        latestMessage: latest ? {
          displayName: latest.displayName,
          text: latest.text,
          timestamp: latest.timestamp,
        } : null,
        errorMessage: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "拉取失敗";
      await audit(req, {
        action: "ANNOUNCEMENT_GROUP_TEST_FETCHED",
        resource: "facility_announcement_groups",
        resourceId: String(group.id),
        facilityKey: group.facilityKey,
        payload: { error: errorMessage },
        resultStatus: "failure",
      });
      res.status(502).json({
        ok: false,
        sampleCount: 0,
        latestMessage: null,
        errorMessage,
      });
    }
  });
}
