import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { WorkbenchRole } from "../shared/auth/me";

const roles = new Set<WorkbenchRole>(["employee", "lifeguard", "supervisor", "system"]);

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const nowIso = () => new Date().toISOString();

const createSmokeSession = (role: WorkbenchRole) => ({
  userId: `linebot-smoke-${role}`,
  displayName: `Linebot Smoke ${role}`,
  grantedRoles: [role],
  activeRole: role,
  grantedFacilities: ["xinbei_pool"],
  activeFacility: "xinbei_pool",
  permissionsSnapshot: ["system:overview:read", "system:integrations:read"],
  issuedAt: nowIso(),
  lastActive: nowIso(),
});

const mockRagicEmployees = [
  {
    userId: "U1",
    lineUserId: "U1",
    employeeNumber: "E001",
    displayName: "測試主管",
    phone: "0912000000",
    department: "測試部",
    grantedFacilities: ["xinbei_pool"],
  },
];

const mockRagicEmployeeSlot = () => ({
  data: mockRagicEmployees,
  source: "mock-ragic-h01",
  lastPrimedAt: new Date(),
  lastAttemptAt: new Date(),
  lastRefreshSucceededAt: new Date(),
  error: null,
});

const listen = async (server: Server) =>
  new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

const close = async (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });

let upstreamMode: "contract" | "legacy_fallback" = "contract";

const contractPayload = () => ({
  generatedAt: nowIso(),
  overall: "degraded",
  summary: { healthy: 3, degraded: 1, failing: 0, disabled: 1, notConfigured: 0, stale: 0, unknown: 0 },
  domains: [
    {
      key: "line-core",
      label: "LINE 核心",
      status: "healthy",
      capabilities: [
        {
          key: "line.webhook.receive",
          label: "LINE Webhook 接收",
          domain: "line-core",
          status: "healthy",
          enabled: true,
          configured: true,
          lastSuccessAt: nowIso(),
          lastErrorAt: null,
          lastError: null,
          latencyMs: 12,
          staleAfterSeconds: 300,
          dependencies: ["database"],
          counters: { todaySuccess: 3, todayError: 0 },
          sourceRoutes: ["/webhook"],
        },
      ],
    },
    {
      key: "facility-groups",
      label: "群組 / 館別",
      status: "healthy",
      capabilities: [
        {
          key: "facility.home",
          label: "facility home",
          domain: "facility-groups",
          status: "healthy",
          enabled: true,
          configured: true,
          lastSuccessAt: nowIso(),
          lastErrorAt: null,
          lastError: null,
          latencyMs: 8,
          staleAfterSeconds: 3600,
          dependencies: ["database"],
          counters: { todaySuccess: 1, todayError: 0 },
          sourceRoutes: ["/api/internal/facility-home/:groupId/home"],
        },
      ],
    },
    {
      key: "announcement-pipeline",
      label: "重要公告管線",
      status: "degraded",
      capabilities: [
        {
          key: "announcement.ingest",
          label: "公告 ingest",
          domain: "announcement-pipeline",
          status: "degraded",
          enabled: true,
          configured: true,
          lastSuccessAt: nowIso(),
          lastErrorAt: null,
          lastError: null,
          latencyMs: null,
          staleAfterSeconds: 86400,
          dependencies: ["database"],
          counters: { todaySuccess: 0, todayError: 0 },
          sourceRoutes: ["/api/admin/announcements/health"],
        },
      ],
    },
    {
      key: "access-control",
      label: "白名單 / 權限",
      status: "disabled",
      capabilities: [
        {
          key: "line.webhook.signature",
          label: "LINE 簽章驗證",
          domain: "access-control",
          status: "disabled",
          enabled: false,
          configured: false,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastError: null,
          latencyMs: null,
          staleAfterSeconds: 3600,
          dependencies: ["line.channel-secret"],
          counters: { todaySuccess: 0, todayError: 0 },
          sourceRoutes: [],
        },
      ],
    },
  ],
  events: [],
});

