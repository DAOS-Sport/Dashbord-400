import { randomUUID } from "crypto";
import type { AuthMeDto, WorkbenchRole } from "@shared/auth/me";
import { facilityKeysFromRagicDepartments, facilityLineGroups } from "@shared/domain/facilities";
import { DEFAULT_FACILITY_KEY, canonicalizeFacilityKeys } from "@shared/facility/canonical-keys";
import { env } from "../../shared/config/env";
import type { RagicAuthUser } from "../../integrations/ragic/auth-adapter";

export interface SessionRecord extends AuthMeDto {
  issuedAt: string;
  lastActive: string;
}

export interface SessionStore {
  create(input: Omit<SessionRecord, "issuedAt" | "lastActive">): Promise<{ sessionId: string; session: SessionRecord }>;
  get(sessionId: string): Promise<SessionRecord | null>;
  update(sessionId: string, patch: Partial<SessionRecord>): Promise<SessionRecord | null>;
  destroy(sessionId: string): Promise<void>;
}

const sessions = new Map<string, { session: SessionRecord; expiresAt: number }>();

const nowIso = () => new Date().toISOString();
const expiresAt = () => Date.now() + env.sessionTtlSeconds * 1000;

export const createMemorySessionStore = (): SessionStore => ({
  async create(input) {
    const sessionId = randomUUID();
    const timestamp = nowIso();
    const session: SessionRecord = {
      ...input,
      issuedAt: timestamp,
      lastActive: timestamp,
    };
    sessions.set(sessionId, { session, expiresAt: expiresAt() });
    return { sessionId, session };
  },

  async get(sessionId) {
    const record = sessions.get(sessionId);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      sessions.delete(sessionId);
      return null;
    }

    record.session.lastActive = nowIso();
    record.expiresAt = expiresAt();
    return record.session;
  },

  async update(sessionId, patch) {
    const record = sessions.get(sessionId);
    if (!record) return null;
    record.session = { ...record.session, ...patch, lastActive: nowIso() };
    record.expiresAt = expiresAt();
    return record.session;
  },

  async destroy(sessionId) {
    sessions.delete(sessionId);
  },
});

export const createMockSession = (
  userId: string,
  displayName: string,
  isSupervisor = false,
  isLifeguard = false,
  departments: string[] = [],
): Omit<SessionRecord, "issuedAt" | "lastActive"> => ({
  userId,
  displayName,
  grantedRoles: [
    "employee",
    ...(isLifeguard ? ["lifeguard" as const] : []),
    ...(isSupervisor ? ["supervisor" as const, "system" as const] : []),
  ],
  activeRole: isSupervisor ? "supervisor" : isLifeguard ? "lifeguard" : "employee",
  grantedFacilities: resolveGrantedFacilities(isSupervisor, departments),
  activeFacility: resolveGrantedFacilities(isSupervisor, departments)[0] ?? DEFAULT_FACILITY_KEY,
  permissionsSnapshot: [
    "employee:home:read",
    "employee:resources:read",
    "employee:qna:read",
    "employee:checkin:read",
    "employee:booking:read",
    "supervisor:dashboard:read",
    "supervisor:layout:update",
    "system:overview:read",
    "system:module-registry:read",
    "system:audit:read",
    "system:integrations:read",
    "workbench:role:switch",
    "workbench:search",
    "employee:facility:switch",
    "lifeguard:home:read",
    "lifeguard:log:read",
    "lifeguard:log:write",
  ],
});

export const hasRole = (session: SessionRecord, role: WorkbenchRole) => session.grantedRoles.includes(role);

const resolveGrantedFacilities = (isSupervisor: boolean, departments: string[]) => {
  if (isSupervisor) return facilityLineGroups.map((facility) => facility.facilityKey);
  const granted = canonicalizeFacilityKeys(facilityKeysFromRagicDepartments(departments));
  return granted.length > 0 ? granted : [DEFAULT_FACILITY_KEY];
};

export const createSessionFromAuthUser = (user: RagicAuthUser): Omit<SessionRecord, "issuedAt" | "lastActive"> =>
  createMockSession(
    user.userId,
    user.displayName,
    user.isSupervisor === true,
    user.isLifeguard === true || /救生員|救生/.test(`${user.title ?? ""} ${user.department ?? ""} ${(user.departments ?? []).join(" ")}`),
    user.departments ?? (user.department ? [user.department] : []),
  );
