import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { announcementCandidates } from "@shared/schema";
import { findFacilityLineGroup } from "@shared/domain/facilities";
import type { AnnouncementSummary, CampaignSummary } from "@shared/domain/workbench";
import { env } from "../../shared/config/env";
import { fetchJsonIfAvailable } from "../bff/services/announcement-fetch-service";
import { asArray, readText } from "../bff/services/resource-mappers";
import { db } from "../../db";

interface RawCandidate {
  id: string;
  candidateType: string;
  status: string;
  confidence: number;
  title: string;
  summary: string;
  originalText: string;
  detectedAt?: string;
  startAt?: string;
  endAt?: string;
  groupId: string;
  sourceMessageId?: string;
  contentHash?: string;
  priority: string;
  ruleMatched: boolean;
  reasoningTags: string[];
}

interface CacheEntry {
  data: RawCandidate[];
  expiresAt: number;
}

const candidateCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

const IMPORTANT_TYPES = new Set(["rule", "notice", "script"]);
const CAMPAIGN_TYPES = new Set(["campaign", "discount"]);
const APPROVED_STATUSES = new Set(["approved", "published", "active"]);

function isDisplayable(r: RawCandidate): boolean {
  return APPROVED_STATUSES.has(r.status) && r.confidence >= 0.6 && r.candidateType !== "ignore";
}

function computeHash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

function formatEffectiveRange(startAt?: string, detectedAt?: string, endAt?: string): string {
  const ref = startAt || detectedAt;
  if (!ref) return "即時";
  try {
    const d = new Date(ref);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    if (endAt) {
      const e = new Date(endAt);
      return `${dateStr} – ${e.getMonth() + 1}/${e.getDate()}`;
    }
    return dateStr;
  } catch {
    return "即時";
  }
}

async function fetchCandidatesForFacility(facilityKey: string): Promise<RawCandidate[]> {
  const cached = candidateCache.get(facilityKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const facility = findFacilityLineGroup(facilityKey);
  const url = new URL("/api/announcement-candidates", env.lineBotBaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "50");
  if (facility?.lineGroupId) url.searchParams.set("groupId", facility.lineGroupId);

  const payload = await fetchJsonIfAvailable<unknown>(url);
  const rows: RawCandidate[] = asArray<Record<string, unknown>>(payload)
    .map((item): RawCandidate => {
      const originalText = readText(item.originalText ?? item.body ?? item.content ?? item.summary, "");
      return {
        id: String(item.id ?? ""),
        candidateType: readText(item.candidateType, "notice").toLowerCase(),
        status: readText(item.status, "").toLowerCase(),
        confidence: Number(item.confidence ?? 0),
        title: readText(item.title, "未命名公告"),
        summary: readText(item.summary ?? item.originalText, ""),
        originalText,
        detectedAt: readText(item.detectedAt, "") || undefined,
        startAt: readText(item.startAt, "") || undefined,
        endAt: readText(item.endAt ?? item.effectiveEndAt ?? item.expiresAt, "") || undefined,
        groupId: readText(item.groupId, ""),
        sourceMessageId: readText(item.sourceMessageId ?? item.messageId ?? item.id, "") || undefined,
        contentHash: readText(item.contentHash, "") || (originalText ? computeHash(originalText) : undefined),
        priority: readText(item.priority, "normal"),
        ruleMatched: Boolean(item.ruleMatched),
        reasoningTags: Array.isArray(item.reasoningTags) ? (item.reasoningTags as string[]) : [],
      };
    })
    .filter((r) => r.id && r.candidateType !== "ignore");

  candidateCache.set(facilityKey, { data: rows, expiresAt: Date.now() + CACHE_TTL_MS });

  syncToDb(rows, facilityKey).catch(() => {});

  return rows;
}

async function syncToDb(rows: RawCandidate[], facilityKey: string): Promise<void> {
  if (!rows.length || !env.databaseUrl) return;
  const now = new Date();
  const insertable = rows
    .filter((r) => r.sourceMessageId && r.contentHash && r.groupId)
    .map((r) => ({
      sourceMessageId: r.sourceMessageId!,
      sourceMessageIds: r.sourceMessageId ? [r.sourceMessageId] : [],
      groupId: r.groupId,
      contentHash: r.contentHash!,
      originalText: r.originalText || r.summary || r.title,
      title: r.title,
      summary: r.summary,
      candidateType: r.candidateType,
      priority: r.priority,
      status: r.status,
      confidence: r.confidence,
      ruleMatched: r.ruleMatched,
      reasoningTags: r.reasoningTags,
      facility: facilityKey,
    }));
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
    .catch(() => {});
}

export async function getImportantAnnouncements(
  facilityKey: string,
  limit = 5,
): Promise<AnnouncementSummary[]> {
  const candidates = await fetchCandidatesForFacility(facilityKey);
  const now = new Date();
  return candidates
    .filter((r) => IMPORTANT_TYPES.has(r.candidateType))
    .filter(isDisplayable)
    .filter((r) => !r.endAt || new Date(r.endAt) > now)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
    .map((r): AnnouncementSummary => ({
      id: `candidate-${r.id}`,
      externalReferenceId: r.sourceMessageId,
      title: r.title,
      summary: r.summary,
      priority: r.priority === "must_read" || r.confidence >= 0.85 ? "required" : "normal",
      type: r.candidateType === "rule" ? "sop" : "notice",
      isPinned: r.confidence >= 0.85,
      effectiveRange: formatEffectiveRange(r.startAt, r.detectedAt, r.endAt),
      publishedAt: r.detectedAt ?? r.startAt ?? now.toISOString(),
      createdAt: r.detectedAt ?? now.toISOString(),
      sourceType: "candidate",
      sourceLabel: "AI分類",
      sourceRefId: r.id || null,
    }));
}

export async function getCampaignAnnouncements(
  facilityKey: string,
  limit = 5,
): Promise<CampaignSummary[]> {
  const candidates = await fetchCandidatesForFacility(facilityKey);
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return candidates
    .filter((r) => CAMPAIGN_TYPES.has(r.candidateType))
    .filter(isDisplayable)
    .filter((r) => !r.endAt || new Date(r.endAt) > now)
    .filter((r) => !r.startAt || new Date(r.startAt) <= in14Days)
    .sort((a, b) =>
      a.startAt && b.startAt
        ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        : 0,
    )
    .slice(0, limit)
    .map((r): CampaignSummary => ({
      id: `candidate-campaign-${r.id}`,
      title: r.title,
      statusLabel:
        r.startAt && new Date(r.startAt) > now ? "即將開始" : "進行中",
      effectiveRange: formatEffectiveRange(r.startAt, r.detectedAt, r.endAt),
    }));
}
