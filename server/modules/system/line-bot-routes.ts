import type { Express, Request, Response } from "express";
import type { AppContainer } from "../../app/container";
import { env } from "../../shared/config/env";
import { requireRole, requireSession } from "../auth/context";

const readInternalToken = (req: Request) => {
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const internal = req.headers["x-internal-token"];
  const apiKey = req.headers["x-api-key"];
  return bearer || (Array.isArray(internal) ? internal[0] : internal) || (Array.isArray(apiKey) ? apiKey[0] : apiKey) || "";
};

const requireInternalToken = (container: AppContainer, req: Request, res: Response) => {
  if (!container.config.internalApiToken) {
    res.status(503).json({ message: "INTERNAL_API_TOKEN not configured" });
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

const readLineBotJson = async (path: string, token?: string) => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const upstream = await fetch(`${env.lineBotBaseUrl}${path}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, status: upstream.status, nonJson: true, data: null as unknown };
  }
  const data = await upstream.json().catch(() => null);
  return { ok: upstream.ok, status: upstream.status, nonJson: false, data };
};

const lineBotProxy = (upstreamPath: string) => async (req: Request, res: Response) => {
  const token = env.lineBotAdminToken;
  if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured" });
  const paramId = (req.params as Record<string, string | undefined>).id ?? (req.params as Record<string, string | undefined>).userId;
  const targetPath = paramId ? `${upstreamPath}/${encodeURIComponent(paramId)}` : upstreamPath;
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  const url = `${env.lineBotBaseUrl}${targetPath}${qs ? `?${qs}` : ""}`;
  const hasBody = ["POST", "PATCH", "PUT"].includes(req.method);
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: hasBody ? JSON.stringify(req.body || {}) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return res.status(502).json({ message: "LINE_BOT_NON_JSON_RESPONSE", upstreamStatus: upstream.status, upstreamPath: targetPath });
    }
    const data = await upstream.json().catch(() => null);
    return res.status(upstream.status).json(data ?? { ok: upstream.ok });
  } catch (err) {
    return res.status(502).json({ message: err instanceof Error ? err.message : "無法連線" });
  }
};

export const registerLineBotRoutes = (app: Express, container: AppContainer) => {
  app.use(["/api/internal/service-health", "/api/internal/interview-users"], (_req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Link", "</api/bff/system/line-bot/service-status>; rel=\"successor-version\"");
    next();
  });

  app.get("/api/bff/system/line-bot/service-status", requireSession, requireRole("system"), async (_req, res) => {
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", services: [] });
    try {
      const serviceStatus = await readLineBotJson("/api/admin/service-status", token);
      if (serviceStatus.ok && !serviceStatus.nonJson) return res.json(serviceStatus.data);

      const [health, announcements, interviewUsers, vipWhitelist] = await Promise.allSettled([
        readLineBotJson("/health"),
        readLineBotJson("/api/admin/announcements/health", token),
        readLineBotJson("/api/admin/interview-users", token),
        readLineBotJson("/api/admin/whitelist", token),
      ]);
      const unwrap = (result: PromiseSettledResult<Awaited<ReturnType<typeof readLineBotJson>>>) =>
        result.status === "fulfilled" ? result.value : { ok: false, status: 0, nonJson: false, data: null as unknown };
      const healthResult = unwrap(health);
      const announcementResult = unwrap(announcements);
      const interviewResult = unwrap(interviewUsers);
      const vipResult = unwrap(vipWhitelist);
      const announcementData = announcementResult.data as { status?: string; issues?: unknown[]; checkedAt?: string; counters?: { lastIngestAt?: string } } | null;
      const interviewData = interviewResult.data as { total?: number; users?: unknown[] } | null;
      const healthData = healthResult.data as { status?: string; timestamp?: string; keepAlive?: { isRunning?: boolean } } | null;
      return res.json({
        generatedAt: new Date().toISOString(),
        message: serviceStatus.nonJson ? "400LINE /api/admin/service-status 尚未回 JSON，已用可用端點合成狀態。" : undefined,
        mode: "fallback",
        services: [
          {
            name: "LINE Bot runtime",
            status: healthResult.ok && healthData?.status === "ok" ? "healthy" : "critical",
            message: healthResult.ok ? `runtime ${healthData?.status ?? "unknown"}` : `HTTP ${healthResult.status || "failed"}`,
            checkedAt: healthData?.timestamp,
          },
          {
            name: "公告管線",
            status: announcementResult.ok && announcementData?.status === "healthy" ? "healthy" : "degraded",
            message: announcementResult.ok ? `issues ${(announcementData?.issues ?? []).length}，last ingest ${announcementData?.counters?.lastIngestAt ?? "unknown"}` : `HTTP ${announcementResult.status || "failed"}`,
            checkedAt: announcementData?.checkedAt,
          },
          {
            name: "面試 / 慎用授權名單",
            status: interviewResult.ok ? "healthy" : "critical",
            message: interviewResult.ok ? `目前 ${interviewData?.total ?? interviewData?.users?.length ?? 0} 位` : `HTTP ${interviewResult.status || "failed"}`,
          },
          {
            name: "公告 VIP 白名單",
            status: vipResult.ok ? "healthy" : "degraded",
            message: vipResult.nonJson ? "端點目前回 HTML，等待 400LINE 掛上 /api/admin/whitelist JSON" : (vipResult.ok ? "可讀取" : `HTTP ${vipResult.status || "failed"}`),
          },
          {
            name: "整合服務狀態端點",
            status: serviceStatus.ok ? "healthy" : "degraded",
            message: serviceStatus.nonJson ? "/api/admin/service-status 回 HTML" : `HTTP ${serviceStatus.status || "failed"}`,
          },
        ],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "無法連線";
      return res.status(502).json({ message, services: [] });
    }
  });

  app.get("/api/bff/system/line-bot/service-status/snapshots", requireSession, requireRole("system"), async (_req, res) => {
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", items: [] });
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status/snapshots`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, items: [] });
      const data = await upstream.json() as unknown;
      return res.json(Array.isArray(data) ? { items: data } : data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "無法連線";
      return res.status(502).json({ message, items: [] });
    }
  });

  app.get("/api/bff/system/line-bot/interview-users", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));
  app.post("/api/bff/system/line-bot/interview-users", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));
  app.patch("/api/bff/system/line-bot/interview-users/:userId", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));
  app.delete("/api/bff/system/line-bot/interview-users/:userId", requireSession, requireRole("system"), lineBotProxy("/api/admin/interview-users"));

  app.get("/api/bff/system/line-bot/vip-whitelist", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));
  app.post("/api/bff/system/line-bot/vip-whitelist", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));
  app.patch("/api/bff/system/line-bot/vip-whitelist/:id", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));
  app.delete("/api/bff/system/line-bot/vip-whitelist/:id", requireSession, requireRole("system"), lineBotProxy("/api/admin/whitelist"));

  app.get("/api/internal/service-health", async (req, res) => {
    if (!requireInternalToken(container, req, res)) return;
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", services: [] });
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, services: [] });
      return res.json(await upstream.json());
    } catch (err) {
      return res.status(502).json({ message: err instanceof Error ? err.message : "無法連線", services: [] });
    }
  });

  app.get("/api/internal/service-health/snapshots", async (req, res) => {
    if (!requireInternalToken(container, req, res)) return;
    const token = env.lineBotAdminToken;
    if (!token) return res.status(503).json({ message: "LINE_BOT_ADMIN_TOKEN not configured", items: [] });
    const hours = Math.min(Number(req.query.hours) || 24, 168);
    try {
      const upstream = await fetch(`${env.lineBotBaseUrl}/api/admin/service-status/snapshots?hours=${hours}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ message: `LINE Bot 回傳 HTTP ${upstream.status}`, items: [] });
      const data = await upstream.json() as unknown;
      return res.json(Array.isArray(data) ? { items: data } : data);
    } catch (err) {
      return res.status(502).json({ message: err instanceof Error ? err.message : "無法連線", items: [] });
    }
  });
};
