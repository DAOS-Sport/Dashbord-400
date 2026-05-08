import type { Express } from "express";
import type { WorkbenchRole } from "@shared/auth/me";
import type { AppContainer } from "../../app/container";
import { clearSessionCookie, getSessionIdFromCookie, setSessionCookie } from "./cookie";
import { attachSession, requireSession } from "./context";
import { createSessionFromAuthUser, createMemorySessionStore, hasRole } from "./session-store";
import { listRagicH05FacilityCandidates, localFacilityCandidates } from "../../integrations/ragic/facility-adapter";
import { mockRagicAuthAdapter } from "../../integrations/ragic/mock-auth-adapter";

const workbenchRoles: readonly WorkbenchRole[] = ["employee", "lifeguard", "supervisor", "system"];

export const registerAuthRoutes = (app: Express, container: AppContainer) => {
  const sessionStore = createMemorySessionStore();

  app.use(attachSession(sessionStore));

  app.post("/api/auth/login", async (req, res) => {
    const username = String(req.body?.username || req.body?.employeeNumber || "employee");
    const password = String(req.body?.password || "mock");
    const adapter = username === "1111" && password === "1111" ? mockRagicAuthAdapter : container.integrations.ragicAuth;
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

  app.get("/api/auth/facility-candidates", requireSession, async (req, res) => {
    const session = req.workbenchSession;
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const result = await listRagicH05FacilityCandidates();
    const sourceItems = result.data ?? localFacilityCandidates(session.grantedFacilities);
    const granted = new Set(session.grantedFacilities);
    const items = sourceItems
      .filter((item) => granted.has(item.facilityKey))
      .sort((a, b) => Number(b.isRecommended) - Number(a.isRecommended) || a.regionGroup.localeCompare(b.regionGroup, "zh-TW") || a.displayName.localeCompare(b.displayName, "zh-TW"));

    return res.json({
      items,
      sourceStatus: {
        connected: Boolean(result.data),
        source: result.meta.source,
        lastSyncedAt: result.meta.lastSyncAt,
        errorMessage: result.data ? undefined : result.meta.fallbackReason,
      },
    });
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
