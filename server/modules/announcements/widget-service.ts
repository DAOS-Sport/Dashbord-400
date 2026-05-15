import { createHash } from "crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { announcementCandidates, type AnnouncementCandidate } from "@shared/schema";
import { findFacilityLineGroup } from "@shared/domain/facilities";
import type { AnnouncementSummary, CampaignSummary } from "@shared/domain/workbench";
import { env } from "../../shared/config/env";
import { fetchJsonIfAvailable } from "../bff/services/announcement-fetch-service";
import { asArray, readText } from "../bff/services/resource-mappers";
import { db } from "../../db";

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPORTANT_TYPES = ["rule", "notice", "script"] as const;
const CAMPAIGN_TYPES = ["campaign", "discount"] as const;
const APPROVED_STATUSES = ["published", "approved"] as const;
const SYNC_INTERVAL_MS = 30_000;
const RESULT_CACHE_TTL_MS = 30_000;
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

// ─── Sync metadata cache (throttles LINE Bot API calls) ───────────────────────

interface SyncMeta {
  lastSyncAt: number;
  connected: boolean;
  errorMessage?: string;
  fetchedAt: string;
}

const syncMetaCache = new Map<string, SyncMeta>();

// ─── Result caches (30s TTL keyed by facility + role + limit) ─────────────────

interface ResultCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const importantResultCache = new Map<string, ResultCacheEntry<AnnouncementSummary[]>>();
const campaignResultCache = new Map<string, ResultCacheEntry<CampaignSummary[]>>();

function makeImportantKey(facilityKey: string, role: string | undefined, limit: number): string {
  return `${facilityKey}||${role ?? ""}||${limit}`;
}

function makeCampaignKey(facilityKey: string, limit: number): string {
  return `${facilityKey}||${limit}`;
}

// ─── Quality filter ───────────────────────────────────────────────────────────

const BLACKLIST_RE = /^(test|測試|ignore|admin\s*test|dev|system\s*test|系統測試)/i;
// 中英文：accept CJK, Hiragana, Katakana, and Latin alphanumeric
const READABLE_CHAR_RE = /[a-zA-Z\u4e00-\u9fff\u3040-\u30ff]/;
const MIN_TITLE_LEN = 4;
const MIN_SUMMARY_LEN = 6;

function isDisplayableCandidate(row: AnnouncementCandidate): boolean {
  const title = row.title?.trim() ?? "";
  const summary = (row.summary ?? row.originalText ?? "").trim();
  if (title.length < MIN_TITLE_LEN) return false;
  if (summary.length < MIN_SUMMARY_LEN) return false;
  if (BLACKLIST_RE.test(title)) return false;
  // Title must contain at least one 中文/英文 character
  return READABLE_CHAR_RE.test(title);
}

// ─── Scope / role filter ──────────────────────────────────────────────────────
// scopeType values: "all" | "global" | "group" | "facility" | "multi_facility" | "role"

function matchesScopeAndRole(
  row: AnnouncementCandidate,
  role?: string,
  facilityKey?: string,
): boolean {
  const scope = row.scopeType;
  if (!scope || scope === "all" || scope === "global") return true;
  // "group" and "facility" are already narrowed by the DB query on facility column
  if (scope === "group" || scope === "facility") return true;
  // "multi_facility": facility column holds a comma/JSON list; simple substring check
  if (scope === "multi_facility") {
    if (!facilityKey || !row.facility) return true;
    return row.facility.includes(facilityKey);
  }
  // "role": restrict to rows whose appliesToRoles includes the caller's role
  if (scope === "role") {
    if (!row.appliesToRoles?.length) return true;
    return !!role && row.appliesToRoles.includes(role);
  }
  return true;
}

// ─── Priority ordering ────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = {
  must_read: 0,
  required: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function priorityRank(p: string): number {
  return PRIORITY_RANK[p.toLowerCase()] ?? 2;
}

// ─── Campaign status chip ─────────────────────────────────────────────────────

function campaignStatusChip(startAt?: Date | null, endAt?: Date | null): {
  statusLabel: string;
  isActive: boolean;
} {
  const now = Date.now();
  if (startAt && startAt.getTime() > now) {
    return { statusLabel: "即將開始", isActive: false };
  }
  if (endAt) {
    const msLeft = endAt.getTime() - now;
    if (msLeft > 0 && msLeft <= EXPIRING_SOON_MS) {
      return { statusLabel: "即將結束", isActive: true };
    }
    if (msLeft <= 0) {
      return { statusLabel: "已結束", isActive: false };
    }
  }
  return { statusLabel: "進行中", isActive: true };
}

// ─── Effective range label ────────────────────────────────────────────────────

function formatEffectiveRange(
  startAt?: Date | null,
  detectedAt?: Date | null,
  endAt?: Date | null,
): string {
  const ref = startAt ?? detectedAt;
  if (!ref) return "即時";
  try {
    const dateStr = `${ref.getMonth() + 1}/${ref.getDate()}`;
    if (endAt) {
      return `${dateStr} – ${endAt.getMonth() + 1}/${endAt.getDate()}`;
    }
    return dateStr;
  } catch {
    return "即時";
  }
}

