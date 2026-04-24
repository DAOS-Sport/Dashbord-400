import type { Express } from "express";
import type { WorkbenchRole } from "@shared/auth/me";
import type { AppContainer } from "../../app/container";
import { mockRagicAuthAdapter } from "../../integrations/ragic/mock-auth-adapter";
import { clearSessionCookie, getSessionIdFromCookie, setSessionCookie } from "./cookie";
import { attachSession, requireSession } from "./context";
import { createSessionFromAuthUser, createMemorySessionStore, hasRole } from "./session-store";

const workbenchRoles: readonly WorkbenchRole[] = ["employee", "supervisor", "system"];

export const registerAuthRoutes = (app: Express, container: AppContainer) => {
  const sessionStore = createMemorySessionStore();

  app.use(attachSession(sessionStore));

  app.post("/api/auth/login", async (req, res) => {
    const username = String(req.body?.username || req.body?.employeeNumber || "employee");
    const password = String(req.body?.password || "mock");
    const adapter =
      username === "1111" && password === "1111"
        ? mockRagicAuthAdapter
        : container.integrations.ragicAuth;
    const authResult = await adapter.verifyCredentials(username, password);

    if (!authResult.data) {
      return res.status(401).json({ message: authResult.meta.fallbackReason, meta: authResult.meta });
    }

    const { sessionId, session } = await sessionStore.create(createSessionFromAuthUser(authResult.data));
    setSessionCookie(res, sessionId);
    return res.status(201).json(session);
  });

  app.post("/api/auth/logout", async (req, res) => {
    const sessionId = getSessionIdFromCookie(req.headers.cookie);
    if (sessionId) await sessionStore.destroy(sessionId);
    clearSessionCookie(res);
    return res.status(204).send();
  });

  app.get("/api/auth/me", requireSession, (req, res) => {
    return res.json(req.workbenchSession);
  });

  app.post("/api/auth/active-facility", requireSession, async (req, res) => {
    const nextFacility = String(req.body?.activeFacility || "");
    const session = req.workbenchSession;

    if (!session || !req.sessionId) return res.status(401).json({ message: "Authentication required" });
    if (!session.grantedFacilities.includes(nextFacility)) {
      return res.status(403).json({ message: "Facility is not granted" });
    }

    const updated = await sessionStore.update(req.sessionId, { activeFacility: nextFacility });
    return res.json(updated);
  });

  app.post("/api/auth/active-role", requireSession, async (req, res) => {
    const nextRole = String(req.body?.activeRole || "") as WorkbenchRole;
    const session = req.workbenchSession;

    if (!session || !req.sessionId) return res.status(401).json({ message: "Authentication required" });
    if (!workbenchRoles.includes(nextRole)) return res.status(400).json({ message: "Unknown workbench role" });
    if (!hasRole(session, nextRole)) return res.status(403).json({ message: "Role is not granted" });

    const updated = await sessionStore.update(req.sessionId, { activeRole: nextRole });
    return res.json(updated);
  });
};
