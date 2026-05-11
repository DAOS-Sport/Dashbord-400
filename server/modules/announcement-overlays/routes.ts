import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import type { AuditEventInput } from "../../shared/telemetry/audit-writer";

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
  recordAudit?: (event: AuditEventInput) => Promise<void>;
}

const announcementIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9._:\-]+$/, "announcementId 格式錯誤");
const pinBodySchema = z.object({ until: z.coerce.date() });
const noteBodySchema = z.object({ note: z.string().max(1000).nullable() });

// Per-actor in-memory rate limit to mitigate authenticated abuse / unbounded overlay growth.
// Sliding window of 60 mutation attempts per 60 seconds per session userId.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const HIDDEN_LIST_MAX = 500;
const rateBuckets = new Map<string, number[]>();
const checkRate = (actorId: string): boolean => {
  const now = Date.now();
  const bucket = (rateBuckets.get(actorId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(actorId, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(actorId, bucket);
  // Opportunistic GC: prune empty/stale buckets every ~200 calls.
  if (rateBuckets.size > 200) {
    rateBuckets.forEach((value, key) => {
      const fresh = value.filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) rateBuckets.delete(key);
      else rateBuckets.set(key, fresh);
    });
  }
  return true;
};

const getActor = (req: Request) => {
  const session = req.workbenchSession;
  const isSupervisor = Boolean(
    session?.grantedRoles?.includes("supervisor") || session?.grantedRoles?.includes("system"),
  );
  return {
    id: session?.userId ?? "anonymous",
    name: session?.displayName ?? null,
    role: (isSupervisor ? "supervisor" : "employee") as "supervisor" | "employee",
    isSupervisor,
  };
};

export function registerAnnouncementOverlayRoutes(app: Express, deps: RegisterDeps): void {
  const audit = async (req: Request, action: string, target: string, payload?: Record<string, unknown>) => {
    if (!deps.recordAudit) return;
    const actor = getActor(req);
    try {
      await deps.recordAudit({
        actorId: actor.id,
        role: actor.role,
        action: `announcement-overlay.${action}`,
        resource: target,
        payload,
      });
    } catch {
      /* swallow audit errors */
    }
  };

  const rateGate = (req: Request, res: import("express").Response): boolean => {
    const actor = getActor(req);
    if (!checkRate(actor.id)) {
      res.status(429).json({ message: "操作過於頻繁，請稍後再試" });
      return false;
    }
    return true;
  };

  // Hide an announcement (anyone logged in)
  app.post("/api/announcement-overlays/:id/hide", deps.requireEmployee(), async (req, res) => {
    if (!rateGate(req, res)) return;
    const parsed = announcementIdSchema.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "invalid id" });
    const actor = getActor(req);
    const overlay = await storage.upsertAnnouncementOverlay({
      announcementId: parsed.data,
      isHidden: true,
      lastModifiedBy: actor.id,
      lastModifiedByName: actor.name,
      lastModifiedRole: actor.role,
    });
    await audit(req, "hide", parsed.data);
    res.json(overlay);
  });

  // Restore (unhide) — supervisor only
  app.post("/api/announcement-overlays/:id/unhide", deps.requireSupervisor(), async (req, res) => {
    if (!rateGate(req, res)) return;
    const parsed = announcementIdSchema.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "invalid id" });
    const actor = getActor(req);
    const overlay = await storage.upsertAnnouncementOverlay({
      announcementId: parsed.data,
      isHidden: false,
      lastModifiedBy: actor.id,
      lastModifiedByName: actor.name,
      lastModifiedRole: actor.role,
    });
    await audit(req, "unhide", parsed.data);
    res.json(overlay);
  });

  // Pin until a future timestamp (anyone logged in)
  app.post("/api/announcement-overlays/:id/pin", deps.requireEmployee(), async (req, res) => {
    if (!rateGate(req, res)) return;
    const idParsed = announcementIdSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ message: idParsed.error.issues[0]?.message ?? "invalid id" });
    const bodyParsed = pinBodySchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json({ message: "until (ISO datetime) 必填" });
    if (bodyParsed.data.until.getTime() <= Date.now()) {
      return res.status(400).json({ message: "until 必須在未來" });
    }
    const actor = getActor(req);
    const overlay = await storage.upsertAnnouncementOverlay({
      announcementId: idParsed.data,
      pinnedUntil: bodyParsed.data.until,
      lastModifiedBy: actor.id,
      lastModifiedByName: actor.name,
      lastModifiedRole: actor.role,
    });
    await audit(req, "pin", idParsed.data, { until: bodyParsed.data.until.toISOString() });
    res.json(overlay);
  });

  // Unpin (anyone)
  app.post("/api/announcement-overlays/:id/unpin", deps.requireEmployee(), async (req, res) => {
    if (!rateGate(req, res)) return;
    const parsed = announcementIdSchema.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "invalid id" });
    const actor = getActor(req);
    const overlay = await storage.upsertAnnouncementOverlay({
      announcementId: parsed.data,
      pinnedUntil: null,
      lastModifiedBy: actor.id,
      lastModifiedByName: actor.name,
      lastModifiedRole: actor.role,
    });
    await audit(req, "unpin", parsed.data);
    res.json(overlay);
  });

  // Edit note (anyone)
  app.post("/api/announcement-overlays/:id/note", deps.requireEmployee(), async (req, res) => {
    if (!rateGate(req, res)) return;
    const idParsed = announcementIdSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ message: idParsed.error.issues[0]?.message ?? "invalid id" });
    const bodyParsed = noteBodySchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json({ message: "note 必填（可為 null 清除）" });
    const actor = getActor(req);
    const overlay = await storage.upsertAnnouncementOverlay({
      announcementId: idParsed.data,
      note: bodyParsed.data.note,
      lastModifiedBy: actor.id,
      lastModifiedByName: actor.name,
      lastModifiedRole: actor.role,
    });
    await audit(req, "note", idParsed.data, { hasNote: Boolean(bodyParsed.data.note) });
    res.json(overlay);
  });

  // List hidden overlays — supervisor only (for restore UI). Capped to HIDDEN_LIST_MAX rows.
  app.get("/api/announcement-overlays/hidden", deps.requireSupervisor(), async (_req, res) => {
    const rows = await storage.listHiddenAnnouncementOverlays();
    res.json(rows.slice(0, HIDDEN_LIST_MAX));
  });
}
