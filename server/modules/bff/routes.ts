import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { findFacilityLineGroup } from "@shared/domain/facilities";
import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  EmployeeHomeDto,
  HandoverSummary,
  ShiftSummary,
  ShortcutSummary,
} from "@shared/domain/workbench";
import { storage } from "../../storage";
import { env } from "../../shared/config/env";
import { degraded, ok, unavailable } from "../../shared/bff/section";
import {
  getSupervisorDashboardFromSources,
  getSupervisorDashboardMock,
  getSystemOverviewFromSources,
  getSystemOverviewMock,
} from "./employee-home";

const shortcutTones: ShortcutSummary["tone"][] = ["blue", "green", "amber", "violet", "rose", "cyan"];

const defaultEmployeeShortcuts: ShortcutSummary[] = [
  { id: "clock", label: "點名 / 打卡", href: "/employee/more", tone: "blue" },
  { id: "tasks", label: "今日任務", href: "/employee/tasks", tone: "green" },
  { id: "handover", label: "櫃台交接", href: "/employee/handover", tone: "amber" },
  { id: "announcements", label: "群組公告", href: "/employee/announcements", tone: "violet" },
  { id: "shift", label: "今日班表", href: "/employee/shift", tone: "rose" },
  { id: "more", label: "更多入口", href: "/employee/more", tone: "cyan" },
];

const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  return [];
};

const readText = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value : fallback);

const fetchJsonIfAvailable = async <T>(url: URL, token?: string): Promise<T | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Internal-Token"] = token;
    headers["X-API-Key"] = token;
  }
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchAnnouncementCandidateFallback = async (facilityKey: string): Promise<AnnouncementSummary[]> => {
  const facility = findFacilityLineGroup(facilityKey);
  const url = new URL("/api/announcement-candidates", env.lineBotBaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "20");
  if (facility?.lineGroupId) url.searchParams.set("groupId", facility.lineGroupId);
  const payload = await fetchJsonIfAvailable<unknown>(url);
  return asArray<Record<string, unknown>>(payload)
    .filter((item) => !facility?.lineGroupId || !readText(item.groupId) || item.groupId === facility.lineGroupId)
    .filter((item) => {
      const candidateType = readText(item.candidateType).toLowerCase();
      const status = readText(item.status).toLowerCase();
      const confidence = Number(item.confidence ?? 0);
      return candidateType !== "ignore" && status !== "vip_chat" && confidence >= 0.7;
    })
    .slice(0, 8)
    .map((item, index) => ({
      id: String(item.id ?? `candidate-${index}`),
      title: readText(item.title, "未命名公告"),
      summary: readText(item.summary ?? item.originalText, ""),
      priority: item.status === "pending" || Number(item.confidence ?? 0) >= 0.8 ? "required" : "normal",
      effectiveRange: readText(item.detectedAt ?? item.startAt, "即時"),
    }));
};

