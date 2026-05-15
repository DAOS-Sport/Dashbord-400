import type { AppContainer } from "../../app/container";
import { facilityLabel } from "@shared/domain/facilities";
import { calculateCompletionRate, calculateDeltaPct, classifyInsightAnomaly, getModuleDescriptorById, getModuleDescriptors, moduleCompletionEvents } from "@shared/modules";
import type { AuditLogRecord, StoredUiEvent } from "../telemetry/repository";

const safeRead = async <T>(reader: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await reader();
  } catch {
    return fallback;
  }
};

export type InsightsOverview = {
  period: { from: string; to: string; label: string };
  totalEvents: number;
  uniqueUsers: number;
  topModules: Array<{ moduleId: string; label: string; eventCount: number; uniqueUserCount: number; deltaPct: number }>;
  anomalies: Array<{ moduleId: string; label: string; type: "spike" | "drop"; deltaPct: number; currentCount: number; previousCount: number }>;
  byRole: Array<{ role: string; eventCount: number; uniqueUserCount: number }>;
  byFacility: Array<{ facilityKey: string; facilityName: string; eventCount: number }>;
};

export type InsightsModuleDetail = {
  moduleId: string;
  label: string;
  current: { eventCount: number; uniqueUserCount: number; completionRate?: number };
  previous: { eventCount: number; uniqueUserCount: number; completionRate?: number };
  delta: { eventCountPct: number; uniqueUserCountPct: number; completionRatePct?: number };
  dailyBreakdown: Array<{ date: string; eventCount: number; uniqueUserCount: number }>;
  topUsers: Array<{ userId: string; name: string; eventCount: number }>;
  topFacilities: Array<{ facilityKey: string; facilityName: string; eventCount: number }>;
};

interface InsightsCacheEntry<T> {
  expiresAt: number;
  data: T;
}

const insightsCache = new Map<string, InsightsCacheEntry<unknown>>();

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const eventTime = (event: StoredUiEvent | AuditLogRecord) =>
  new Date((event as StoredUiEvent).occurredAt ?? (event as AuditLogRecord).timestamp).getTime();

const inRange = (time: number, from: number, to: number) => Number.isFinite(time) && time >= from && time < to;

const payloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const moduleIdFromRoute = (path?: string) => {
  if (!path) return undefined;
  const clean = path.split("?")[0];
  const exact = getModuleDescriptors().find((module) => module.routePath === clean);
  if (exact) return exact.id;
  const byPrefix = getModuleDescriptors()
    .filter((module) => module.routePath && clean.startsWith(`${module.routePath}/`))
    .sort((a, b) => (b.routePath?.length ?? 0) - (a.routePath?.length ?? 0))[0];
  return byPrefix?.id;
};

const moduleIdFromUiEvent = (event: StoredUiEvent) => {
  const payload = payloadRecord(event.payload);
  const explicit = firstText(payload.moduleId, payload.module, payload.moduleKey);
  if (explicit) return explicit;
  const navEvent = firstText(event.actionType, event.eventType);
  if (navEvent?.startsWith("NAV_CLICK:")) return navEvent.slice("NAV_CLICK:".length);
  return moduleIdFromRoute(event.componentId) ?? moduleIdFromRoute(event.page);
};

const groupCount = <T>(items: T[], keyOf: (item: T) => string | undefined) => {
  const map = new Map<string, { count: number; users: Set<string> }>();
  items.forEach((item) => {
    const key = keyOf(item);
    if (!key) return;
    const current = map.get(key) ?? { count: 0, users: new Set<string>() };
    current.count += 1;
    if ((item as { userId?: string }).userId) current.users.add((item as { userId?: string }).userId!);
    map.set(key, current);
  });
  return map;
};

const moduleLabel = (moduleId: string) => getModuleDescriptorById(moduleId)?.shortName ?? getModuleDescriptorById(moduleId)?.name ?? moduleId;

const isStartEventForModule = (event: StoredUiEvent, moduleId: string) => {
  const binding = moduleCompletionEvents[moduleId];
  if (!binding) return false;
  const expected = binding.startEvent.split(":");
  const action = firstText(event.actionType, event.eventType);
  if (action === binding.startEvent) return true;
  if (expected.length === 2 && action === expected[0] && moduleIdFromUiEvent(event) === expected[1]) return true;
  return action === "CARD_CLICK" && moduleIdFromUiEvent(event) === moduleId;
};

const isCompletionAuditForModule = (audit: AuditLogRecord, moduleId: string) => {
  const binding = moduleCompletionEvents[moduleId];
  return Boolean(binding && audit.action === binding.completionEvent);
};

