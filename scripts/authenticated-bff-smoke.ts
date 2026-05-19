import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { WorkbenchRole } from "../shared/auth/me";
import type { AppContainer } from "../server/app/container";
import { registerHelperStatusRoutes } from "../server/modules/system/helper-status-routes";
import { registerSystemOperationsRoutes } from "../server/modules/system/operations-routes";

const roles = new Set<WorkbenchRole>(["employee", "lifeguard", "supervisor", "system"]);

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const nowIso = () => new Date().toISOString();

const createSmokeSession = (role: WorkbenchRole) => ({
  userId: `smoke-${role}`,
  displayName: `Smoke ${role}`,
  grantedRoles: [role],
  activeRole: role,
  grantedFacilities: ["xinbei_pool"],
  activeFacility: "xinbei_pool",
  permissionsSnapshot: ["system:overview:read", "system:integrations:read"],
  issuedAt: nowIso(),
  lastActive: nowIso(),
});

const createMockContainer = () => ({
  repositories: {
    telemetry: {
      listAuditLogs: async () => [],
      listClientErrors: async () => [],
      recordAudit: async () => undefined,
    },
  },
}) as unknown as AppContainer;

const createSmokeApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const requestedRole = req.header("x-smoke-role");
    if (roles.has(requestedRole as WorkbenchRole)) {
      req.workbenchSession = createSmokeSession(requestedRole as WorkbenchRole);
    }
    next();
  });

  const container = createMockContainer();
  registerHelperStatusRoutes(app);
  registerSystemOperationsRoutes(app, container);

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : 500;
    const code = typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : "INTERNAL_SERVER_ERROR";
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(status).json({ message, code });
  });

  return app;
};

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

const requestJson = async (baseUrl: string, path: string, role?: WorkbenchRole) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: role ? { "x-smoke-role": role } : undefined,
  });
  const body = await response.json().catch(() => undefined);
  return { status: response.status, body };
};

const expectStatus = async (baseUrl: string, path: string, role: WorkbenchRole | undefined, status: number) => {
  const result = await requestJson(baseUrl, path, role);
  assert(result.status === status, `${path} expected ${status} for ${role ?? "anonymous"}, got ${result.status}`);
  return result.body;
};

const endpoints = [
  "/api/bff/system/helper-status",
  "/api/bff/system/operations/recent-assists",
];

const server = createServer(createSmokeApp());
const baseUrl = await listen(server);

try {
  for (const endpoint of endpoints) {
    await expectStatus(baseUrl, endpoint, undefined, 401);
    await expectStatus(baseUrl, endpoint, "employee", 403);
    const body = await expectStatus(baseUrl, endpoint, "system", 200);
    if (endpoint.includes("helper-status")) {
      assert(typeof body?.summary?.exposedEndpoints === "number", "helper-status smoke must return summary.exposedEndpoints");
    } else {
      assert(Array.isArray(body?.items), "operations recent-assists smoke must return items array");
    }
  }
  console.log("Authenticated BFF smoke passed");
} finally {
  await close(server);
}
