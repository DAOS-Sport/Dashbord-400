import type { ClientErrorDto, UiEventDto } from "@shared/telemetry/events";
import { auditLogs, clientErrors, uiEvents } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import type { AuditEventInput } from "../../shared/telemetry/audit-writer";
import { env } from "../../shared/config/env";
import { db } from "../../db";

export interface StoredUiEvent extends UiEventDto {
  receivedAt: string;
  userId?: string;
  role?: string;
  facilityKey?: string;
  sessionIdHash?: string;
}

export interface StoredClientError extends ClientErrorDto {
  receivedAt: string;
  userId?: string;
  role?: string;
  facilityKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryOverview {
  totalEvents: number;
  totalClientErrors: number;
  latestEvents: StoredUiEvent[];
  latestErrors: StoredClientError[];
}

export interface TrainingViewRecord {
  id?: number;
  resourceId?: string;
  title?: string;
  mediaType?: string;
  url?: string;
  userId?: string;
  role?: string;
  facilityKey?: string;
  page: string;
  occurredAt: string;
  correlationId?: string;
}

export interface TrainingViewReport {
  totalViews: number;
  uniqueViewers: number;
  uniqueResources: number;
  byResource: Array<{
    resourceId: string;
    title: string;
    mediaType?: string;
    url?: string;
    count: number;
    lastViewedAt: string;
  }>;
  byViewer: Array<{
    userId: string;
    role?: string;
    facilityKey?: string;
    count: number;
    lastViewedAt: string;
  }>;
  latestViews: TrainingViewRecord[];
}

export interface TelemetryRepository {
  recordUiEvent(event: StoredUiEvent): Promise<void>;
  recordClientError(error: StoredClientError): Promise<void>;
  recordAudit(event: AuditEventInput): Promise<void>;
  getUiEventOverview(): Promise<TelemetryOverview>;
  getTrainingViewReport(): Promise<TrainingViewReport>;
}

const uiEventMemory: StoredUiEvent[] = [];
const clientErrorMemory: StoredClientError[] = [];
const auditMemory: AuditEventInput[] = [];

export const createMemoryTelemetryRepository = (): TelemetryRepository => ({
  async recordUiEvent(event) {
    uiEventMemory.push(event);
  },

  async recordClientError(error) {
    clientErrorMemory.push(error);
  },

  async recordAudit(event) {
    auditMemory.push(event);
    console.info("[audit:memory]", JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
  },

  async getUiEventOverview() {
    return {
      totalEvents: uiEventMemory.length,
      totalClientErrors: clientErrorMemory.length,
      latestEvents: uiEventMemory.slice(-20).reverse(),
      latestErrors: clientErrorMemory.slice(-20).reverse(),
    };
  },

  async getTrainingViewReport() {
    const events = uiEventMemory
      .filter((event) => event.eventType === "TRAINING_VIEW" || event.actionType === "TRAINING_VIEW")
      .slice()
      .reverse()
      .map((event, index) => {
        const payload = payloadRecord(event.payload);
        return {
          id: index + 1,
          resourceId: textFromPayload(payload, "resourceId"),
          title: textFromPayload(payload, "title"),
          mediaType: textFromPayload(payload, "mediaType"),
          url: textFromPayload(payload, "url"),
          userId: event.userId,
          role: event.role,
          facilityKey: event.facilityKey,
          page: event.page,
          occurredAt: event.occurredAt ?? event.receivedAt,
          correlationId: event.correlationId,
        };
      });

    return toTrainingViewReport(events);
  },
});

const toJsonObject = (value: unknown): Record<string, unknown> => {
  if (value === undefined) return {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
};

const toOptionalDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const iso = (value: Date | string | null | undefined): string => {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
};

const payloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const textFromPayload = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const toTrainingViewReport = (events: TrainingViewRecord[], totalViews = events.length): TrainingViewReport => {
  const resources = new Map<string, TrainingViewReport["byResource"][number]>();
  const viewers = new Map<string, TrainingViewReport["byViewer"][number]>();

  events.forEach((event) => {
    if (event.resourceId) {
      const current = resources.get(event.resourceId);
      if (!current) {
        resources.set(event.resourceId, {
          resourceId: event.resourceId,
          title: event.title ?? "未命名教材",
          mediaType: event.mediaType,
          url: event.url,
          count: 1,
          lastViewedAt: event.occurredAt,
        });
      } else {
        current.count += 1;
        if (event.occurredAt > current.lastViewedAt) current.lastViewedAt = event.occurredAt;
      }
    }

    if (event.userId) {
      const current = viewers.get(event.userId);
      if (!current) {
        viewers.set(event.userId, {
          userId: event.userId,
          role: event.role,
          facilityKey: event.facilityKey,
          count: 1,
          lastViewedAt: event.occurredAt,
        });
      } else {
        current.count += 1;
        if (event.occurredAt > current.lastViewedAt) current.lastViewedAt = event.occurredAt;
      }
    }
  });

  return {
    totalViews,
    uniqueViewers: viewers.size,
    uniqueResources: resources.size,
    byResource: Array.from(resources.values()).sort((a, b) => b.count - a.count || b.lastViewedAt.localeCompare(a.lastViewedAt)),
    byViewer: Array.from(viewers.values()).sort((a, b) => b.count - a.count || b.lastViewedAt.localeCompare(a.lastViewedAt)),
    latestViews: events.slice(0, 100),
  };
};

type TelemetryDatabase = typeof db;

export const createPostgresTelemetryRepository = (database: TelemetryDatabase): TelemetryRepository => ({
  async recordUiEvent(event) {
    try {
      await database.insert(uiEvents).values({
        timestamp: toOptionalDate(event.occurredAt ?? event.receivedAt),
        userId: event.userId ?? null,
        role: event.role ?? null,
        facilityKey: event.facilityKey ?? null,
        page: event.page || "unknown",
        componentId: event.componentId ?? null,
        actionType: event.eventType || event.actionType || "ACTION_SUBMIT",
        payload: toJsonObject(event.payload),
        traceId: null,
        correlationId: event.correlationId ?? null,
        sessionIdHash: event.sessionIdHash ?? null,
      });
    } catch (err) {
      console.error("[telemetry:ui_events:write_failed]", err, event);
    }
  },

  async recordClientError(error) {
    const metadata = {
      ...toJsonObject(error.metadata),
      ...(error.componentId ? { componentId: error.componentId } : {}),
      ...(error.correlationId ? { correlationId: error.correlationId } : {}),
    };

    try {
      await database.insert(clientErrors).values({
        userId: error.userId ?? null,
        role: error.role ?? null,
        facilityKey: error.facilityKey ?? null,
        routePath: error.page ?? null,
        message: error.message,
        stack: error.stack ?? null,
        metadata,
        occurredAt: toOptionalDate(error.occurredAt),
      });
    } catch (err) {
      console.error("[telemetry:client_errors:write_failed]", err, error);
    }
  },

  async recordAudit(event) {
    try {
      await database.insert(auditLogs).values({
        actorId: event.actorId ?? null,
        role: event.role ?? null,
        facilityKey: event.facilityKey ?? null,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId ?? null,
        payload: toJsonObject(event.payload),
        ip: null,
        userAgent: null,
        correlationId: event.correlationId ?? null,
        resultStatus: event.resultStatus ?? "success",
      });
    } catch (err) {
      console.error("[telemetry:audit_logs:write_failed]", err, event);
    }
  },

  async getUiEventOverview() {
    const [eventTotal] = await database.select({ count: sql<number>`count(*)::int` }).from(uiEvents);
    const [errorTotal] = await database.select({ count: sql<number>`count(*)::int` }).from(clientErrors);
    const latestEventRows = await database.select().from(uiEvents).orderBy(desc(uiEvents.timestamp)).limit(20);
    const latestErrorRows = await database.select().from(clientErrors).orderBy(desc(clientErrors.createdAt)).limit(20);

    return {
      totalEvents: eventTotal?.count ?? 0,
      totalClientErrors: errorTotal?.count ?? 0,
      latestEvents: latestEventRows.map((event) => ({
        eventType: event.actionType as StoredUiEvent["eventType"],
        page: event.page,
        componentId: event.componentId ?? undefined,
        actionType: event.actionType,
        payload: event.payload ?? {},
        correlationId: event.correlationId ?? undefined,
        occurredAt: iso(event.timestamp),
        receivedAt: iso(event.timestamp),
        userId: event.userId ?? undefined,
        role: event.role ?? undefined,
        facilityKey: event.facilityKey ?? undefined,
        sessionIdHash: event.sessionIdHash ?? undefined,
      })),
      latestErrors: latestErrorRows.map((error) => {
        const metadata = error.metadata ?? {};
        return {
          message: error.message,
          page: error.routePath ?? undefined,
          stack: error.stack ?? undefined,
          componentId: typeof metadata.componentId === "string" ? metadata.componentId : undefined,
          correlationId: typeof metadata.correlationId === "string" ? metadata.correlationId : undefined,
          occurredAt: iso(error.occurredAt),
          receivedAt: iso(error.createdAt),
          userId: error.userId ?? undefined,
          role: error.role ?? undefined,
          facilityKey: error.facilityKey ?? undefined,
          metadata,
        };
      }),
    };
  },

  async getTrainingViewReport() {
    const [eventTotal] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(uiEvents)
      .where(eq(uiEvents.actionType, "TRAINING_VIEW"));
    const rows = await database
      .select()
      .from(uiEvents)
      .where(eq(uiEvents.actionType, "TRAINING_VIEW"))
      .orderBy(desc(uiEvents.timestamp))
      .limit(500);
    const events = rows.map((event) => {
      const payload = payloadRecord(event.payload);
      return {
        id: event.id,
        resourceId: textFromPayload(payload, "resourceId"),
        title: textFromPayload(payload, "title"),
        mediaType: textFromPayload(payload, "mediaType"),
        url: textFromPayload(payload, "url"),
        userId: event.userId ?? undefined,
        role: event.role ?? undefined,
        facilityKey: event.facilityKey ?? undefined,
        page: event.page,
        occurredAt: iso(event.timestamp),
        correlationId: event.correlationId ?? undefined,
      };
    });

    return toTrainingViewReport(events, eventTotal?.count ?? events.length);
  },
});

export const createTelemetryRepository = (): TelemetryRepository => {
  if (env.databaseProfile === "mock" || env.dataSourceMode === "mock") {
    return createMemoryTelemetryRepository();
  }

  return createPostgresTelemetryRepository(db);
};
