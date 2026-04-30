import { env } from "../../shared/config/env";
import { sourceOk, sourceUnavailable } from "../../shared/integrations/source-status";
import { findFacilityLineGroup } from "@shared/domain/facilities";
import type {
  EmployeeHomeDto,
  AnnouncementSummary,
  CampaignSummary,
  HandoverSummary,
  ShiftSummary,
} from "@shared/domain/workbench";
import type { ReplitDataAdapter } from "./adapter";

const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  return [];
};

const readText = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value : fallback);

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");

const withOptionalInternalHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.lineBotInternalToken) {
    headers.Authorization = `Bearer ${env.lineBotInternalToken}`;
    headers["X-Internal-Token"] = env.lineBotInternalToken;
    headers["X-API-Key"] = env.lineBotInternalToken;
  }
  return headers;
};

const normalizeFacilityHome = (facilityKey: string, raw: unknown): EmployeeHomeDto => {
  const facility = findFacilityLineGroup(facilityKey);
  const payload = isObject(raw) ? raw : {};
  const facilityScoped = (item: Record<string, unknown>) => {
    const itemGroupId = readText(item.facilityLineGroupId ?? item.groupId);
    return !facility?.lineGroupId || !itemGroupId || itemGroupId === facility.lineGroupId;
  };
  const announcementItems = [
    ...asArray<Record<string, unknown>>(payload.mustRead),
    ...asArray<Record<string, unknown>>(payload.announcements),
  ].filter(facilityScoped).filter((item) => {
    const candidateType = readText(item.candidateType).toLowerCase();
    const status = readText(item.status).toLowerCase();
    return candidateType !== "ignore" && status !== "vip_chat";
  });
  const seenAnnouncementIds = new Set<string>();
  const announcementsRaw = announcementItems.filter((item, index) => {
    const id = String(item.id ?? item._id ?? `ann-${index}`);
    if (seenAnnouncementIds.has(id)) return false;
    seenAnnouncementIds.add(id);
    return true;
  });
  const handoverRaw = asArray<Record<string, unknown>>(payload.handover);
  const shiftsRaw = asArray<Record<string, unknown>>(payload.shifts || payload.todayShift);

  const announcements: AnnouncementSummary[] = announcementsRaw.map((item, index) => ({
    id: String(item.id ?? item._id ?? `ann-${index}`),
    title: readText(item.title, "未命名公告"),
    summary: readText(item.summary ?? item.body ?? item.content ?? item.originalText, ""),
    content: readText(item.body ?? item.content ?? item.originalText ?? item.summary, ""),
    priority: item.isMustRead || item.priority === "critical" || item.priority === "required"
      ? "required"
      : item.priority === "high"
        ? "high"
        : "normal",
    effectiveRange: readText(item.effectiveRange ?? item.dateRange ?? item.effectiveStartAt ?? item.publishedAt ?? item.detectedAt, "即時"),
    deadlineLabel: readText(item.effectiveEndAt ?? item.endAt ?? item.expiresAt ?? item.effectiveRange, "未設定"),
    linkUrl: readText(item.linkUrl ?? item.actionUrl),
    linkLabel: readText(item.linkLabel ?? item.recommendedAction),
  }));

  const campaigns: CampaignSummary[] = announcementsRaw
    .filter((item) => readText(item.candidateType).toLowerCase() === "campaign")
    .map((item, index) => ({
      id: String(item.id ?? item._id ?? `campaign-${index}`),
      title: readText(item.title, "活動公告"),
      statusLabel: readText(item.recommendedAction ?? item.homeVisibility, "進行中"),
      effectiveRange: readText(item.effectiveRange ?? item.effectiveStartAt ?? item.publishedAt, "即時"),
    }));

  const handover: HandoverSummary[] = handoverRaw.map((item, index) => ({
    id: String(item.id ?? item._id ?? `handover-${index}`),
    title: readText(item.title ?? item.content, "交接事項"),
    content: readText(item.content ?? item.summary ?? item.title, ""),
    authorName: readText(item.authorName ?? item.employeeName, "值班人員"),
    status: "unread",
    facilityKey,
    targetDate: readText(item.targetDate),
    targetShiftLabel: readText(item.targetShiftLabel ?? item.shiftLabel),
    dueLabel: readText(item.dueAt ?? item.effectiveEndAt),
    reportNote: readText(item.reportNote),
  }));

  const shifts: ShiftSummary[] = shiftsRaw.map((item, index) => ({
    id: String(item.id ?? item._id ?? `shift-${index}`),
    label: readText(item.label ?? item.shiftLabel ?? item.name, "班別"),
    timeRange: readText(item.timeRange ?? `${readText(item.startsAt)} - ${readText(item.endsAt)}`, "依排班系統"),
    status: index === 0 ? "active" : "upcoming",
    employeeName: readText(item.employeeName ?? item.displayName),
    venueName: readText(item.venueName ?? item.facilityName),
    startsAt: readText(item.startsAt ?? item.startAt ?? item.startTime),
    endsAt: readText(item.endsAt ?? item.endAt ?? item.endTime),
  }));

  return {
    facility: {
      key: facility?.facilityKey ?? facilityKey,
      name: facility?.fullName ?? readText(payload.facilityName, facilityKey),
      businessDate: new Date().toLocaleDateString("zh-TW"),
      statusLabel: "營運中",
    },
    weather: { status: "unavailable", data: null, meta: { fallbackReason: "天氣資料未由外部來源提供" } },
    tasks: { status: "ok", data: [], meta: { lastSyncAt: new Date().toISOString() } },
    announcements: { status: "ok", data: announcements, meta: { lastSyncAt: new Date().toISOString() } },
    handover: { status: "ok", data: handover, meta: { lastSyncAt: new Date().toISOString() } },
    shortcuts: { status: "ok", data: [], meta: { lastSyncAt: new Date().toISOString() } },
    shifts: { status: "ok", data: shifts, meta: { lastSyncAt: new Date().toISOString() } },
    campaigns: { status: "ok", data: campaigns, meta: { lastSyncAt: new Date().toISOString() } },
    documents: { status: "ok", data: [], meta: { lastSyncAt: new Date().toISOString() } },
    stickyNotes: { status: "ok", data: [], meta: { lastSyncAt: new Date().toISOString() } },
    training: { status: "ok", data: [], meta: { lastSyncAt: new Date().toISOString() } },
  };
};

