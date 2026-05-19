import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import { announcementCandidates, groupBroadcasts } from "@shared/schema";
import { storage } from "../../storage";
import { resolveBroadcastTargets } from "@shared/group-broadcasts/fan-out";
import { analyzeGroupBroadcastWithGemini } from "./gemini-service";

type AuthMiddleware = (req: any, res: any, next: any) => void;

interface GroupBroadcastRouteDeps {
  requireEmployee: AuthMiddleware;
  requireSupervisor: AuthMiddleware;
}

async function runGeminiAsync(broadcastId: number, originalText: string, targetFacilityKeys: string[]) {
  try {
    await storage.updateGroupBroadcastGemini(broadcastId, { geminiStatus: "processing" });
    const result = await analyzeGroupBroadcastWithGemini(originalText);

    if (!result) {
      await storage.updateGroupBroadcastGemini(broadcastId, { geminiStatus: "skipped" });
      return;
    }

    const geminiUpdate: Parameters<typeof storage.updateGroupBroadcastGemini>[1] = {
      geminiStatus: "done",
      title: result.title,
      priority: result.priority,
      isEvent: result.isEvent,
      summary: result.summary ?? undefined,
      startAt: result.startAt ? new Date(result.startAt) : undefined,
      endAt: result.endAt ? new Date(result.endAt) : undefined,
      geminiProcessedAt: new Date(),
    };

    // When Gemini detects an event with extracted time/date fields, upsert announcement_candidates
    // for EVERY target facility so all fan-out targets get campaign visibility in 活動檔期.
    // We require at least startAt to be extracted — events without any date are not useful as campaigns.
    if (result.isEvent && (result.startAt || result.endAt) && targetFacilityKeys.length > 0) {
      let firstCandidateId: number | undefined;
      for (const facilityKey of targetFacilityKeys) {
        const contentHash = Buffer.from(`group-broadcast:${broadcastId}:${facilityKey}`, "utf8").toString("base64");
        const [candidate] = await db
          .insert(announcementCandidates)
          .values({
            sourceMessageId: `gb-${broadcastId}-${facilityKey}`,
            groupId: `group-broadcast:${facilityKey}`,
            contentHash,
            originalText,
            title: result.title,
            summary: result.summary ?? originalText.slice(0, 80),
            candidateType: "campaign",
            status: "approved",
            confidence: 0.85,
            facility: facilityKey,
            startAt: result.startAt ? new Date(result.startAt) : undefined,
            endAt: result.endAt ? new Date(result.endAt) : undefined,
            detectedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: announcementCandidates.contentHash,
            set: {
              title: result.title,
              summary: result.summary ?? originalText.slice(0, 80),
              startAt: result.startAt ? new Date(result.startAt) : undefined,
              endAt: result.endAt ? new Date(result.endAt) : undefined,
              updatedAt: new Date(),
            },
          })
          .returning({ id: announcementCandidates.id });

        if (!firstCandidateId && candidate?.id) {
          firstCandidateId = candidate.id;
        }
      }
      // Store a reference to the first candidate for traceability
      if (firstCandidateId) geminiUpdate.candidateId = firstCandidateId;
    }

    await storage.updateGroupBroadcastGemini(broadcastId, geminiUpdate);
  } catch (err) {
    console.warn("[group-broadcasts] Gemini async failed:", err instanceof Error ? err.message : String(err));
    await storage.updateGroupBroadcastGemini(broadcastId, { geminiStatus: "failed" }).catch(() => {});
  }
}

