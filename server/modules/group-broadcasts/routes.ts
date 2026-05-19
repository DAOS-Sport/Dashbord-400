import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  announcementCandidates,
  groupBroadcasts,
  insertGroupBroadcastSchema,
} from "@shared/schema";
import { storage } from "../../storage";
import { resolveBroadcastTargets } from "./fan-out";
import { analyzeGroupBroadcastWithGemini } from "./gemini-service";

type AuthMiddleware = (req: any, res: any, next: any) => void;

interface GroupBroadcastRouteDeps {
  requireEmployee: AuthMiddleware;
  requireSupervisor: AuthMiddleware;
}

const createSchema = z.object({
  facilityKey: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

async function runGeminiAsync(broadcastId: number, title: string, content: string, facilityKey: string) {
  try {
    await storage.updateGroupBroadcast(broadcastId, { geminiStatus: "processing" });
    const result = await analyzeGroupBroadcastWithGemini(title, content);

    if (!result) {
      await storage.updateGroupBroadcast(broadcastId, { geminiStatus: "skipped" });
      return;
    }

    const geminiUpdate: Parameters<typeof storage.updateGroupBroadcast>[1] = {
      geminiStatus: "done",
      geminiIsEvent: result.isEvent,
      geminiSummary: result.summary ?? undefined,
      geminiStartAt: result.startAt ? new Date(result.startAt) : undefined,
      geminiEndAt: result.endAt ? new Date(result.endAt) : undefined,
    };

    if (result.isEvent) {
      const contentHash = Buffer.from(`group-broadcast:${broadcastId}:${facilityKey}`, "utf8").toString("base64");
      const [candidate] = await db
        .insert(announcementCandidates)
        .values({
          sourceMessageId: `gb-${broadcastId}`,
          groupId: `group-broadcast:${facilityKey}`,
          contentHash,
          originalText: content,
          title,
          summary: result.summary ?? content.slice(0, 80),
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
            title,
            summary: result.summary ?? content.slice(0, 80),
            startAt: result.startAt ? new Date(result.startAt) : undefined,
            endAt: result.endAt ? new Date(result.endAt) : undefined,
            updatedAt: new Date(),
          },
        })
        .returning({ id: announcementCandidates.id });

      geminiUpdate.candidateId = candidate?.id;
    }

    await storage.updateGroupBroadcast(broadcastId, geminiUpdate);
  } catch (err) {
    console.warn("[group-broadcasts] Gemini async failed:", err instanceof Error ? err.message : String(err));
    await storage.updateGroupBroadcast(broadcastId, { geminiStatus: "failed" }).catch(() => {});
  }
}

export function registerGroupBroadcastRoutes(app: Express, deps: GroupBroadcastRouteDeps) {
  const { requireEmployee, requireSupervisor } = deps;

  // Employee + Supervisor: list broadcasts for a facility
  app.get("/api/group-broadcasts", requireEmployee, async (req, res) => {
    try {
      const facilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined;
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const rows = await storage.listGroupBroadcasts({ facilityKey, limit });
      res.json({ data: rows });
    } catch (err) {
      console.error("[group-broadcasts] list error:", err);
      res.status(500).json({ message: "讀取群組廣播失敗" });
    }
  });

  // Supervisor: list ALL broadcasts (admin view)
  app.get("/api/group-broadcasts/admin", requireSupervisor, async (req, res) => {
    try {
      const sourceFacilityKey = typeof req.query.sourceFacilityKey === "string" ? req.query.sourceFacilityKey : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const rows = await storage.listGroupBroadcasts({ sourceFacilityKey, limit });
      res.json({ data: rows });
    } catch (err) {
      console.error("[group-broadcasts] admin list error:", err);
      res.status(500).json({ message: "讀取群組廣播失敗" });
    }
  });

  // Supervisor: create broadcast (with fan-out)
  app.post("/api/group-broadcasts", requireSupervisor, async (req, res) => {
    try {
      const session = (req as any).session ?? (req as any).employeeSession;
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }

      const { facilityKey, title, content } = parsed.data;
      const createdBy = session?.employeeNumber ?? session?.userId ?? "unknown";
      const createdByName = session?.name ?? session?.employeeName ?? "主管";

      const targets = resolveBroadcastTargets(facilityKey);
      const isFanOut = targets.length > 1;

      const primaryRow = await storage.createGroupBroadcast({
        facilityKey: targets[0],
        sourceFacilityKey: facilityKey,
        isFanOut: false,
        parentId: null,
        fanOutTargets: isFanOut ? targets : null,
        title,
        content,
        createdBy,
        createdByName,
        geminiStatus: "pending",
      });

      const fanOutRows: typeof primaryRow[] = [];
      for (const target of targets.slice(1)) {
        const copy = await storage.createGroupBroadcast({
          facilityKey: target,
          sourceFacilityKey: facilityKey,
          isFanOut: true,
          parentId: primaryRow.id,
          fanOutTargets: null,
          title,
          content,
          createdBy,
          createdByName,
          geminiStatus: "pending",
        });
        fanOutRows.push(copy);
      }

      // Fire-and-forget Gemini analysis on primary only
      runGeminiAsync(primaryRow.id, title, content, facilityKey).catch(() => {});

      res.status(201).json({
        data: primaryRow,
        fanOut: fanOutRows,
        targets,
      });
    } catch (err) {
      console.error("[group-broadcasts] create error:", err);
      res.status(500).json({ message: "建立群組廣播失敗" });
    }
  });

  // Supervisor: hard-delete
  app.delete("/api/group-broadcasts/:id", requireSupervisor, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });

      const row = await storage.getGroupBroadcastById(id);
      if (!row) return res.status(404).json({ message: "找不到此廣播" });

      // Also delete fan-out copies if deleting primary
      if (!row.isFanOut && row.fanOutTargets && row.fanOutTargets.length > 1) {
        const copies = await storage.listGroupBroadcasts({ sourceFacilityKey: row.sourceFacilityKey, limit: 100 });
        const copyIds = copies.filter((r) => r.parentId === id).map((r) => r.id);
        for (const copyId of copyIds) {
          await storage.deleteGroupBroadcast(copyId);
        }
      }

      const deleted = await storage.deleteGroupBroadcast(id);
      if (!deleted) return res.status(404).json({ message: "刪除失敗" });

      res.json({ success: true });
    } catch (err) {
      console.error("[group-broadcasts] delete error:", err);
      res.status(500).json({ message: "刪除失敗" });
    }
  });
}