export const realReplitDataAdapter: ReplitDataAdapter = {
  async getEmployeeHomeProjection(facilityKey) {
    const facility = findFacilityLineGroup(facilityKey);
    if (!facility) {
      return sourceUnavailable(
        "replit-data",
        `Unknown facility or LINE group id: ${facilityKey}`,
        "FACILITY_LINE_GROUP_NOT_FOUND",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);

    try {
      const path = env.lineBotInternalToken
        ? `/api/internal/facility-home/${facility.lineGroupId}/home`
        : `/api/facility-home/${facility.lineGroupId}/home`;
      const url = new URL(path, env.lineBotBaseUrl);

      const response = await fetch(url, {
        headers: withOptionalInternalHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return sourceUnavailable(
          "replit-data",
          text.includes("請使用 LINE 開啟")
            ? "LINE facility-home endpoint requires LIFF context"
            : `Replit data source returned ${response.status}`,
          "REPLIT_DATA_HTTP_ERROR",
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        return sourceUnavailable(
          "line-bot-facility-home",
          text.includes("請使用 LINE 開啟")
            ? "LINE facility-home endpoint requires LIFF context"
            : "LINE facility-home endpoint returned non-JSON response",
          "LINE_BOT_NON_JSON_RESPONSE",
        );
      }

      return sourceOk("line-bot-facility-home", normalizeFacilityHome(facility.facilityKey, await response.json()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LINE Bot facility-home error";
      return sourceUnavailable("line-bot-facility-home", message, "LINE_BOT_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  },
};