export function registerGroupBroadcastRoutes(app: Express, deps: GroupBroadcastRouteDeps) {
  const { requireEmployee, requireSupervisor } = deps;

  // Employee + Supervisor: list broadcasts for a facility
  // facilityKey is ALWAYS taken from the session — never from the client — to prevent cross-facility leakage.
  app.get("/api/group-broadcasts", requireEmployee, async (req, res) => {
    try {
      const session = (req as any).employeeSession ?? (req as any).session;
      const sessionFacility: string | undefined =
        session?.activeFacilityKey ?? session?.facilityKey ?? session?.activeFacility;

      if (!sessionFacility) {
        return res.status(400).json({ message: "無法取得場館資訊，請重新登入" });
      }

      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;

      const rows = await storage.listGroupBroadcasts({ facilityKey: sessionFacility, limit, offset });
      res.json({ data: rows, page, limit });
    } catch (err) {
      console.error("[group-broadcasts] list error:", err);
      res.status(500).json({ message: "讀取群組廣播失敗" });
    }
  });

  // Supervisor: list ALL broadcasts (admin view) — optional filter by sourceFacilityKey
  app.get("/api/group-broadcasts/admin", requireSupervisor, async (req, res) => {
    try {
      const sourceFacilityKey = typeof req.query.sourceFacilityKey === "string" ? req.query.sourceFacilityKey : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;
      const rows = await storage.listGroupBroadcasts({ sourceFacilityKey, limit, offset });
      res.json({ data: rows, page, limit });
    } catch (err) {
      console.error("[group-broadcasts] admin list error:", err);
      res.status(500).json({ message: "讀取群組廣播失敗" });
    }
  });

  // POST /api/group-broadcasts — accepts raw LINE message data; fan-out applied; Gemini async.
  // Auth: INTERNAL_API_TOKEN bearer (webhook/automated ingestion) OR supervisor session cookie.
  app.post("/api/group-broadcasts", async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const expectedToken = process.env.INTERNAL_API_TOKEN ?? process.env.LINE_BOT_ADMIN_TOKEN ?? "";
    const isBearerAuthed = bearerToken.length > 0 && bearerToken === expectedToken;

    const session = (req as any).session ?? (req as any).employeeSession;
    const isSupervisorSession =
      Array.isArray(session?.grantedRoles)
        ? session.grantedRoles.includes("supervisor") || session.grantedRoles.includes("system")
        : false;

    if (!isBearerAuthed && !isSupervisorSession) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const postSchema = z.object({
        // Source LINE group (required for webhook ingestion; optional for manual supervisor entry)
        sourceGroupId: z.string().optional(),
        senderName: z.string().optional(),
        // Which facility the message originates from; fan-out logic is applied from here.
        // For webhook ingestion, the caller should resolve sourceGroupId → facilityKey using
        // the facility_announcement_groups table before calling this endpoint.
        sourceFacilityKey: z.string().min(1),
        // Raw LINE message text — Gemini will extract title/priority/event from this.
        originalText: z.string().min(1),
        // Optional priority override; Gemini will update this during async analysis.
        priority: z.enum(["normal", "high", "urgent"]).optional().default("normal"),
      });

      const parsed = postSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }

      const { sourceGroupId, senderName, sourceFacilityKey, originalText, priority } = parsed.data;

      // Resolve fan-out targets: sourceGroupId takes precedence for group-id-to-facility mapping
      const targetFacilityKeys = resolveBroadcastTargets(sourceFacilityKey, sourceGroupId);

      const row = await storage.createGroupBroadcast({
        sourceGroupId: sourceGroupId ?? null,
        sourceFacilityKey,
        targetFacilityKeys,
        originalText,
        senderName: senderName ?? null,
        priority,
        geminiStatus: "pending",
      });

      // Fire-and-forget Gemini analysis (extracts title, priority, event detection)
      runGeminiAsync(row.id, originalText, targetFacilityKeys).catch(() => {});

      res.status(201).json({ data: row, targets: targetFacilityKeys });
    } catch (err) {
      console.error("[group-broadcasts] create error:", err);
      res.status(500).json({ message: "建立群組廣播失敗" });
    }
  });

  // Supervisor: soft-delete (sets deleted_at; row is preserved for audit)
  app.delete("/api/group-broadcasts/:id", requireSupervisor, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });

      const row = await storage.getGroupBroadcastById(id);
      if (!row) return res.status(404).json({ message: "找不到此廣播" });
      if (row.deletedAt) return res.status(404).json({ message: "此廣播已刪除" });

      const deleted = await storage.deleteGroupBroadcast(id);
      if (!deleted) return res.status(404).json({ message: "刪除失敗" });

      res.json({ success: true });
    } catch (err) {
      console.error("[group-broadcasts] delete error:", err);
      res.status(500).json({ message: "刪除失敗" });
    }
  });
}