// ─── Date parsing helper ──────────────────────────────────────────────────────

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// ─── LINE Bot API fetch + DB sync ─────────────────────────────────────────────

async function syncCandidatesFromLineBotApi(facilityKey: string): Promise<void> {
  const meta = syncMetaCache.get(facilityKey);
  if (meta && Date.now() - meta.lastSyncAt < SYNC_INTERVAL_MS) return;

  const facility = findFacilityLineGroup(facilityKey);
  const url = new URL("/api/announcement-candidates", env.lineBotBaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "100");
  if (facility?.lineGroupId) url.searchParams.set("groupId", facility.lineGroupId);

  try {
    const payload = await fetchJsonIfAvailable<unknown>(url);
    const rows = asArray<Record<string, unknown>>(payload);

    if (rows.length > 0 && env.databaseUrl) {
      await syncAllToDb(rows, facilityKey);
    }

    syncMetaCache.set(facilityKey, {
      lastSyncAt: Date.now(),
      connected: true,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    syncMetaCache.set(facilityKey, {
      lastSyncAt: Date.now(),
      connected: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      fetchedAt: new Date().toISOString(),
    });
  }
}

async function syncAllToDb(rows: Record<string, unknown>[], facilityKey: string): Promise<void> {
  const now = new Date();
  const insertable = rows
    .map((item) => {
      const originalText = readText(
        item.originalText ?? item.body ?? item.content ?? item.summary,
        "",
      );
      const rawHash = readText(item.contentHash, "");
      const contentHash =
        rawHash ||
        (originalText ? createHash("md5").update(originalText).digest("hex") : "");
      const sourceMessageId = readText(
        item.sourceMessageId ?? item.messageId ?? item.id,
        "",
      );
      const groupId = readText(item.groupId, "");
      if (!contentHash || !sourceMessageId || !groupId) return null;

      // Map extended scope/schedule fields from upstream payload (camelCase and snake_case variants)
      const scopeType = readText(item.scopeType ?? item.scope_type, "") || null;
      const appliesToRoles: string[] | null = Array.isArray(item.appliesToRoles)
        ? (item.appliesToRoles as string[])
        : Array.isArray(item.applies_to_roles)
          ? (item.applies_to_roles as string[])
          : null;
      const startAt = parseDate(item.startAt ?? item.start_at ?? item.startDate);
      const endAt = parseDate(item.endAt ?? item.end_at ?? item.endDate);

      return {
        sourceMessageId,
        sourceMessageIds: [sourceMessageId],
        groupId,
        contentHash,
        originalText: originalText || readText(item.title, ""),
        title: readText(item.title, "未命名"),
        summary: readText(item.summary, ""),
        candidateType: readText(item.candidateType, "notice").toLowerCase(),
        priority: readText(item.priority, "normal"),
        status: readText(item.status, "pending_review").toLowerCase(),
        confidence: Number(item.confidence ?? 0),
        ruleMatched: Boolean(item.ruleMatched),
        reasoningTags: Array.isArray(item.reasoningTags)
          ? (item.reasoningTags as string[])
          : [],
        scopeType,
        appliesToRoles,
        startAt,
        endAt,
        facility: facilityKey,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (!insertable.length) return;

  await db
    .insert(announcementCandidates)
    .values(insertable)
    .onConflictDoUpdate({
      target: announcementCandidates.contentHash,
      set: {
        title: sql`EXCLUDED.title`,
        summary: sql`EXCLUDED.summary`,
        status: sql`EXCLUDED.status`,
        confidence: sql`EXCLUDED.confidence`,
        scopeType: sql`EXCLUDED.scope_type`,
        appliesToRoles: sql`EXCLUDED.applies_to_roles`,
        startAt: sql`EXCLUDED.start_at`,
        endAt: sql`EXCLUDED.end_at`,
        // Cross-facility semantics: if the same content appears in multiple facilities,
        // set facility to NULL (global) so both facilities can see it via the
        // `facility IS NULL OR facility = facilityKey` query condition.
        facility: sql`CASE WHEN announcement_candidates.facility IS DISTINCT FROM EXCLUDED.facility THEN NULL ELSE EXCLUDED.facility END`,
        updatedAt: now,
      },
    })
    .catch((err: unknown) => {
      console.error("[widget-service] DB sync error:", err);
    });
}

// ─── Public widget queries ────────────────────────────────────────────────────

export async function getImportantAnnouncements(
  facilityKey: string,
  role?: string,
  limit = 5,
): Promise<AnnouncementSummary[]> {
  // Check result cache first (30s TTL)
  const cacheKey = makeImportantKey(facilityKey, role, limit);
  const cached = importantResultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // Trigger sync (throttled internally)
  await syncCandidatesFromLineBotApi(facilityKey).catch(() => {});
  if (!env.databaseUrl) return [];

  const now = new Date();
  const rows = await db
    .select()
    .from(announcementCandidates)
    .where(
      and(
        // Include facility-specific rows AND global/null-scope rows
        or(isNull(announcementCandidates.facility), eq(announcementCandidates.facility, facilityKey)),
        inArray(announcementCandidates.candidateType, [...IMPORTANT_TYPES]),
        inArray(announcementCandidates.status, [...APPROVED_STATUSES]),
        or(isNull(announcementCandidates.endAt), gte(announcementCandidates.endAt, now)),
      ),
    )
    .orderBy(desc(announcementCandidates.detectedAt))
    .limit(limit * 5);

  const result = rows
    .filter(isDisplayableCandidate)
    .filter((r) => matchesScopeAndRole(r, role, facilityKey))
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        (b.detectedAt?.getTime() ?? 0) - (a.detectedAt?.getTime() ?? 0),
    )
    .slice(0, limit)
    .map((r): AnnouncementSummary => {
      const rank = priorityRank(r.priority);
      const nowMs = Date.now();
      const isExpiringSoon =
        r.endAt != null &&
        r.endAt.getTime() > nowMs &&
        r.endAt.getTime() - nowMs <= EXPIRING_SOON_MS;
      return {
        id: `candidate-${r.id}`,
        externalReferenceId: r.sourceMessageId,
        title: r.title,
        summary: r.summary,
        priority: rank === 0 ? "required" : rank === 1 ? "high" : "normal",
        type: r.candidateType === "rule" ? "sop" : "notice",
        isPinned: rank === 0,
        effectiveRange: formatEffectiveRange(r.startAt, r.detectedAt, r.endAt),
        publishedAt:
          r.detectedAt?.toISOString() ??
          r.startAt?.toISOString() ??
          now.toISOString(),
        createdAt: r.detectedAt?.toISOString() ?? now.toISOString(),
        sourceType: "candidate",
        sourceLabel: "AI分類",
        sourceRefId: r.sourceMessageId ?? null,
        deadlineLabel: isExpiringSoon ? "即將結束" : undefined,
        isExpiringSoon,
      };
    });

  importantResultCache.set(cacheKey, { data: result, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
  return result;
}

export async function getCampaignAnnouncements(
  facilityKey: string,
  limit = 5,
): Promise<CampaignSummary[]> {
  // Check result cache first (30s TTL)
  const cacheKey = makeCampaignKey(facilityKey, limit);
  const cached = campaignResultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // Trigger sync (throttled internally)
  await syncCandidatesFromLineBotApi(facilityKey).catch(() => {});
  if (!env.databaseUrl) return [];

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(announcementCandidates)
    .where(
      and(
        // Include facility-specific rows AND global/null-scope rows
        or(isNull(announcementCandidates.facility), eq(announcementCandidates.facility, facilityKey)),
        inArray(announcementCandidates.candidateType, [...CAMPAIGN_TYPES]),
        inArray(announcementCandidates.status, [...APPROVED_STATUSES]),
        or(isNull(announcementCandidates.endAt), gte(announcementCandidates.endAt, now)),
        or(
          isNull(announcementCandidates.startAt),
          lte(announcementCandidates.startAt, in14Days),
        ),
      ),
    )
    .orderBy(asc(announcementCandidates.startAt), desc(announcementCandidates.detectedAt))
    .limit(limit * 3);

  const result = rows
    .filter(isDisplayableCandidate)
    .slice(0, limit)
    .map((r): CampaignSummary => {
      const { statusLabel, isActive } = campaignStatusChip(r.startAt, r.endAt);
      return {
        id: `candidate-campaign-${r.id}`,
        title: r.title,
        statusLabel,
        isActive,
        effectiveRange: formatEffectiveRange(r.startAt, r.detectedAt, r.endAt),
      };
    });

  campaignResultCache.set(cacheKey, { data: result, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
  return result;
}

// ─── Source status ────────────────────────────────────────────────────────────

export function getLastSyncStatus(facilityKey: string): {
  connected: boolean;
  errorMessage?: string;
  fetchedAt: string;
} {
  const meta = syncMetaCache.get(facilityKey);
  return {
    connected: meta?.connected ?? true,
    errorMessage: meta?.errorMessage,
    fetchedAt: meta?.fetchedAt ?? new Date().toISOString(),
  };
}

// ─── Cache invalidation ───────────────────────────────────────────────────────
// Call this after any mutation that changes candidate status:
// approve, reject, publish, edit, unpublish

export function invalidateCandidateCache(facilityKey?: string): void {
  if (facilityKey) {
    // Invalidate sync throttle
    syncMetaCache.delete(facilityKey);
    // Invalidate result caches for this facility
    for (const key of importantResultCache.keys()) {
      if (key.startsWith(`${facilityKey}||`)) importantResultCache.delete(key);
    }
    for (const key of campaignResultCache.keys()) {
      if (key.startsWith(`${facilityKey}||`)) campaignResultCache.delete(key);
    }
  } else {
    // Global invalidation (e.g., on bulk operations)
    syncMetaCache.clear();
    importantResultCache.clear();
    campaignResultCache.clear();
  }
}