const createUpstreamApp = () => {
  const app = express();
  app.use(express.json());
  app.get("/api/internal/monitoring/full-status", (_req, res) => {
    if (upstreamMode === "contract") return res.json(contractPayload());
    return res.status(404).json({ message: "NOT_FOUND" });
  });
  app.get("/api/admin/announcements/health", (_req, res) => res.json({ status: "healthy", counters: { todayProcessed: 2, candidateCount: 1 } }));
  app.get("/api/facility-home/list", (_req, res) => res.json({ items: [{ id: "xinbei", name: "新北高中", groupId: "C-xinbei" }] }));
  app.get("/api/admin/interview-users", (_req, res) => res.json({ items: [{ userId: "U1", userName: "測試主管", status: "active" }] }));
  app.get("/api/internal/service-health", (_req, res) => res.json({ services: [{ service: "database", status: "healthy", note: "ok", checkedAt: nowIso() }] }));
  app.get("/api/internal/service-health/snapshots", (_req, res) => res.json({ items: [] }));
  app.get("/api/admin/whitelist", (_req, res) => res.json({ items: [] }));
  app.get("/api/internal/announcement-whitelist", (_req, res) => res.json({ items: [] }));
  return app;
};

const createBffApp = async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const requestedRole = req.header("x-smoke-role");
    if (roles.has(requestedRole as WorkbenchRole)) {
      req.workbenchSession = createSmokeSession(requestedRole as WorkbenchRole);
    }
    next();
  });

  const { registerLinebotManagementRoutes } = await import("../server/modules/system/linebot-management-routes");
  registerLinebotManagementRoutes(app, {
    integrations: {
      ragicAuth: {
        listActiveEmployees: async () => ({
          data: mockRagicEmployees,
          meta: { source: "mock-ragic-h01", status: "ok", lastSyncAt: nowIso() },
        }),
      },
    },
    repositories: {
      telemetry: {
        recordAudit: async () => undefined,
      },
    },
    services: {
      ragicCache: {
        getEmployees: mockRagicEmployeeSlot,
      },
    },
  } as any);

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : 500;
    const code = typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "INTERNAL_SERVER_ERROR";
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(status).json({ message, code });
  });

  return app;
};

const requestJson = async (baseUrl: string, path: string) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { "x-smoke-role": "system" } });
  const body = await response.json().catch(() => undefined);
  assert(response.status === 200, `${path} expected 200, got ${response.status}`);
  return body;
};

const upstreamServer = createServer(createUpstreamApp());
const upstreamBaseUrl = await listen(upstreamServer);
process.env.LINE_BOT_BASE_URL = upstreamBaseUrl;
process.env.LINE_BOT_INTERNAL_TOKEN = "linebot-smoke-internal-token";
process.env.LINE_BOT_ADMIN_TOKEN = "linebot-smoke-admin-token";

const bffServer = createServer(await createBffApp());
const bffBaseUrl = await listen(bffServer);

try {
  upstreamMode = "contract";
  const contractOverview = await requestJson(bffBaseUrl, "/api/bff/system/linebot-management/overview");
  assert(contractOverview.sourceMode === "contract", "overview must use contract when full-status is readable");
  const contractServices = await requestJson(bffBaseUrl, "/api/bff/system/linebot-management/services");
  assert(contractServices.sourceMode === "contract", "services must use contract when full-status is readable");
  assert(contractServices.services.some((item: any) => item.rawStatus === "healthy"), "contract services must expose rawStatus");

  upstreamMode = "legacy_fallback";
  const fallbackOverview = await requestJson(bffBaseUrl, "/api/bff/system/linebot-management/overview");
  assert(fallbackOverview.sourceMode === "legacy_fallback", "overview must fall back when full-status is unavailable");
  const fallbackServices = await requestJson(bffBaseUrl, "/api/bff/system/linebot-management/services");
  assert(fallbackServices.sourceMode === "legacy_fallback", "services must fall back when full-status is unavailable");
  const fallbackWhitelist = await requestJson(bffBaseUrl, "/api/bff/system/linebot-management/whitelist-comparison");
  assert(fallbackWhitelist.sourceMode === "legacy_fallback", "whitelist comparison must use fallback sources");
  assert(typeof fallbackWhitelist.summary.ragicTotal === "number", "whitelist comparison must include Ragic total");
  assert(fallbackWhitelist.items.every((item: any) => item.comparisonStatus), "whitelist rows must expose comparisonStatus");

  console.log("Linebot management BFF smoke passed");
} finally {
  await close(bffServer);
  await close(upstreamServer);
}
