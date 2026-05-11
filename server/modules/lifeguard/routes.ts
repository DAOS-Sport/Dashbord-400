import type { Express, Request, RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import type { AppContainer } from "../../app/container";
import type { AuditEventInput } from "../../shared/telemetry/audit-writer";

type LifeguardPhotoModule = "water_quality" | "coach_dive" | "cleanup" | "lost_and_found" | "lane_issue";

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
  recordAudit?: (event: AuditEventInput) => Promise<void>;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});

const photoMetadataSchema = z.object({
  module: z.enum(["water_quality", "coach_dive", "cleanup", "lost_and_found", "lane_issue"]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  clientCaptureTimeIso: z.string().datetime(),
  clientAddress: z.string().max(1000).optional(),
  description: z.string().max(2000).optional(),
});

const photoRecordSchema = z.object({
  facilityKey: z.string().min(1).optional(),
  photoUrl: z.string().min(1),
  photoKey: z.string().min(1),
  description: z.string().max(2000).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  clientAddress: z.string().max(1000).optional().nullable(),
  serverAddress: z.string().max(1000).optional().nullable(),
  clientCaptureTimeIso: z.string().datetime(),
  structuredFields: z.record(z.unknown()).optional(),
  coachName: z.string().max(100).optional().nullable(),
  itemCategory: z.enum(["clothing", "electronics", "valuable", "other"]).optional().nullable(),
  itemDescription: z.string().max(1000).optional(),
  foundLocationNote: z.string().max(1000).optional().nullable(),
});

const laneIssueSchema = z.object({
  facilityKey: z.string().min(1).optional(),
  laneCode: z.enum(["A", "B", "C", "D", "E"]),
  issueType: z.enum(["故障", "異常", "維修", "其他"]),
  severity: z.enum(["一般", "重要", "緊急"]),
  description: z.string().min(1).max(2000),
});

const claimSchema = z.object({
  claimedByName: z.string().min(1).max(100),
  claimedByContact: z.string().max(100).optional().nullable(),
  claimNote: z.string().max(1000).optional().nullable(),
});

const disposeSchema = z.object({
  disposedReason: z.string().min(1).max(1000),
});

const todayTaipei = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
const startOfDay = (date = new Date()) => new Date(`${date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })}T00:00:00+08:00`);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const buildObjectKey = (module: LifeguardPhotoModule, facilityKey: string) => {
  const day = todayTaipei();
  const sortable = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `lifeguard/${module}/${facilityKey}/${day}/${sortable}-${randomUUID()}.jpg`;
};

const getActor = (req: Request) => ({
  id: req.workbenchSession?.userId ?? "unknown",
  name: req.workbenchSession?.displayName ?? "未知使用者",
  activeRole: req.workbenchSession?.activeRole ?? "employee",
  roles: req.workbenchSession?.grantedRoles ?? [],
  facilityKey: req.workbenchSession?.activeFacility ?? "",
  facilities: req.workbenchSession?.grantedFacilities ?? [],
});

const hasRole = (req: Request, role: "lifeguard" | "supervisor" | "system") =>
  Boolean(req.workbenchSession?.grantedRoles?.includes(role));

const resolveFacility = (req: Request, requested?: string) => {
  const actor = getActor(req);
  const facilityKey = requested || actor.facilityKey || actor.facilities[0];
  if (!facilityKey) return { ok: false as const, status: 400, message: "缺少 facilityKey" };
  if (actor.roles.includes("system") || actor.facilities.includes(facilityKey)) {
    return { ok: true as const, facilityKey };
  }
  return { ok: false as const, status: 403, message: "無權限存取此場館" };
};

const audit = async (deps: RegisterDeps, req: Request, action: string, facilityKey: string, payload: Record<string, unknown>, resource = "lifeguard") => {
  if (!deps.recordAudit) return;
  const actor = getActor(req);
  try {
    await deps.recordAudit({
      actorId: actor.id,
      role: actor.activeRole,
      facilityKey,
      action,
      resource,
      payload,
      correlationId: typeof req.headers["x-correlation-id"] === "string" ? req.headers["x-correlation-id"] : undefined,
      resultStatus: "success",
    });
  } catch {
    /* audit must not block operations */
  }
};

const serialize = <T extends { createdAt?: Date | null; updatedAt?: Date | null; clientCaptureTime?: Date | null; claimedAt?: Date | null; disposedAt?: Date | null }>(row: T) => ({
  ...row,
  createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  clientCaptureTime: row.clientCaptureTime?.toISOString?.() ?? row.clientCaptureTime,
  claimedAt: row.claimedAt?.toISOString?.() ?? row.claimedAt,
  disposedAt: row.disposedAt?.toISOString?.() ?? row.disposedAt,
});

export function registerLifeguardOperationRoutes(app: Express, deps: RegisterDeps, container: AppContainer): void {
  app.post("/api/bff/lifeguard/photo-upload", deps.requireEmployee(), upload.single("photo"), async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ message: "缺少 photo 檔案" });
      const rawMetadata = typeof req.body.metadata === "string" ? JSON.parse(req.body.metadata) : req.body.metadata;
      const parsed = photoMetadataSchema.safeParse(rawMetadata);
      if (!parsed.success) return res.status(400).json({ message: "照片 metadata 格式錯誤", errors: parsed.error.flatten() });
      const metadata = parsed.data;
      const facility = resolveFacility(req);
      if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
      if (metadata.module !== "lost_and_found" && metadata.module !== "lane_issue" && !hasRole(req, "lifeguard") && !hasRole(req, "system")) {
        return res.status(403).json({ message: "此模組需要救生員權限" });
      }
      const serverAddress = await container.integrations.geocoding.reverseGeocode(metadata.latitude, metadata.longitude);
      const key = buildObjectKey(metadata.module, facility.facilityKey);
      const uploaded = await container.integrations.photoStorage.upload(req.file.buffer, key, req.file.mimetype || "image/jpeg");
      const response = {
        photoUrl: uploaded.url,
        photoKey: uploaded.key,
        serverAddress: serverAddress?.address ?? null,
        serverReceivedAt: new Date().toISOString(),
      };
      await audit(deps, req, "LIFEGUARD_PHOTO_UPLOADED", facility.facilityKey, {
        module: metadata.module,
        photo_url: response.photoUrl,
        photo_key: response.photoKey,
        gps: { latitude: metadata.latitude, longitude: metadata.longitude },
        clientAddress: metadata.clientAddress,
        serverAddress: response.serverAddress,
      }, "lifeguard_photo_uploads");
      res.json(response);
    } catch (error) {
      console.error("[lifeguard] photo upload failed", error);
      res.status(500).json({ message: "照片上傳失敗" });
    }
  });

  const createPhotoRecord = (module: "water_quality" | "coach_dive" | "cleanup" | "lost_and_found") => async (req: Request, res: import("express").Response) => {
    try {
      const parsed = photoRecordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const facility = resolveFacility(req, parsed.data.facilityKey);
      if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
      if (module !== "lost_and_found" && !hasRole(req, "lifeguard") && !hasRole(req, "system")) {
        return res.status(403).json({ message: "此模組需要救生員權限" });
      }
      const actor = getActor(req);
      const base = {
        facilityKey: facility.facilityKey,
        createdBy: actor.id,
        createdByRole: actor.activeRole,
        photoUrl: parsed.data.photoUrl,
        photoKey: parsed.data.photoKey,
        description: parsed.data.description ?? null,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        clientAddress: parsed.data.clientAddress ?? null,
        serverAddress: parsed.data.serverAddress ?? null,
        clientCaptureTime: new Date(parsed.data.clientCaptureTimeIso),
        structuredFields: parsed.data.structuredFields ?? {},
      };
      let record: unknown;
      let action = "";
      if (module === "water_quality") {
        record = await storage.createLifeguardWaterQualityLog(base);
        action = "LIFEGUARD_WATER_QUALITY_CREATED";
      } else if (module === "coach_dive") {
        record = await storage.createLifeguardCoachDiveLog({ ...base, coachName: parsed.data.coachName ?? null });
        action = "LIFEGUARD_COACH_DIVE_CREATED";
      } else if (module === "cleanup") {
        record = await storage.createLifeguardCleanupLog(base);
        action = "LIFEGUARD_CLEANUP_CREATED";
      } else {
        record = await storage.createLifeguardLostAndFound({
          ...base,
          itemCategory: parsed.data.itemCategory ?? "other",
          itemDescription: parsed.data.itemDescription ?? parsed.data.description ?? "未命名失物",
          foundLocationNote: parsed.data.foundLocationNote ?? null,
          claimStatus: "unclaimed",
        });
        action = "LIFEGUARD_LOST_ITEM_CREATED";
      }
      await audit(deps, req, action, facility.facilityKey, {
        module,
        photo_url: parsed.data.photoUrl,
        gps: { latitude: parsed.data.latitude, longitude: parsed.data.longitude },
      });
      res.json({ item: serialize(record as never) });
    } catch (error) {
      console.error("[lifeguard] create photo record failed", error);
      res.status(500).json({ message: "建立紀錄失敗" });
    }
  };

  app.post("/api/bff/lifeguard/water-quality", deps.requireEmployee(), createPhotoRecord("water_quality"));
  app.post("/api/bff/lifeguard/coach-dive", deps.requireEmployee(), createPhotoRecord("coach_dive"));
  app.post("/api/bff/lifeguard/cleanup", deps.requireEmployee(), createPhotoRecord("cleanup"));
  app.post("/api/bff/lifeguard/lost-and-found", deps.requireEmployee(), createPhotoRecord("lost_and_found"));

  app.post("/api/bff/lifeguard/lane-issues", deps.requireEmployee(), async (req, res) => {
    try {
      if (!hasRole(req, "lifeguard") && !hasRole(req, "system")) return res.status(403).json({ message: "此模組需要救生員權限" });
      const parsed = laneIssueSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const facility = resolveFacility(req, parsed.data.facilityKey);
      if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
      const actor = getActor(req);
      const content = `[水道${parsed.data.laneCode}] ${parsed.data.issueType} / ${parsed.data.severity}\n${parsed.data.description}`;
      const item = await storage.createLifeguardHandoverNote({
        facilityKey: facility.facilityKey,
        workDate: todayTaipei(),
        fromShift: "all",
        toShift: "all",
        category: "facility",
        content,
        isImportant: parsed.data.severity !== "一般",
        needsAttention: parsed.data.severity === "緊急",
        photoUrls: [],
        authorEmployeeNumber: actor.id,
        authorName: actor.name,
      });
      await audit(deps, req, "LIFEGUARD_LANE_ISSUE_CREATED", facility.facilityKey, {
        module: "lane_issue",
        laneCode: parsed.data.laneCode,
        issueType: parsed.data.issueType,
        severity: parsed.data.severity,
      });
      res.json({ item: serialize(item) });
    } catch (error) {
      console.error("[lifeguard] lane issue create failed", error);
      res.status(500).json({ message: "建立水道事項失敗" });
    }
  });

  app.get("/api/bff/lifeguard/records", deps.requireEmployee(), async (req, res) => {
    const facility = resolveFacility(req, typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const actor = getActor(req);
    const ownerOnly = !hasRole(req, "lifeguard") && !hasRole(req, "supervisor") && !hasRole(req, "system");
    const fromDate = req.query.days ? daysAgo(Number(req.query.days)) : startOfDay();
    const common = { facilityKey: facility.facilityKey, fromDate, createdBy: ownerOnly ? actor.id : undefined, limit: 100 };
    const [waterQuality, coachDive, cleanup, lostItems, laneIssues, laneRentals] = await Promise.all([
      storage.listLifeguardWaterQualityLogs(common),
      storage.listLifeguardCoachDiveLogs(common),
      storage.listLifeguardCleanupLogs(common),
      storage.listLifeguardLostAndFound({ ...common, fromDate: req.query.days ? fromDate : daysAgo(30) }),
      storage.listLifeguardHandoverNotes({ facilityKey: facility.facilityKey, workDate: todayTaipei(), limit: 50 }),
      storage.listLaneRentals({ facilityKey: facility.facilityKey, bookingDate: todayTaipei(), status: "active" }).catch(() => []),
    ]);
    res.json({
      facilityKey: facility.facilityKey,
      waterQuality: waterQuality.map(serialize),
      coachDive: coachDive.map(serialize),
      cleanup: cleanup.map(serialize),
      lostItems: lostItems.map(serialize),
      laneIssues: laneIssues.map(serialize),
      laneRentals,
    });
  });

  app.get("/api/bff/lifeguard/lost-and-found", deps.requireEmployee(), async (req, res) => {
    const facility = resolveFacility(req, typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const actor = getActor(req);
    const ownerOnly = !hasRole(req, "lifeguard") && !hasRole(req, "supervisor") && !hasRole(req, "system");
    const items = await storage.listLifeguardLostAndFound({
      facilityKey: facility.facilityKey,
      fromDate: daysAgo(30),
      createdBy: ownerOnly ? actor.id : undefined,
      claimStatus: typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : undefined,
      itemCategory: typeof req.query.category === "string" && req.query.category !== "all" ? req.query.category : undefined,
      limit: 200,
    });
    res.json({ items: items.map(serialize) });
  });

  app.post("/api/bff/lifeguard/lost-and-found/:id/claim", deps.requireEmployee(), async (req, res) => {
    if (!hasRole(req, "lifeguard") && !hasRole(req, "supervisor") && !hasRole(req, "system")) return res.status(403).json({ message: "需要救生員或主管權限" });
    const id = Number(req.params.id);
    const parsed = claimSchema.safeParse(req.body);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const existing = await storage.getLifeguardLostAndFoundById(id);
    if (!existing) return res.status(404).json({ message: "找不到失物" });
    const facility = resolveFacility(req, existing.facilityKey);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const actor = getActor(req);
    const item = await storage.updateLifeguardLostAndFoundClaim(id, { claimStatus: "claimed", updatedBy: actor.id, claimedHandlerUserId: actor.id, ...parsed.data });
    if (!item) return res.status(409).json({ message: "此失物已處理，無法逆轉狀態" });
    await audit(deps, req, "LIFEGUARD_LOST_ITEM_CLAIMED", existing.facilityKey, { module: "lost_and_found", itemId: id, photo_url: existing.photoUrl });
    res.json({ item: serialize(item) });
  });

  app.post("/api/bff/lifeguard/lost-and-found/:id/dispose", deps.requireEmployee(), async (req, res) => {
    if (!hasRole(req, "lifeguard") && !hasRole(req, "supervisor") && !hasRole(req, "system")) return res.status(403).json({ message: "需要救生員或主管權限" });
    const id = Number(req.params.id);
    const parsed = disposeSchema.safeParse(req.body);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const existing = await storage.getLifeguardLostAndFoundById(id);
    if (!existing) return res.status(404).json({ message: "找不到失物" });
    const facility = resolveFacility(req, existing.facilityKey);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const actor = getActor(req);
    const item = await storage.updateLifeguardLostAndFoundClaim(id, { claimStatus: "disposed", updatedBy: actor.id, disposedByUserId: actor.id, disposedReason: parsed.data.disposedReason });
    if (!item) return res.status(409).json({ message: "此失物已處理，無法逆轉狀態" });
    await audit(deps, req, "LIFEGUARD_LOST_ITEM_DISPOSED", existing.facilityKey, { module: "lost_and_found", itemId: id, photo_url: existing.photoUrl });
    res.json({ item: serialize(item) });
  });

  app.get("/api/bff/lifeguard/lane-rentals", deps.requireEmployee(), async (req, res) => {
    const facility = resolveFacility(req, typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const date = typeof req.query.date === "string" ? req.query.date : todayTaipei();
    const items = await storage.listLaneRentals({ facilityKey: facility.facilityKey, bookingDate: date, status: "active" }).catch(() => []);
    res.json({ facilityKey: facility.facilityKey, date, items });
  });

  app.get("/api/bff/supervisor/lifeguard-overview", deps.requireSupervisor(), async (req, res) => {
    const actor = getActor(req);
    const facilityKeys = actor.roles.includes("system") ? undefined : actor.facilities;
    const fromDate = startOfDay();
    const [waterQuality, coachDive, cleanup, laneIssues, lostItems] = await Promise.all([
      storage.listLifeguardWaterQualityLogs({ facilityKeys, fromDate, limit: 200 }),
      storage.listLifeguardCoachDiveLogs({ facilityKeys, fromDate, limit: 200 }),
      storage.listLifeguardCleanupLogs({ facilityKeys, fromDate, limit: 200 }),
      Promise.all((facilityKeys?.length ? facilityKeys : [actor.facilityKey]).filter(Boolean).map((facilityKey) => storage.listLifeguardHandoverNotes({ facilityKey, workDate: todayTaipei(), limit: 100 }))).then((rows) => rows.flat()),
      storage.listLifeguardLostAndFound({ facilityKeys, claimStatus: "unclaimed", limit: 50 }),
    ]);
    res.json({
      waterQuality: waterQuality.map(serialize),
      coachDive: coachDive.map(serialize),
      cleanup: cleanup.map(serialize),
      laneIssues: laneIssues.map(serialize),
      lostItems: lostItems.map(serialize),
    });
  });

  app.get("/api/bff/system/lifeguard-audit", deps.requireEmployee(), async (req, res) => {
    if (!hasRole(req, "system")) return res.status(403).json({ message: "需要 IT / system 權限" });
    const facilityKey = typeof req.query.facilityKey === "string" && req.query.facilityKey !== "all" ? req.query.facilityKey : undefined;
    const fromDate = typeof req.query.from === "string" ? new Date(req.query.from) : daysAgo(30);
    const toDate = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
    const common = { facilityKey, fromDate, toDate, limit: 500 };
    const [waterQuality, coachDive, cleanup, lostItems] = await Promise.all([
      storage.listLifeguardWaterQualityLogs(common),
      storage.listLifeguardCoachDiveLogs(common),
      storage.listLifeguardCleanupLogs(common),
      storage.listLifeguardLostAndFound({ ...common, claimStatus: typeof req.query.claimStatus === "string" && req.query.claimStatus !== "all" ? req.query.claimStatus : undefined }),
    ]);
    const rows = [
      ...waterQuality.map((item) => ({ module: "water_quality", item })),
      ...coachDive.map((item) => ({ module: "coach_dive", item })),
      ...cleanup.map((item) => ({ module: "cleanup", item })),
      ...lostItems.map((item) => ({ module: "lost_and_found", item })),
    ].sort((a, b) => +new Date(b.item.createdAt) - +new Date(a.item.createdAt));
    if (req.path.endsWith(".csv") || req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(["module,id,facilityKey,createdBy,createdAt,latitude,longitude,photoUrl", ...rows.map(({ module, item }) => [module, item.id, item.facilityKey, item.createdBy, item.createdAt.toISOString(), item.latitude, item.longitude, item.photoUrl].join(","))].join("\n"));
      return;
    }
    res.json({ rows: rows.map(({ module, item }) => ({ module, item: serialize(item) })) });
  });

}
