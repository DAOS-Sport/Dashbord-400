import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { AppContainer } from "../../app/container";
import { db } from "../../db";
import { env } from "../../shared/config/env";
import { requireRole, requireSession } from "../auth/context";
import { lineFeatureWhitelist } from "@shared/schema";
import { LINE_FEATURES, normalizeLineFeatureAccess } from "@shared/system/line-feature-whitelist";
import {
  activeForFeature,
  isMissingWhitelistTable,
  lineWhitelistDto,
  listLineWhitelist,
  toNullableDate,
} from "./line-whitelist-service";
import type { LineWhitelistSyncStatus } from "@shared/system/line-whitelist-contract";

const readInternalToken = (req: Request) => {
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const internal = req.headers["x-internal-token"];
  const apiKey = req.headers["x-api-key"];
  return bearer || (Array.isArray(internal) ? internal[0] : internal) || (Array.isArray(apiKey) ? apiKey[0] : apiKey) || "";
};

const requireInternalToken = (container: AppContainer, req: Request, res: Response) => {
  if (!container.config.internalApiToken) {
    res.status(503).json({ message: "INTERNAL_API_TOKEN is not configured" });
    return false;
  }
  const token = readInternalToken(req);
  if (!token) {
    res.status(401).json({ message: "MISSING_INTERNAL_TOKEN" });
    return false;
  }
  if (token !== container.config.internalApiToken) {
    res.status(403).json({ message: "INVALID_INTERNAL_TOKEN" });
    return false;
  }
  return true;
};

const safeRead = async <T>(reader: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await reader();
  } catch {
    return fallback;
  }
};

const lineFeatureAccessSchema = z.record(z.boolean()).transform((value) => normalizeLineFeatureAccess(value));