const buildEmployeeHomeFallback = async (
  facilityKey: string,
  container: AppContainer,
  fallbackReason: string,
): Promise<EmployeeHomeDto> => {
  const now = new Date().toISOString();
  const facility = findFacilityLineGroup(facilityKey);
  const normalizedFacilityKey = facility?.facilityKey ?? facilityKey;
  const [handoversResult, quickLinksResult, systemAnnouncementsResult, shiftsResult, candidateAnnouncementsResult] = await Promise.allSettled([
    storage.listHandovers(normalizedFacilityKey, 20),
    storage.listQuickLinks(normalizedFacilityKey, false),
    storage.listSystemAnnouncements(normalizedFacilityKey, false),
    container.integrations.schedule.listTodayShifts(normalizedFacilityKey),
    fetchAnnouncementCandidateFallback(normalizedFacilityKey),
  ]);

  const handovers = handoversResult.status === "fulfilled" ? handoversResult.value : [];
  const quickLinks = quickLinksResult.status === "fulfilled" ? quickLinksResult.value : [];
  const systemAnnouncements = systemAnnouncementsResult.status === "fulfilled" ? systemAnnouncementsResult.value : [];
  const scheduleResult = shiftsResult.status === "fulfilled" ? shiftsResult.value : null;
  const candidateAnnouncements = candidateAnnouncementsResult.status === "fulfilled" ? candidateAnnouncementsResult.value : [];

  const portalAnnouncements: AnnouncementSummary[] = systemAnnouncements.slice(0, 8).map((item) => ({
    id: `portal-ann-${item.id}`,
    title: item.title,
    summary: item.content,
    priority: item.severity === "critical" ? "required" : item.severity === "warning" ? "high" : "normal",
    effectiveRange: item.publishedAt ? new Date(item.publishedAt).toLocaleString("zh-TW") : "即時",
  }));

  const mappedHandovers: HandoverSummary[] = handovers.map((item) => ({
    id: String(item.id),
    title: item.content,
    authorName: item.authorName || "值班人員",
    status: "unread",
  }));

  const shortcuts: ShortcutSummary[] = [
    ...defaultEmployeeShortcuts,
    ...quickLinks.slice(0, 6).map((item, index) => ({
      id: `quick-link-${item.id}`,
      label: item.title,
      href: item.url,
      tone: shortcutTones[index % shortcutTones.length],
    })),
  ];

  const documents: DocumentSummary[] = quickLinks.slice(0, 8).map((item) => ({
    id: `doc-${item.id}`,
    title: item.title,
    updatedAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-TW") : "Portal",
  }));

  const shifts: ShiftSummary[] = (scheduleResult?.data ?? []).map((item, index) => ({
    id: item.id,
    label: item.label,
    timeRange: item.startsAt && item.endsAt ? `${item.startsAt} - ${item.endsAt}` : "依排班系統",
    status: index === 0 ? "active" : "upcoming",
  }));

  const campaigns: CampaignSummary[] = candidateAnnouncements
    .filter((item) => /活動|課程|營隊|報名|檔期/.test(`${item.title}${item.summary}`))
    .slice(0, 6)
    .map((item) => ({
      id: `campaign-${item.id}`,
      title: item.title,
      statusLabel: item.priority === "required" ? "需確認" : "公告",
      effectiveRange: item.effectiveRange,
    }));

  const announcements = [...portalAnnouncements, ...candidateAnnouncements].slice(0, 10);

  return {
    facility: {
      key: normalizedFacilityKey,
      name: facility?.fullName ?? normalizedFacilityKey,
      businessDate: new Date().toLocaleDateString("zh-TW"),
      statusLabel: "降級資料",
    },
    weather: unavailable("天氣資料尚未接入員工 BFF", "WEATHER_NOT_CONNECTED"),
    tasks: degraded([], ["task-projection"], now),
    announcements: announcements.length
      ? degraded(announcements, ["line-bot-facility-home"], now)
      : unavailable("公告候選池與 Portal announcement 目前都沒有可用資料", "ANNOUNCEMENT_FALLBACK_EMPTY"),
    handover: handoversResult.status === "fulfilled"
      ? degraded(mappedHandovers, ["line-bot-facility-home"], now)
      : unavailable("Portal handover DB 暫時無法讀取", "PORTAL_HANDOVER_UNAVAILABLE"),
    shortcuts: ok(shortcuts, now),
    shifts: scheduleResult?.data
      ? degraded(shifts, ["line-bot-facility-home"], now)
      : unavailable(scheduleResult?.meta.fallbackReason || "Smart Schedule 目前需要管理員授權", scheduleResult?.meta.errorCode || "SMART_SCHEDULE_UNAVAILABLE"),
    campaigns: campaigns.length
      ? degraded(campaigns, ["line-bot-facility-home"], now)
      : unavailable("活動檔期來源尚未提供 server-to-server 資料", "CAMPAIGN_SOURCE_UNAVAILABLE"),
    documents: ok(documents, now),
  };
};

const mapScheduleShifts = (items: Awaited<ReturnType<AppContainer["integrations"]["schedule"]["listTodayShifts"]>>["data"]): ShiftSummary[] =>
  (items ?? []).map((item, index) => ({
    id: item.id,
    label: item.label,
    timeRange: item.startsAt && item.endsAt ? `${item.startsAt} - ${item.endsAt}` : "依排班系統",
    status: index === 0 ? "active" : "upcoming",
  }));

const enrichEmployeeHome = async (
  dto: EmployeeHomeDto,
  facilityKey: string,
  container: AppContainer,
): Promise<EmployeeHomeDto> => {
  const normalizedFacilityKey = findFacilityLineGroup(facilityKey)?.facilityKey ?? facilityKey;
  const now = new Date().toISOString();
  const currentShiftCount = dto.shifts.data?.length ?? 0;

  if (currentShiftCount > 0) return dto;

  const scheduleResult = await container.integrations.schedule.listTodayShifts(normalizedFacilityKey);
  if (!scheduleResult.data?.length) return dto;

  return {
    ...dto,
    shifts: degraded(mapScheduleShifts(scheduleResult.data), ["line-bot-facility-home-today-shift"], now),
  };
};

export const registerBffRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/bff/employee/home", async (req, res) => {
    const requestedFacilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined;
    if (
      requestedFacilityKey &&
      req.workbenchSession &&
      !req.workbenchSession.grantedFacilities.includes(requestedFacilityKey)
    ) {
      return res.status(403).json({ message: "Facility is not granted" });
    }
    const facilityKey = requestedFacilityKey || req.workbenchSession?.activeFacility || "xinbei_pool";
    const result = await container.integrations.replitData.getEmployeeHomeProjection(facilityKey);

    if (!result.data) {
      return res.json(await buildEmployeeHomeFallback(
        facilityKey,
        container,
        result.meta.fallbackReason || "Employee home projection is unavailable",
      ));
    }

    return res.json(await enrichEmployeeHome(result.data, facilityKey, container));
  });

  app.get("/api/bff/supervisor/dashboard", async (_req, res) => {
    return res.json(env.dataSourceMode === "mock" ? getSupervisorDashboardMock() : await getSupervisorDashboardFromSources());
  });

  app.get("/api/bff/system/overview", async (_req, res) => {
    return res.json(env.dataSourceMode === "mock" ? getSystemOverviewMock() : await getSystemOverviewFromSources());
  });
};
