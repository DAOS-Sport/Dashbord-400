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

// ─── Sync metadata cache ──────────────────────────────────────────────────────

interface SyncMeta {
  lastSyncAt: number;
  connected: boolean;
  errorMessage?: string;
  fetchedAt: string;
}

const syncMetaCache = new Map<string, SyncMeta>();

// ─── Quality filter ───────────────────────────────────────────────────────────

const BLACKLIST_RE = /^(test|測試|ignore|admin\s*test|dev|system\s*test|系統測試)/i;
const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff]/;

function isDisplayableCandidate(row: AnnouncementCandidate): boolean {
  if (!row.title || row.title.trim().length < 3) return false;
  if (!row.summary && !row.originalText) return false;
  if (BLACKLIST_RE.test(row.title.trim())) return false;
  // At least one of title or summary must contain CJK characters
  const hasCjk = CJK_RE.test(row.title) || CJK_RE.test(row.summary ?? "");
  return hasCjk;
}

// ─── Scope / role filter ──────────────────────────────────────────────────────

function matchesScopeAndRole(row: AnnouncementCandidate, role?: string): boolean {
  if (!row.scopeType || row.scopeType === "all") return true;
  if (row.scopeType === "role" && row.appliesToRoles?.length) {
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

function campaignStatusLabel(startAt?: Date | null, endAt?: Date | null): string {
  const now = Date.now();
  if (startAt && startAt.getTime() > now) return "即將開始";
  if (endAt) {
    const msLeft = endAt.getTime() - now;
    if (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000) return "即將結束";
  }
  return "進行中";
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
        facility: sql`EXCLUDED.facility`,
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
  await syncCandidatesFromLineBotApi(facilityKey).catch(() => {});
  if (!env.databaseUrl) return [];

  const now = new Date();
  const rows = await db
    .select()
    .from(announcementCandidates)
    .where(
      and(
        eq(announcementCandidates.facility, facilityKey),
        inArray(announcementCandidates.candidateType, [...IMPORTANT_TYPES]),
        inArray(announcementCandidates.status, [...APPROVED_STATUSES]),
        or(isNull(announcementCandidates.endAt), gte(announcementCandidates.endAt, now)),
      ),
    )
    .orderBy(desc(announcementCandidates.detectedAt))
    .limit(limit * 5);

  return rows
    .filter(isDisplayableCandidate)
    .filter((r) => matchesScopeAndRole(r, role))
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        (b.detectedAt?.getTime() ?? 0) - (a.detectedAt?.getTime() ?? 0),
    )
    .slice(0, limit)
    .map((r): AnnouncementSummary => {
      const rank = priorityRank(r.priority);
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
      };
    });
}

export async function getCampaignAnnouncements(
  facilityKey: string,
  limit = 5,
): Promise<CampaignSummary[]> {
  await syncCandidatesFromLineBotApi(facilityKey).catch(() => {});
  if (!env.databaseUrl) return [];

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(announcementCandidates)
    .where(
      and(
        eq(announcementCandidates.facility, facilityKey),
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

  return rows
    .filter(isDisplayableCandidate)
    .slice(0, limit)
    .map((r): CampaignSummary => ({
      id: `candidate-campaign-${r.id}`,
      title: r.title,
      statusLabel: campaignStatusLabel(r.startAt, r.endAt),
      effectiveRange: formatEffectiveRange(r.startAt, r.detectedAt, r.endAt),
    }));
}

// ─── Source status & cache invalidation ──────────────────────────────────────

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

export function invalidateCandidateCache(facilityKey?: string): void {
  if (facilityKey) {
    syncMetaCache.delete(facilityKey);
  } else {
    syncMetaCache.clear();
  }
}