const lineWhitelistUpsertSchema = z.object({
  lineUserId: z.string().trim().min(1, "LINE userId 不可為空").max(120),
  employeeNumber: z.string().trim().max(80).optional().nullable(),
  displayName: z.string().trim().min(1, "姓名不可為空").max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  department: z.string().trim().max(160).optional().nullable(),
  status: z.enum(["active", "disabled"]).default("active"),
  featureAccess: lineFeatureAccessSchema.default({}),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
  unlimited: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const lineWhitelistPatchSchema = lineWhitelistUpsertSchema.partial().extend({
  featureAccess: lineFeatureAccessSchema.optional(),
});

const lineBotJsonFetch = async (path: string, method: string, body: unknown, token: string | null | undefined) => {
  if (!token) return null;
  const response = await fetch(`${env.lineBotBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  return response;
};

const lineBotAdminFetch = async (path: string, method: string, body?: unknown) =>
  lineBotJsonFetch(path, method, body, env.lineBotAdminToken);

const lineBotInternalFetch = async (path: string, method: string, body?: unknown) =>
  lineBotJsonFetch(path, method, body, env.lineBotInternalToken ?? env.lineBotAdminToken);

const syncEndpoint = (
  endpoint: string,
  status: LineWhitelistSyncStatus["endpoints"][number]["status"],
  message: string,
): LineWhitelistSyncStatus["endpoints"][number] => ({ endpoint, status, message });

const pushLineBotFeatureWhitelist = async (
  row: typeof lineFeatureWhitelist.$inferSelect,
  mode: "create" | "update" | "delete",
): Promise<LineWhitelistSyncStatus["endpoints"][number]> => {
  const access = normalizeLineFeatureAccess(row.featureAccess);
  const payload = {
    userId: row.lineUserId,
    lineUserId: row.lineUserId,
    userName: row.displayName,
    displayName: row.displayName,
    employeeNumber: row.employeeNumber,
    department: row.department,
    phone: row.phone,
    featureAccess: access,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: mode !== "delete" && row.status === "active",
  };
  const path = mode === "update" || mode === "delete"
    ? `/api/internal/feature-whitelist/${encodeURIComponent(row.lineUserId)}`
    : "/api/internal/feature-whitelist";
  const method = mode === "create" ? "POST" : "PATCH";
  const resp = await lineBotInternalFetch(path, method, payload);
  if (!resp) return syncEndpoint(path, "waiting_for_400line_api", "LINE_BOT_INTERNAL_TOKEN 未設定，已保留 CMS shadow。");
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return syncEndpoint(path, "waiting_for_400line_api", `400LINE feature-whitelist 目前未回 JSON（HTTP ${resp.status}），已保留 CMS shadow。`);
  }
  if (!resp.ok) {
    if (resp.status === 404) return syncEndpoint(path, "waiting_for_400line_api", "400LINE feature-whitelist 尚未部署，已改走 fallback。");
    return syncEndpoint(path, "error", `400LINE feature-whitelist HTTP ${resp.status}`);
  }
  return syncEndpoint(path, "synced", "完整功能授權已同步到 400LINE feature-whitelist。");
};

const pushLineBotInterviewUser = async (
  row: typeof lineFeatureWhitelist.$inferSelect,
  mode: "create" | "update" | "delete",
): Promise<LineWhitelistSyncStatus["endpoints"][number]> => {
  if (!env.lineBotAdminToken) return syncEndpoint("/api/admin/interview-users", "skipped", "LINE_BOT_ADMIN_TOKEN 未設定。");
  const access = normalizeLineFeatureAccess(row.featureAccess);
  const shouldActivate = mode !== "delete" && row.status === "active" && (
    Boolean(access.interview) ||
    Boolean(access["caution-query"]) ||
    Boolean(access["staff-lookup"]) ||
    Boolean(access["ai-agent"])
  );
  const payload = {
    userId: row.lineUserId,
    lineUserId: row.lineUserId,
    userName: row.displayName,
    displayName: row.displayName,
    employeeNumber: row.employeeNumber ?? undefined,
    department: row.department ?? undefined,
    phone: row.phone ?? undefined,
    canInterviewCheck: Boolean(access.interview),
    canCautionQuery: Boolean(access["caution-query"]),
    canInternalQuery: Boolean(access["staff-lookup"]),
    canUseAiAgent: Boolean(access["ai-agent"]),
    isActive: shouldActivate,
  };
  if (!shouldActivate) {
    const resp = await lineBotAdminFetch(`/api/admin/interview-users/${encodeURIComponent(row.lineUserId)}`, "DELETE");
    if (resp && !resp.ok && resp.status !== 404) return syncEndpoint("/api/admin/interview-users", "error", `停用 fallback 失敗：HTTP ${resp.status}`);
    return syncEndpoint("/api/admin/interview-users", "synced", "面試/慎用/人員查詢/AI fallback 已停用。");
  }
  if (mode === "update") {
    const patchResp = await lineBotAdminFetch(`/api/admin/interview-users/${encodeURIComponent(row.lineUserId)}`, "PATCH", payload);
    if (patchResp?.status === 404) {
      const postResp = await lineBotAdminFetch("/api/admin/interview-users", "POST", payload);
      if (postResp && !postResp.ok) return syncEndpoint("/api/admin/interview-users", "error", `新增 fallback 失敗：HTTP ${postResp.status}`);
      return syncEndpoint("/api/admin/interview-users", "synced", "面試/慎用/人員查詢/AI fallback 已新增。");
    }
    if (patchResp && !patchResp.ok) return syncEndpoint("/api/admin/interview-users", "error", `更新 fallback 失敗：HTTP ${patchResp.status}`);
    return syncEndpoint("/api/admin/interview-users", "synced", "面試/慎用/人員查詢/AI fallback 已更新。");
  }
  const resp = await lineBotAdminFetch("/api/admin/interview-users", "POST", payload);
  if (resp && !resp.ok) return syncEndpoint("/api/admin/interview-users", "error", `新增 fallback 失敗：HTTP ${resp.status}`);
  return syncEndpoint("/api/admin/interview-users", "synced", "面試/慎用/人員查詢/AI fallback 已同步。");
};

const pushLineBotVipEntry = async (
  row: typeof lineFeatureWhitelist.$inferSelect,
  mode: "create" | "update" | "delete",
): Promise<LineWhitelistSyncStatus["endpoints"][number]> => {
  if (!env.lineBotAdminToken) return syncEndpoint("/api/admin/whitelist", "skipped", "LINE_BOT_ADMIN_TOKEN 未設定。");
  const access = normalizeLineFeatureAccess(row.featureAccess);
  const shouldBeVip = mode !== "delete" && row.status === "active" && Boolean(access["vip-announcement"]);
  if (!shouldBeVip) {
    const listResp = await lineBotAdminFetch("/api/admin/whitelist", "GET");
    if (!listResp?.ok) return syncEndpoint("/api/admin/whitelist", "waiting_for_400line_api", `VIP fallback 暫不可讀取：HTTP ${listResp?.status ?? "missing"}`);
    const raw = await listResp.json() as Array<{ id: string | number; userId?: string }> | { items?: Array<{ id: string | number; userId?: string }> };
    const list = Array.isArray(raw) ? raw : raw.items ?? [];
    const entry = list.find((item) => item.userId === row.lineUserId);
    if (entry?.id) {
      const resp = await lineBotAdminFetch(`/api/admin/whitelist/${encodeURIComponent(String(entry.id))}`, "DELETE");
      if (resp && !resp.ok && resp.status !== 404) return syncEndpoint("/api/admin/whitelist", "error", `VIP 停用失敗：HTTP ${resp.status}`);
    }
    return syncEndpoint("/api/admin/whitelist", "synced", "VIP fallback 已停用或無需停用。");
  }
  if (mode === "update") {
    const listResp = await lineBotAdminFetch("/api/admin/whitelist", "GET");
    if (listResp?.ok) {
      const raw = await listResp.json() as Array<{ id: string | number; userId?: string }> | { items?: Array<{ id: string | number; userId?: string }> };
      const list = Array.isArray(raw) ? raw : raw.items ?? [];
      const existing = list.find((item) => item.userId === row.lineUserId);
      if (existing?.id) {
        const patchResp = await lineBotAdminFetch(
          `/api/admin/whitelist/${encodeURIComponent(String(existing.id))}`,
          "PATCH",
          { displayName: row.displayName },
        );
        if (patchResp && !patchResp.ok) return syncEndpoint("/api/admin/whitelist", "error", `VIP 更新失敗：HTTP ${patchResp.status}`);
        return syncEndpoint("/api/admin/whitelist", "synced", "VIP fallback 已更新。");
      }
    }
  }
  const resp = await lineBotAdminFetch("/api/admin/whitelist", "POST", {
    userId: row.lineUserId,
    displayName: row.displayName,
  });
  if (resp && !resp.ok) return syncEndpoint("/api/admin/whitelist", "error", `VIP 新增失敗：HTTP ${resp.status}`);
  return syncEndpoint("/api/admin/whitelist", "synced", "VIP fallback 已同步。");
};

const pushLineBotWhitelists = async (
  container: AppContainer,
  req: Request,
  row: typeof lineFeatureWhitelist.$inferSelect,
  mode: "create" | "update" | "delete",
) : Promise<LineWhitelistSyncStatus> => {
  const featureEndpoint = await pushLineBotFeatureWhitelist(row, mode).catch((error) =>
    syncEndpoint("/api/internal/feature-whitelist", "error", String(error)),
  );
  const fallbackEndpoints = featureEndpoint.status === "synced"
    ? [syncEndpoint("/api/admin/interview-users", "skipped", "完整 feature-whitelist 已同步，無需 fallback。"), syncEndpoint("/api/admin/whitelist", "skipped", "完整 feature-whitelist 已同步，無需 fallback。")]
    : await Promise.all([
      pushLineBotInterviewUser(row, mode).catch((error) => syncEndpoint("/api/admin/interview-users", "error", String(error))),
      pushLineBotVipEntry(row, mode).catch((error) => syncEndpoint("/api/admin/whitelist", "error", String(error))),
    ]);
  const endpoints = [featureEndpoint, ...fallbackEndpoints];
  const hasError = endpoints.some((endpoint) => endpoint.status === "error");
  const hasWaiting = endpoints.some((endpoint) => endpoint.status === "waiting_for_400line_api");
  const hasSynced = endpoints.some((endpoint) => endpoint.status === "synced");
  const sync: LineWhitelistSyncStatus = {
    status: hasError ? "partial" : hasWaiting && !hasSynced ? "waiting_for_400line_api" : hasWaiting ? "partial" : hasSynced ? "synced" : "skipped",
    message: hasError
      ? "CMS shadow 已儲存，但部分 400LINE 同步失敗。"
      : hasWaiting
        ? "CMS shadow 已儲存；400LINE 完整 API 尚未就緒，已使用可用 fallback。"
        : hasSynced
          ? "CMS shadow 與 400LINE 已同步。"
          : "CMS shadow 已儲存；沒有需要同步的 400LINE 權限。",
    endpoints,
  };
  await container.repositories.telemetry.recordAudit({
    actorId: req.workbenchSession?.userId,
    role: req.workbenchSession?.activeRole,
    facilityKey: req.workbenchSession?.activeFacility,
    action: "LINE_WHITELIST_PUSH_400LINE",
    resource: "system.line-bot-push",
    payload: { lineUserId: row.lineUserId, mode, sync },
    resultStatus: hasError ? "failure" : "success",
  }).catch(() => {});
  return sync;
};

const searchRagicCandidates = async (container: AppContainer, queryInput: unknown, limit: number) => {
  const query = typeof queryInput === "string" ? queryInput.trim().toLowerCase() : "";
  const result = await safeRead(
    () => container.integrations.ragicAuth.listActiveEmployees(),
    { data: null, meta: { source: "ragic-employees", status: "unavailable" as const, fallbackReason: "Ragic employees lookup failed" } },
  );
  if (result.data === null) {
    return {
      ok: false as const,
      body: {
        message: "Ragic 員工資料暫時無法存取，請稍後再試",
        sourceStatus: result.meta,
        items: [],
      },
    };
  }
  const items = result.data
    .map((employee) => ({
      lineUserId: employee.lineUserId || employee.userId || employee.employeeNumber,
      employeeNumber: employee.employeeNumber,
      displayName: employee.displayName,
      phone: employee.phone ?? "",
      department: employee.department ?? employee.departments?.join(", ") ?? "",
      title: employee.title ?? "",
      source: result.meta.source,
    }))
    .filter((employee) => {
      if (!query) return true;
      const haystack = `${employee.lineUserId} ${employee.employeeNumber} ${employee.displayName} ${employee.phone} ${employee.department}`.toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, limit);
  return { ok: true as const, body: { items, sourceStatus: result.meta } };
};

export const registerLineWhitelistRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/bff/system/line-whitelist", requireSession, requireRole("system"), async (_req, res) => {
    const result = await listLineWhitelist();
    return res.json({
      generatedAt: new Date().toISOString(),
      storageStatus: result.storageStatus,
      error: result.error,
      features: LINE_FEATURES,
      summary: {
        total: result.items.length,
        active: result.items.filter((item) => item.status === "active").length,
        disabled: result.items.filter((item) => item.status === "disabled").length,
        interviewEnabled: result.items.filter((item) => item.status === "active" && item.featureAccess.interview).length,
      },
      items: result.items,
    });
  });

  app.get("/api/bff/system/line-whitelist/candidates", requireSession, requireRole("system"), async (req, res) => {
    const result = await searchRagicCandidates(container, req.query.q, 200);
    return result.ok ? res.json(result.body) : res.status(503).json(result.body);
  });

  app.get("/api/system/whitelist/ragic-search", requireSession, requireRole("system"), async (req, res) => {
    const result = await searchRagicCandidates(container, req.query.q, 30);
    return result.ok ? res.json(result.body) : res.status(503).json(result.body);
  });

  app.post("/api/bff/system/line-whitelist/import-interview-users", requireSession, requireRole("system"), async (_req, res) =>
    res.status(410).json({
      message: "LINEBOT_IMPORT_DISABLED",
      guidance: "詳細授權必須從 Ragic H01 選人後寫入 CMS shadow，再同步到 400LINE。400LINE 名單匯入只保留在 /system/linebot-management 做三方比對。",
    }));

  app.post("/api/bff/system/line-whitelist", requireSession, requireRole("system"), async (req, res) => {
    const parsed = lineWhitelistUpsertSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const input = parsed.data;
    const values = {
      lineUserId: input.lineUserId,
      employeeNumber: input.employeeNumber || null,
      displayName: input.displayName,
      phone: input.phone || null,
      department: input.department || null,
      status: input.status,
      featureAccess: input.featureAccess,
      startsAt: toNullableDate(input.startsAt),
      endsAt: input.unlimited ? null : toNullableDate(input.endsAt),
      unlimited: input.unlimited,
      notes: input.notes || null,
      source: "ragic",
      createdBy: req.workbenchSession?.userId,
      createdByName: req.workbenchSession?.displayName,
      updatedBy: req.workbenchSession?.userId,
      updatedByName: req.workbenchSession?.displayName,
      updatedAt: new Date(),
    };
    try {
      const [existing] = await db
        .select()
        .from(lineFeatureWhitelist)
        .where(eq(lineFeatureWhitelist.lineUserId, input.lineUserId))
        .limit(1);
      const [row] = existing
        ? await db.update(lineFeatureWhitelist).set(values).where(eq(lineFeatureWhitelist.id, existing.id)).returning()
        : await db.insert(lineFeatureWhitelist).values(values).returning();
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: existing ? "LINE_WHITELIST_UPDATED" : "LINE_WHITELIST_CREATED",
        resource: "system.line-feature-whitelist",
        resourceId: String(row.id),
        payload: { lineUserId: row.lineUserId, displayName: row.displayName, featureAccess: row.featureAccess, status: row.status },
        resultStatus: "success",
      });
      const sync = await pushLineBotWhitelists(container, req, row, existing ? "update" : "create");
      return res.status(existing ? 200 : 201).json({ ...lineWhitelistDto(row), sync });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.patch("/api/bff/system/line-whitelist/:id", requireSession, requireRole("system"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "INVALID_ID" });
    const parsed = lineWhitelistPatchSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const input = parsed.data;
    const updateValues: Partial<typeof lineFeatureWhitelist.$inferInsert> = {
      updatedBy: req.workbenchSession?.userId,
      updatedByName: req.workbenchSession?.displayName,
      updatedAt: new Date(),
    };
    if (input.lineUserId !== undefined) updateValues.lineUserId = input.lineUserId;
    if (input.employeeNumber !== undefined) updateValues.employeeNumber = input.employeeNumber || null;
    if (input.displayName !== undefined) updateValues.displayName = input.displayName;
    if (input.phone !== undefined) updateValues.phone = input.phone || null;
    if (input.department !== undefined) updateValues.department = input.department || null;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.featureAccess !== undefined) updateValues.featureAccess = input.featureAccess;
    if (input.startsAt !== undefined) updateValues.startsAt = toNullableDate(input.startsAt);
    if (input.unlimited !== undefined) updateValues.unlimited = input.unlimited;
    if (input.endsAt !== undefined || input.unlimited === true) updateValues.endsAt = input.unlimited ? null : toNullableDate(input.endsAt);
    if (input.notes !== undefined) updateValues.notes = input.notes || null;
    try {
      const [row] = await db.update(lineFeatureWhitelist).set(updateValues).where(eq(lineFeatureWhitelist.id, id)).returning();
      if (!row) return res.status(404).json({ message: "WHITELIST_ENTRY_NOT_FOUND" });
      await container.repositories.telemetry.recordAudit({
        actorId: req.workbenchSession?.userId,
        role: req.workbenchSession?.activeRole,
        facilityKey: req.workbenchSession?.activeFacility,
        action: "LINE_WHITELIST_UPDATED",
        resource: "system.line-feature-whitelist",
        resourceId: String(row.id),
        payload: { lineUserId: row.lineUserId, displayName: row.displayName, featureAccess: row.featureAccess, status: row.status },
        resultStatus: "success",
      });
      const sync = await pushLineBotWhitelists(container, req, row, "update");
      return res.json({ ...lineWhitelistDto(row), sync });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.delete("/api/bff/system/line-whitelist/:id", requireSession, requireRole("system"), async (_req, res) =>
    res.status(405).json({
      message: "LINE_WHITELIST_DELETE_DISABLED",
      guidance: "白名單不刪除，請改用 PATCH status=disabled 或設定 endsAt 授權期限。",
    }),
  );

  app.get("/api/internal/line-whitelist/check", async (req, res) => {
    if (!requireInternalToken(container, req, res)) return;
    const lineUserId = typeof req.query.lineUserId === "string" ? req.query.lineUserId.trim() : "";
    const feature = typeof req.query.feature === "string" ? req.query.feature.trim() : "";
    if (!lineUserId || !feature) return res.status(400).json({ message: "lineUserId and feature are required" });
    try {
      const [row] = await db
        .select()
        .from(lineFeatureWhitelist)
        .where(eq(lineFeatureWhitelist.lineUserId, lineUserId))
        .limit(1);
      return res.json({
        allowed: row ? activeForFeature(row, feature) : false,
        feature,
        lineUserId,
        entry: row ? lineWhitelistDto(row) : null,
      });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });

  app.get("/api/internal/interview-users", async (req, res) => {
    if (!requireInternalToken(container, req, res)) return;
    try {
      const rows = await db.select().from(lineFeatureWhitelist).orderBy(desc(lineFeatureWhitelist.updatedAt));
      const items = rows
        .filter((row) => row.status === "active" && activeForFeature(row, "interview"))
        .map((row) => lineWhitelistDto(row));
      return res.json({ items, total: items.length });
    } catch (error) {
      if (isMissingWhitelistTable(error)) return res.status(503).json({ message: "LINE_WHITELIST_SCHEMA_PENDING" });
      throw error;
    }
  });
};