export const buildInsightsOverview = async (container: AppContainer, periodDays: number): Promise<InsightsOverview> => {
  const key = `overview:${periodDays}`;
  const cached = insightsCache.get(key) as InsightsCacheEntry<InsightsOverview> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const now = Date.now();
  const windowMs = periodDays * 24 * 60 * 60 * 1000;
  const currentFrom = now - windowMs;
  const previousFrom = currentFrom - windowMs;
  const uiEvents = await safeRead(() => container.repositories.telemetry.listUiEvents(2000), []);

  const currentEvents = uiEvents.filter((event) => inRange(eventTime(event), currentFrom, now));
  const previousEvents = uiEvents.filter((event) => inRange(eventTime(event), previousFrom, currentFrom));
  const currentByModule = groupCount(currentEvents, moduleIdFromUiEvent);
  const previousByModule = groupCount(previousEvents, moduleIdFromUiEvent);

  const topModules = Array.from(currentByModule.entries())
    .map(([moduleId, value]) => {
      const previous = previousByModule.get(moduleId)?.count ?? 0;
      return {
        moduleId,
        label: moduleLabel(moduleId),
        eventCount: value.count,
        uniqueUserCount: value.users.size,
        deltaPct: calculateDeltaPct(value.count, previous),
      };
    })
    .sort((a, b) => b.eventCount - a.eventCount || a.moduleId.localeCompare(b.moduleId))
    .slice(0, 10);

  const anomalies = Array.from(new Set([...Array.from(currentByModule.keys()), ...Array.from(previousByModule.keys())]))
    .map((moduleId) => {
      const currentCount = currentByModule.get(moduleId)?.count ?? 0;
      const previousCount = previousByModule.get(moduleId)?.count ?? 0;
      const type = classifyInsightAnomaly(currentCount, previousCount);
      if (!type) return null;
      return {
        moduleId,
        label: moduleLabel(moduleId),
        type,
        deltaPct: calculateDeltaPct(currentCount, previousCount),
        currentCount,
        previousCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  const byRole = Array.from(groupCount(currentEvents, (event) => event.role ?? "unknown").entries())
    .map(([role, value]) => ({ role, eventCount: value.count, uniqueUserCount: value.users.size }))
    .sort((a, b) => b.eventCount - a.eventCount);

  const byFacility = Array.from(groupCount(currentEvents, (event) => event.facilityKey ?? "unknown").entries())
    .map(([facilityKey, value]) => ({ facilityKey, facilityName: facilityKey === "unknown" ? "未知場館" : facilityLabel(facilityKey), eventCount: value.count }))
    .sort((a, b) => b.eventCount - a.eventCount);

  const data = {
    period: {
      from: new Date(currentFrom).toISOString(),
      to: new Date(now).toISOString(),
      label: `近 ${periodDays} 天`,
    },
    totalEvents: currentEvents.length,
    uniqueUsers: new Set(currentEvents.map((event) => event.userId).filter(Boolean)).size,
    topModules,
    anomalies,
    byRole,
    byFacility,
  };
  insightsCache.set(key, { expiresAt: Date.now() + 5 * 60_000, data });
  return data;
};

export const buildModuleInsights = async (
  container: AppContainer,
  moduleId: string,
  periodDays: number,
): Promise<InsightsModuleDetail> => {
  const key = `module:${moduleId}:${periodDays}`;
  const cached = insightsCache.get(key) as InsightsCacheEntry<InsightsModuleDetail> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const now = Date.now();
  const windowMs = periodDays * 24 * 60 * 60 * 1000;
  const currentFrom = now - windowMs;
  const previousFrom = currentFrom - windowMs;
  const [uiEvents, auditRows] = await Promise.all([
    safeRead(() => container.repositories.telemetry.listUiEvents(2000), []),
    safeRead(() => container.repositories.telemetry.listAuditLogs(1000), []),
  ]);
  const currentEvents = uiEvents.filter((event) => moduleIdFromUiEvent(event) === moduleId && inRange(eventTime(event), currentFrom, now));
  const previousEvents = uiEvents.filter((event) => moduleIdFromUiEvent(event) === moduleId && inRange(eventTime(event), previousFrom, currentFrom));
  const currentAudits = auditRows.filter((audit) => isCompletionAuditForModule(audit, moduleId) && inRange(eventTime(audit), currentFrom, now));
  const previousAudits = auditRows.filter((audit) => isCompletionAuditForModule(audit, moduleId) && inRange(eventTime(audit), previousFrom, currentFrom));
  const currentStarts = currentEvents.filter((event) => isStartEventForModule(event, moduleId)).length;
  const previousStarts = previousEvents.filter((event) => isStartEventForModule(event, moduleId)).length;
  const currentRate = calculateCompletionRate(currentStarts, currentAudits.length);
  const previousRate = calculateCompletionRate(previousStarts, previousAudits.length);

  const days = Array.from({ length: periodDays }, (_, index) => {
    const start = new Date(currentFrom + index * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const rows = currentEvents.filter((event) => inRange(eventTime(event), start.getTime(), end.getTime()));
    return {
      date: isoDate(start),
      eventCount: rows.length,
      uniqueUserCount: new Set(rows.map((event) => event.userId).filter(Boolean)).size,
    };
  });

  const byUser = Array.from(groupCount(currentEvents, (event) => event.userId ?? undefined).entries())
    .map(([userId, value]) => ({ userId, name: userId, eventCount: value.count }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 5);
  const byFacility = Array.from(groupCount(currentEvents, (event) => event.facilityKey ?? "unknown").entries())
    .map(([facilityKey, value]) => ({ facilityKey, facilityName: facilityKey === "unknown" ? "未知場館" : facilityLabel(facilityKey), eventCount: value.count }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 5);

  const data = {
    moduleId,
    label: moduleLabel(moduleId),
    current: {
      eventCount: currentEvents.length,
      uniqueUserCount: new Set(currentEvents.map((event) => event.userId).filter(Boolean)).size,
      completionRate: currentRate,
    },
    previous: {
      eventCount: previousEvents.length,
      uniqueUserCount: new Set(previousEvents.map((event) => event.userId).filter(Boolean)).size,
      completionRate: previousRate,
    },
    delta: {
      eventCountPct: calculateDeltaPct(currentEvents.length, previousEvents.length),
      uniqueUserCountPct: calculateDeltaPct(
        new Set(currentEvents.map((event) => event.userId).filter(Boolean)).size,
        new Set(previousEvents.map((event) => event.userId).filter(Boolean)).size,
      ),
      completionRatePct: currentRate !== undefined && previousRate !== undefined ? calculateDeltaPct(currentRate, previousRate) : undefined,
    },
    dailyBreakdown: days,
    topUsers: byUser,
    topFacilities: byFacility,
  };
  insightsCache.set(key, { expiresAt: Date.now() + 5 * 60_000, data });
  return data;
};
