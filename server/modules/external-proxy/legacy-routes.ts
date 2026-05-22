import type { Express } from "express";
import fs from "fs";
import path from "path";
import { sanitizeAnnouncementCandidate, validateCandidateTitleSummary } from "@shared/announcement-classifier";
import { env } from "../../shared/config/env";
import { storage } from "../../storage";
import { invalidateCandidateCache } from "../announcements/widget-service";

export const registerExternalProxyLegacyRoutes = (app: Express) => {
  const LINE_BOT_BASE = env.lineBotBaseUrl;
  const SMART_SCHEDULE_BASE = env.smartScheduleBaseUrl;

  const markDeprecated = (res: import("express").Response, successor: string) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Link", `<${successor}>; rel="successor-version"`);
  };

  app.use([
    "/api/announcement-dashboard",
    "/api/announcement-candidates",
    "/api/announcement-reports",
    "/api/facility-home",
  ], (_req, res, next) => {
    markDeprecated(res, "/api/bff/employee/announcements");
    next();
  });

  function proxyHeaders(upstreamUrl: string, jsonBody = false) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (jsonBody) headers["Content-Type"] = "application/json";
    const token = upstreamUrl.startsWith(LINE_BOT_BASE)
      ? env.lineBotInternalToken
      : upstreamUrl.startsWith(SMART_SCHEDULE_BASE)
        ? env.smartScheduleApiToken
        : undefined;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Internal-Token"] = token;
      headers["X-API-Key"] = token;
    }
    return headers;
  }

  function lineBotFacilityUrl(groupId: string, path: string) {
    const prefix = env.lineBotInternalToken ? "/api/internal/facility-home" : "/api/facility-home";
    return `${LINE_BOT_BASE}${prefix}/${encodeURIComponent(groupId)}${path}`;
  }

  const recordClassifierAnomaly = (candidate: Record<string, unknown>, anomaly: NonNullable<ReturnType<typeof validateCandidateTitleSummary>["anomaly"]>, fallback: { title: string; summary: string }) => {
    if (!env.databaseUrl) return;
    storage.recordClassifierAnomaly({
      sourceMessageId: typeof candidate.sourceMessageId === "string" ? candidate.sourceMessageId : null,
      sourceMessageIds: Array.isArray(candidate.sourceMessageIds) ? candidate.sourceMessageIds.map(String) : undefined,
      anomalyType: anomaly.reason,
      originalTitle: anomaly.originalTitle,
      originalSummary: anomaly.originalSummary,
      fallbackTitle: fallback.title,
      fallbackSummary: fallback.summary,
      originalText: typeof candidate.originalText === "string" ? candidate.originalText : null,
      payload: candidate,
    }).catch((error) => console.warn("[classifier_anomalies:record_failed]", error));
  };

  const postProcessAnnouncementCandidate = (candidate: Record<string, unknown>) => {
    const text = String(candidate.originalText ?? candidate.sourceMessageText ?? candidate.text ?? candidate.summary ?? candidate.title ?? "");
    const validation = validateCandidateTitleSummary(String(candidate.title ?? ""), String(candidate.summary ?? ""), text);
    if (validation.anomaly) recordClassifierAnomaly(candidate, validation.anomaly, validation);
    return sanitizeAnnouncementCandidate(candidate);
  };

  // candidateType values that are purely casual chat and must NEVER appear in
  // the announcement review queue regardless of what the upstream classifier says.
  // "chat" = 一般閒聊; "vip_chat" = VIP 用戶閒聊（例如陳柏榮）
  const CHAT_TYPES = new Set(["chat", "vip_chat"]);

  const postProcessAnnouncementPayload = (payload: unknown) => {
    if (!payload || typeof payload !== "object") return payload;
    const source = payload as Record<string, unknown>;
    const itemsKey = Array.isArray(source.candidates) ? "candidates" : Array.isArray(source.items) ? "items" : null;
    if (!itemsKey) return payload;
    const originalItems = source[itemsKey] as Record<string, unknown>[];
    // First pass: drop chat / vip_chat by candidateType (upstream classification).
    // This catches casual messages that slipped through the upstream "ignore" filter
    // via vip_bypass or similar passReasons.
    const nonChat = originalItems.filter((item) => {
      const ct = String(item.candidateType ?? "").toLowerCase().trim();
      return !CHAT_TYPES.has(ct);
    });
    // Second pass: run local text classifier.
    const sanitized = nonChat
      .map((item) => postProcessAnnouncementCandidate(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
    return {
      ...source,
      [itemsKey]: sanitized,
      ...(itemsKey === "candidates" ? { items: sanitized } : { candidates: sanitized }),
      total: typeof source.total === "number" ? Math.min(source.total, sanitized.length) : sanitized.length,
      filteredByLocalClassifier: originalItems.length - sanitized.length,
    };
  };

  async function proxyGet(upstreamUrl: string, res: any, label: string, transform?: (payload: unknown) => unknown) {
    try {
      const upstream = await fetch(upstreamUrl, {
        headers: proxyHeaders(upstreamUrl),
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ message: `${label} 回傳 HTTP ${upstream.status}` });
      }
      const ct = upstream.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return res.status(502).json({ message: `${label} 未回傳 JSON` });
      }
      const data = transform ? transform(await upstream.json()) : await upstream.json();
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ message: err.message || `無法連線至${label}` });
    }
  }

  async function proxyPatch(upstreamUrl: string, body: any, res: any, label: string) {
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "PATCH",
        headers: proxyHeaders(upstreamUrl, true),
        body: JSON.stringify(body || {}),
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        const errBody = await upstream.text().catch(() => "");
        return res.status(upstream.status).json({ message: errBody || `${label} 回傳 HTTP ${upstream.status}` });
      }
      const ct = upstream.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return res.status(502).json({ message: `${label} 未回傳 JSON` });
      }
      const data = await upstream.json();
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ message: err.message || `無法連線至${label}` });
    }
  }

  async function proxyPost(upstreamUrl: string, body: any, res: any, label: string) {
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: proxyHeaders(upstreamUrl, true),
        body: JSON.stringify(body || {}),
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        const errBody = await upstream.text().catch(() => "");
        return res.status(upstream.status).json({ message: errBody || `${label} 回傳 HTTP ${upstream.status}` });
      }
      const ct = upstream.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return res.status(502).json({ message: `${label} 未回傳 JSON` });
      }
      const data = await upstream.json();
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ message: err.message || `無法連線至${label}` });
    }
  }

  app.get("/api/announcement-dashboard/summary", (req, res) =>
    proxyGet(`${LINE_BOT_BASE}/api/announcement-dashboard/summary`, res, "公告摘要")
  );

  app.get("/api/announcement-candidates", (req, res) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    proxyGet(`${LINE_BOT_BASE}/api/announcement-candidates${qsStr ? "?" + qsStr : ""}`, res, "公告候選列表", postProcessAnnouncementPayload);
  });

  app.get("/api/announcement-candidates/:id", (req, res) =>
    proxyGet(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}`, res, "公告詳情", (payload) => {
      if (!payload || typeof payload !== "object") return payload;
      return postProcessAnnouncementCandidate(payload as Record<string, unknown>) ?? { message: "Local classifier excluded this non-announcement candidate" };
    })
  );

  app.post("/api/announcement-candidates/:id/approve", (req, res) => {
    invalidateCandidateCache();
    return proxyPost(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}/approve`, req.body, res, "核准公告");
  });

  app.post("/api/announcement-candidates/:id/reject", (req, res) => {
    invalidateCandidateCache();
    return proxyPost(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}/reject`, req.body, res, "退回公告");
  });

  app.post("/api/announcement-candidates/:id/publish", (req, res) => {
    invalidateCandidateCache();
    return proxyPost(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}/publish`, req.body, res, "發布公告候選");
  });

  app.post("/api/announcement-candidates/:id/unpublish", (req, res) => {
    invalidateCandidateCache();
    return proxyPost(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}/unpublish`, req.body, res, "取消發布公告候選");
  });

  app.patch("/api/announcement-candidates/:id", (req, res) => {
    invalidateCandidateCache();
    return proxyPatch(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}`, req.body, res, "更新公告候選");
  });

  app.get("/api/announcement-reports/weekly", (req, res) =>
    proxyGet(`${LINE_BOT_BASE}/api/announcement-reports/weekly`, res, "週報")
  );

  // ===== Portal facility-home proxies =====
  app.get("/api/facility-home/:groupId/home", (req, res) =>
    proxyGet(lineBotFacilityUrl(req.params.groupId, "/home"), res, "場館首頁資料")
  );

  app.get("/api/facility-home/:groupId/announcements", (req, res) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    proxyGet(
      `${lineBotFacilityUrl(req.params.groupId, "/announcements")}${qsStr ? "?" + qsStr : ""}`,
      res,
      "場館公告列表",
    );
  });

  app.get("/api/facility-home/:groupId/announcements/:id", (req, res) =>
    proxyGet(
      lineBotFacilityUrl(req.params.groupId, `/announcements/${encodeURIComponent(req.params.id)}`),
      res,
      "場館公告詳情",
    )
  );

  app.get("/api/facility-home/:groupId/today-shift", (req, res) =>
    proxyGet(lineBotFacilityUrl(req.params.groupId, "/today-shift"), res, "今日班表")
  );

  app.get("/api/facility-home/:groupId/handover", (req, res) =>
    proxyGet(lineBotFacilityUrl(req.params.groupId, "/handover"), res, "櫃台交接")
  );

  app.post("/api/facility-home/:groupId/announcements/:id/ack", (req, res) =>
    proxyPost(
      lineBotFacilityUrl(req.params.groupId, `/announcements/${encodeURIComponent(req.params.id)}/ack`),
      req.body,
      res,
      "回報已讀",
    )
  );

  const EXPORT_DIR = path.join(process.cwd(), "exports");
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  app.get("/api/announcement-candidates/export/all", async (_req, res) => {
    try {
      const PAGE_SIZE = 100;
      let allItems: any[] = [];
      let page = 1;
      let totalFromApi = 0;

      while (true) {
        const upstream = await fetch(
          `${LINE_BOT_BASE}/api/announcement-candidates?pageSize=${PAGE_SIZE}&page=${page}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
        );
        if (!upstream.ok) {
          return res.status(upstream.status).json({ message: `上游回傳 HTTP ${upstream.status} (page ${page})` });
        }
        const raw: any = await upstream.json();
        const items: any[] = raw.items || raw.candidates || [];
        totalFromApi = raw.total || totalFromApi;
        allItems = allItems.concat(items);

        if (items.length < PAGE_SIZE || allItems.length >= totalFromApi) break;
        page++;
        if (page > 50) break;
      }

      const mapCandidate = (c: any) => ({
        id: c.id,
        status: c.status,
        candidateType: c.candidateType,
        title: c.title,
        summary: c.summary,
        originalText: c.originalText,
        confidence: c.confidence,
        reasoningTags: c.reasoningTags,
        recommendedAction: c.recommendedAction,
        recommendedReply: c.recommendedReply,
        badExample: c.badExample,
        appliesToRoles: c.appliesToRoles,
        scopeType: c.scopeType,
        facilityName: c.facilityName,
        groupId: c.groupId,
        displayName: c.displayName,
        userId: c.userId,
        isFromSupervisor: c.isFromSupervisor,
        startAt: c.startAt,
        endAt: c.endAt,
        detectedAt: c.detectedAt,
        sourceMessageId: c.sourceMessageId,
        extractedJson: c.extractedJson,
      });

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedAtTaipei: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
        totalFromApi,
        totalExported: allItems.length,
        pagesfetched: page,
        candidates: allItems.map(mapCandidate),
      };

      const filePath = path.join(EXPORT_DIR, "announcement-candidates-export.json");
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), "utf-8");

      res.json({
        success: true,
        message: `已匯出全部 ${allItems.length}/${totalFromApi} 筆公告候選資料`,
        filePath: "/exports/announcement-candidates-export.json",
        exportedAt: exportData.exportedAt,
        totalFromApi,
        totalExported: allItems.length,
        pagesFetched: page,
      });
    } catch (err: any) {
      res.status(502).json({ message: err.message || "匯出失敗" });
    }
  });

  app.get("/exports/:filename", (req, res) => {
    const filePath = path.join(EXPORT_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "檔案不存在" });
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/api/admin/overview", (_req, res) =>
    proxyGet(
      `${SMART_SCHEDULE_BASE}${env.smartScheduleApiToken ? "/api/internal/admin/overview" : "/api/admin/overview"}`,
      res,
      "排班系統總覽",
    )
  );

  app.get("/api/admin/interview-users", async (_req, res) => {
    try {
      const token = env.lineBotAdminToken;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const upstream = await fetch(`${LINE_BOT_BASE}/api/admin/interview-users`, { headers, signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `面試授權用戶 回傳 HTTP ${upstream.status}` });
      return res.json(await upstream.json());
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "無法連線至面試授權用戶" });
    }
  });
};
