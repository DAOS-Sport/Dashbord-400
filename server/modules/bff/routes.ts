import type { Express, Request, Response } from "express";
import type { AppContainer } from "../../app/container";
import type { ScheduleShift } from "../../integrations/schedule/adapter";
import { facilityLabel, facilityLineGroups, findFacilityLineGroup } from "@shared/domain/facilities";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";
import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  EmployeeHomeDto,
  HandoverSummary,
  ShiftBoardDto,
  ShiftSummary,
  ShortcutSummary,
  StaffMemberSummary,
  StickyNoteSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import type { OperationalHandover, Task } from "@shared/schema";
import type { BffSection } from "@shared/bff/envelope";
import { getModuleDescriptorsByRole, getNavigationModules, type HomeCardDto } from "@shared/modules";
import { storage } from "../../storage";
import { env } from "../../shared/config/env";
import { degraded, ok, unavailable } from "../../shared/bff/section";
import { sourceUnavailable } from "../../shared/integrations/source-status";
import {
  getSupervisorDashboardFromSources,
  getSupervisorDashboardMock,
  getSystemOverviewFromSources,
  getSystemOverviewMock,
} from "./employee-home";

const shortcutTones: ShortcutSummary["tone"][] = ["blue", "green", "amber", "violet", "rose", "cyan"];

const defaultEmployeeShortcuts: ShortcutSummary[] = [
  { id: "clock", label: "點名 / 打卡", href: "/employee/checkins", tone: "blue" },
  { id: "handover", label: "交辦事項", href: "/employee/handover", tone: "green" },
  { id: "counter-handover", label: "櫃位交接", href: "/employee/handover", tone: "amber" },
  { id: "announcements", label: "群組公告", href: "/employee/announcements", tone: "violet" },
  { id: "today-ticket", label: "今日鑰票", href: "/employee/more", tone: "rose" },
  { id: "more", label: "更多入口", href: "/employee/more", tone: "cyan" },
  { id: "sticky-notes", label: "我的便利貼", href: "/employee/personal-note", tone: "blue" },
];

const employeeModuleDescriptorMap = new Map(
  getModuleDescriptorsByRole("employee").map((descriptor) => [descriptor.id, descriptor]),
);

const sectionToCard = <T>(
  moduleId: string,
  title: string,
  order: number,
  routePath: string | undefined,
  section: BffSection<T>,
  emptyText: string,
  notConnectedText: string,
): HomeCardDto => {
  const descriptor = employeeModuleDescriptorMap.get(moduleId);
  const stage = descriptor?.stage ?? "planned";
  const data = section.data;
  const isArray = Array.isArray(data);
  const isEmpty = data == null || (isArray && data.length === 0);
  const notConnected = section.status === "unavailable";
  const status: HomeCardDto["status"] = stage === "production-ready"
    ? notConnected
      ? "error"
      : isEmpty
        ? "empty"
        : "ready"
    : stage === "bff-wired"
      ? "incomplete"
      : "not_connected";
  return {
    moduleId,
    title,
    status,
    routePath,
    order,
    payload: data,
    sourceStatus: {
      source: descriptor?.bffEndpoint ?? section.meta.errorCode ?? moduleId,
      connected: stage === "production-ready" || stage === "bff-wired",
      lastSyncedAt: section.meta.lastSyncAt,
      errorMessage: status === "not_connected"
        ? notConnectedText
        : status === "incomplete"
          ? `${title} 已接上 BFF，但尚未達到 production-ready。`
          : status === "error"
            ? section.meta.fallbackReason ?? notConnectedText
            : isEmpty
              ? emptyText
              : undefined,
    },
  };
};

const formatBusinessDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const buildShiftBoardFromSummaries = (
  facilityKey: string,
  userId: string,
  shifts: ShiftSummary[] | null | undefined,
  source: { connected: boolean; lastSyncedAt?: string; errorMessage?: string },
): ShiftBoardDto => {
  const nowIso = new Date().toISOString();
  const nowTime = Date.parse(nowIso);
  const grouped = new Map<string, ShiftBoardDto["shifts"][number]>();

  (shifts ?? [])
    .filter((shift) => shift.startsAt && shift.endsAt)
    .forEach((shift) => {
      const start = shift.startsAt!;
      const end = shift.endsAt!;
      const key = `${start}|${end}`;
      const startTime = Date.parse(start);
      const endTime = Date.parse(end);
      const current = grouped.get(key) ?? {
        shiftId: key,
        start,
        end,
        isCurrent: Number.isFinite(startTime) && Number.isFinite(endTime) && nowTime >= startTime && nowTime < endTime,
        isFuture: Number.isFinite(startTime) && startTime > nowTime,
        people: [],
      };
      const personId = shift.id || `${shift.employeeName ?? "unknown"}-${current.people.length}`;
      current.people.push({
        userId: personId,
        name: shift.employeeName || shift.label.split("/")[0]?.trim() || "未命名",
        role: shift.kind || shift.label.split("/")[1]?.trim() || "當班",
        isCurrentUser: Boolean(userId && (personId === userId || shift.employeeName === userId)),
      });
      grouped.set(key, current);
    });

  const boardShifts = Array.from(grouped.values())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  return {
    facility: {
      key: facilityKey,
      name: facilityLabel(facilityKey),
    },
    date: formatBusinessDate(),
    now: nowIso,
    currentUserId: userId,
    shifts: boardShifts,
    totalCount: boardShifts.reduce((sum, shift) => sum + shift.people.length, 0),
    sourceStatus: {
      connected: source.connected,
      lastSyncedAt: source.lastSyncedAt,
      errorMessage: source.errorMessage,
    },
  };
};

const attachEmployeeHomeContract = (dto: EmployeeHomeDto, req: Request): EmployeeHomeDto => {
  const session = req.workbenchSession;
  const facilityName = facilityLabel(session?.activeFacility ?? dto.facility.key);
  const navigation = getNavigationModules("employee", session?.permissionsSnapshot);
  const bookingSnapshotCard: HomeCardDto = {
    moduleId: "booking-snapshot",
    title: "報名 / 課程",
    status: "not_connected",
    routePath: "/employee/more",
    order: 55,
    payload: null,
    sourceStatus: {
      source: "/api/bff/employee/home",
      connected: false,
      errorMessage: "報名 / 課程模組已註冊，但 booking provider 尚未接線。",
    },
  };
  const todayTasks = sectionToCard("tasks", "今日任務", 10, "/employee/tasks", dto.tasks, "今日沒有任務。", "任務模組已註冊，但資料來源尚未接線。");
  const handover = sectionToCard("handover", "櫃台交辦", 20, "/employee/handover", dto.handover, "尚未設定櫃台交辦。", "櫃台交辦資料暫時無法取得。");
  const handoverItems = (dto.handover.data ?? [])
    .filter((item) => item.status === "pending" || item.status === "unread" || item.status === "read")
    .filter((item) => !item.dueLabel || Date.parse(item.dueLabel) >= Date.now() || Number.isNaN(Date.parse(item.dueLabel)))
    .map((item) => ({
      id: item.id,
      title: item.title,
      preview: item.content ?? item.reportNote ?? "",
      dueDate: item.dueLabel ?? item.targetDate ?? "",
      status: item.status === "expired" ? "expired" : item.status === "completed" || item.status === "confirmed" ? "completed" : "pending",
    }))
    .slice(0, 5);
  handover.payload = {
    title: "櫃台交辦",
    items: handoverItems,
    totalPending: handoverItems.length,
    primaryAction: {
      label: "新增交辦事項",
      action: "open_drawer",
    },
    viewAllRoute: "/employee/handover",
  };
  const announcements = sectionToCard("announcements", "群組重要公告", 30, "/employee/announcements", dto.announcements, "目前沒有公告。", "公告模組已註冊，但資料來源尚未接線。");
  const quickActions = sectionToCard("quick-links", "快速操作", 40, "/employee/more", dto.shortcuts, "目前沒有快速操作。", "快速操作已註冊，但資料來源尚未接線。");
  quickActions.payload = defaultEmployeeShortcuts;
  const shiftReminder = sectionToCard("shift-reminder", "今日班表", 50, "/employee/shift", dto.shifts, "目前沒有班表資料。", "班表模組已註冊，但外部排班來源尚未接線。");
  shiftReminder.payload = buildShiftBoardFromSummaries(dto.facility.key, session?.userId ?? "", dto.shifts.data, {
    connected: dto.shifts.status !== "unavailable",
    lastSyncedAt: dto.shifts.meta.lastSyncAt,
    errorMessage: dto.shifts.status === "unavailable" ? dto.shifts.meta.fallbackReason ?? "班表資料暫時無法取得。" : undefined,
  });
  return {
    ...dto,
    homeCards: {
      todayTasks,
      announcements,
      handover,
      quickActions,
      shiftReminder,
      bookingSnapshot: bookingSnapshotCard,
    },
    currentUser: {
      id: session?.userId ?? "anonymous",
      displayName: session?.displayName ?? "未登入員工",
      role: "employee",
      facilityName,
    },
    date: dto.facility.businessDate,
    quickSearch: {
      placeholder: "搜尋模組、公告、交接、班表或 Q&A",
      enabledModules: ["tasks", "handover", "announcements", "shift-reminder", "knowledge-base-qna"],
    },
    todayTasks,
    handoverSummary: handover,
    importantAnnouncements: announcements,
    quickActions,
    todayShift: shiftReminder,
    weatherCard: sectionToCard("weather-widget", "天氣卡片", 60, undefined, dto.weather, "目前沒有天氣資料。", "天氣卡片已註冊，但資料來源尚未接線。"),
    navigation,
    unreadCounts: {
      announcements: (dto.announcements.data ?? []).filter((item) => item.priority === "required" && !item.isAcknowledged).length,
      tasks: (dto.tasks.data ?? []).filter((item) => item.status !== "done").length,
      handovers: (dto.handover.data ?? []).filter((item) => item.status !== "confirmed" && item.status !== "completed").length,
    },
  };
};

const asArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  return [];
};

const readText = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value : fallback);

const isImageUrl = (value: unknown) =>
  typeof value === "string" && /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value.trim());

const isAnnouncementType = (value: unknown): value is NonNullable<AnnouncementSummary["type"]> =>
  value === "required" || value === "sop" || value === "notice" || value === "event" || value === "general";

const parseAnnouncementResourceContent = (content: string | null) => {
  if (!content) return { body: "", type: "notice" as NonNullable<AnnouncementSummary["type"]>, scheduledAt: undefined as string | undefined };
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const body = typeof parsed.body === "string" ? parsed.body : content;
    const type = isAnnouncementType(parsed.type) ? parsed.type : "notice";
    const scheduledAt = typeof parsed.scheduledAt === "string" && parsed.scheduledAt.trim() ? parsed.scheduledAt : undefined;
    return { body, type, scheduledAt };
  } catch {
    return { body: content, type: "notice" as NonNullable<AnnouncementSummary["type"]>, scheduledAt: undefined as string | undefined };
  }
};

const mapEmployeeAnnouncementResource = (item: {
  id: number;
  title: string;
  content: string | null;
  isPinned: boolean;
  createdAt: Date | null;
}): AnnouncementSummary => {
  const parsed = parseAnnouncementResourceContent(item.content);
  const publishedAt = item.createdAt ? item.createdAt.toISOString() : new Date().toISOString();
  return {
    id: `employee-ann-${item.id}`,
    resourceId: item.id,
    title: item.title,
    summary: parsed.body || "員工新增公告",
    content: parsed.body,
    priority: parsed.type === "required" ? "required" : "normal",
    type: parsed.type,
    isPinned: item.isPinned,
    effectiveRange: parsed.scheduledAt ? new Date(parsed.scheduledAt).toLocaleString("zh-TW") : new Date(publishedAt).toLocaleString("zh-TW"),
    publishedAt,
    scheduledAt: parsed.scheduledAt,
  };
};

const announcementSortTime = (item: AnnouncementSummary) => {
  const parsed = Date.parse(item.scheduledAt ?? item.publishedAt ?? item.effectiveRange ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

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
      content: readText(item.body ?? item.content ?? item.originalText ?? item.summary, ""),
      priority: item.status === "pending" || Number(item.confidence ?? 0) >= 0.8 ? "required" : "normal",
      type: item.status === "pending" || Number(item.confidence ?? 0) >= 0.8 ? "required" : "notice",
      isPinned: item.status === "pending" || Number(item.confidence ?? 0) >= 0.8,
      effectiveRange: readText(item.detectedAt ?? item.startAt, "即時"),
      publishedAt: readText(item.detectedAt ?? item.startAt, new Date().toISOString()),
      deadlineLabel: readText(item.effectiveEndAt ?? item.endAt ?? item.expiresAt ?? item.detectedAt ?? item.startAt, "未設定"),
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
  const [handoversResult, operationalHandoversResult, tasksResult, quickLinksResult, employeeResourcesResult, systemAnnouncementsResult, shiftsResult, candidateAnnouncementsResult] = await Promise.allSettled([
    storage.listHandovers(normalizedFacilityKey, 20),
    storage.listOperationalHandovers({ facilityKey: normalizedFacilityKey, limit: 50 }),
    storage.listTasks({ facilityKey: normalizedFacilityKey, limit: 50 }),
    storage.listQuickLinks(normalizedFacilityKey, false),
    storage.listEmployeeResources({ facilityKey: normalizedFacilityKey, limit: 100 }),
    storage.listSystemAnnouncements(normalizedFacilityKey, false),
    env.dataSourceMode === "mock"
      ? Promise.resolve(sourceUnavailable<ScheduleShift[]>("smart-schedule", "Smart Schedule is not connected; mock schedule data is disabled for employee shift board.", "SMART_SCHEDULE_NOT_CONNECTED"))
      : container.integrations.schedule.listTodayShifts(normalizedFacilityKey),
    fetchAnnouncementCandidateFallback(normalizedFacilityKey),
  ]);

  const handovers = handoversResult.status === "fulfilled" ? handoversResult.value : [];
  const operationalHandovers = operationalHandoversResult.status === "fulfilled" ? operationalHandoversResult.value : [];
  const employeeTasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const quickLinks = quickLinksResult.status === "fulfilled" ? quickLinksResult.value : [];
  const employeeResources = employeeResourcesResult.status === "fulfilled" ? employeeResourcesResult.value : [];
  const systemAnnouncements = systemAnnouncementsResult.status === "fulfilled" ? systemAnnouncementsResult.value : [];
  const scheduleResult = shiftsResult.status === "fulfilled" ? shiftsResult.value : null;
  const candidateAnnouncements = candidateAnnouncementsResult.status === "fulfilled" ? candidateAnnouncementsResult.value : [];

  const portalAnnouncements: AnnouncementSummary[] = systemAnnouncements.slice(0, 8).map((item) => ({
    id: `portal-ann-${item.id}`,
    title: item.title,
    summary: item.content,
    content: item.content,
    priority: item.severity === "critical" ? "required" : item.severity === "warning" ? "high" : "normal",
    type: item.severity === "critical" ? "required" : "notice",
    isPinned: item.severity === "critical",
    effectiveRange: item.publishedAt ? new Date(item.publishedAt).toLocaleString("zh-TW") : "即時",
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : now,
    deadlineLabel: item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("zh-TW") : "未設定",
  }));
  const resourceAnnouncements = employeeResources
    .filter((item) => item.category === "announcement")
    .map(mapEmployeeAnnouncementResource);

  const mappedHandovers: HandoverSummary[] = [
    ...operationalHandovers.map(mapOperationalHandoverSummary),
    ...handovers.map((item) => ({
      id: `entry-${item.id}`,
      title: item.content,
      content: item.content,
      authorName: item.authorName || "值班人員",
      status: "unread" as const,
      facilityKey: item.facilityKey,
    })),
  ];

  const shortcuts: ShortcutSummary[] = [
    ...defaultEmployeeShortcuts,
    ...quickLinks.slice(0, 6).map((item, index) => ({
      id: `quick-link-${item.id}`,
      label: item.title,
      href: item.url,
      tone: shortcutTones[index % shortcutTones.length],
    })),
  ];

  const documents: DocumentSummary[] = [
    ...employeeResources.filter((item) => item.category === "document").map((item) => ({
      id: `employee-doc-${item.id}`,
      resourceId: item.id,
      title: item.title,
      updatedAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-TW") : "員工新增",
      url: item.url ?? undefined,
      description: item.content ?? undefined,
    })),
    ...quickLinks.slice(0, 8).map((item) => ({
      id: `doc-${item.id}`,
      title: item.title,
      updatedAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-TW") : "Portal",
      url: item.url,
      description: item.description ?? undefined,
    })),
  ].slice(0, 10);

  const shifts: ShiftSummary[] = mapScheduleShifts(scheduleResult?.data ?? []);

  const campaigns: CampaignSummary[] = [
    ...employeeResources.filter((item) => item.category === "event").map((item) => ({
      id: `employee-event-${item.id}`,
      resourceId: item.id,
      title: item.title,
      statusLabel: "員工新增",
      effectiveRange: item.content || "未設定時間",
      linkUrl: item.url ?? undefined,
      imageUrl: isImageUrl(item.url) ? item.url ?? undefined : undefined,
    })),
    ...candidateAnnouncements
      .filter((item) => /活動|課程|營隊|報名|檔期/.test(`${item.title}${item.summary}`))
      .slice(0, 6)
      .map((item) => ({
        id: `campaign-${item.id}`,
        title: item.title,
        statusLabel: item.priority === "required" ? "需確認" : "公告",
        effectiveRange: item.effectiveRange,
      })),
  ].slice(0, 10);

  const stickyNotes: StickyNoteSummary[] = employeeResources
    .filter((item) => item.category === "sticky_note")
    .slice(0, 8)
    .map((item) => ({
      id: `sticky-${item.id}`,
      resourceId: item.id,
      title: item.title,
      content: item.content || "",
      authorName: item.createdByName,
      createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-TW") : "今日",
    }));

  const announcements = [...resourceAnnouncements, ...portalAnnouncements, ...candidateAnnouncements]
    .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || announcementSortTime(b) - announcementSortTime(a))
    .slice(0, 10);

  return {
    facility: {
      key: normalizedFacilityKey,
      name: facility?.fullName ?? normalizedFacilityKey,
      businessDate: new Date().toLocaleDateString("zh-TW"),
      statusLabel: "降級資料",
    },
    layout: ok(defaultEmployeeHomeWidgets, now),
    weather: unavailable("天氣資料尚未接入員工 BFF", "WEATHER_NOT_CONNECTED"),
    tasks: ok(employeeTasks.map(mapTaskSummary), now),
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
    stickyNotes: ok(stickyNotes, now),
  };
};

const mapScheduleShifts = (items: Awaited<ReturnType<AppContainer["integrations"]["schedule"]["listTodayShifts"]>>["data"]): ShiftSummary[] => {
  const now = Date.now();
  return (items ?? [])
    .map((item) => {
      const status: ShiftSummary["status"] = item.startsAt && item.endsAt && Date.parse(item.startsAt) <= now && Date.parse(item.endsAt) >= now
        ? "active"
        : item.endsAt && Date.parse(item.endsAt) < now
          ? "finished"
          : "upcoming";
      return {
        id: item.id,
        label: item.label,
        timeRange: item.startsAt && item.endsAt ? `${item.startsAt} - ${item.endsAt}` : "依排班系統",
        status,
        employeeName: item.employeeName,
        venueName: item.venueName,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        kind: item.kind,
      };
    })
    .sort((a, b) => Date.parse(a.startsAt ?? "") - Date.parse(b.startsAt ?? ""));
};

const getEmployeeResourceSections = async (facilityKey: string) => {
  const resources = await storage.listEmployeeResources({ facilityKey, limit: 100 }).catch(() => []);
  const announcements: AnnouncementSummary[] = resources
    .filter((item) => item.category === "announcement")
    .map(mapEmployeeAnnouncementResource);
  const campaigns: CampaignSummary[] = resources
    .filter((item) => item.category === "event")
    .map((item) => ({
      id: `employee-event-${item.id}`,
      resourceId: item.id,
      title: item.title,
      statusLabel: "員工新增",
      effectiveRange: item.content || "未設定時間",
      linkUrl: item.url ?? undefined,
      imageUrl: isImageUrl(item.url) ? item.url ?? undefined : undefined,
    }));
  const documents: DocumentSummary[] = resources
    .filter((item) => item.category === "document")
    .map((item) => ({
      id: `employee-doc-${item.id}`,
      resourceId: item.id,
      title: item.title,
      updatedAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-TW") : "員工新增",
      url: item.url ?? undefined,
      description: item.content ?? undefined,
    }));
  const stickyNotes: StickyNoteSummary[] = resources
    .filter((item) => item.category === "sticky_note")
    .map((item) => ({
      id: `sticky-${item.id}`,
      resourceId: item.id,
      title: item.title,
      content: item.content || "",
      authorName: item.createdByName,
      createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-TW") : "今日",
    }));
  return { announcements, campaigns, documents, stickyNotes };
};

type SearchItem = {
  id: string;
  type: "announcement" | "handover" | "task" | "shift" | "shortcut" | "document" | "campaign";
  title: string;
  summary: string;
  href: string;
};

const includesQuery = (value: string | undefined, query: string) =>
  String(value || "").toLowerCase().includes(query.toLowerCase());

const buildEmployeeSearchItems = (home: EmployeeHomeDto, query: string): SearchItem[] => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const candidates: SearchItem[] = [
    ...(home.announcements.data ?? []).map((item) => ({
      id: `announcement-${item.id}`,
      type: "announcement" as const,
      title: item.title,
      summary: item.summary || item.content || item.effectiveRange || "",
      href: "/employee/announcements",
    })),
    ...(home.handover.data ?? []).map((item) => ({
      id: `handover-${item.id}`,
      type: "handover" as const,
      title: item.title,
      summary: item.content || item.dueLabel || item.authorName || "",
      href: "/employee/handover",
    })),
    ...(home.tasks.data ?? []).map((item) => ({
      id: `task-${item.id}`,
      type: "task" as const,
      title: item.title,
      summary: item.dueLabel || item.reportNote || item.status,
      href: "/employee/tasks",
    })),
    ...(home.shifts.data ?? []).map((item) => ({
      id: `shift-${item.id}`,
      type: "shift" as const,
      title: item.employeeName || item.label,
      summary: `${item.venueName || home.facility.name} ${item.timeRange || ""}`,
      href: "/employee/shift",
    })),
    ...(home.shortcuts.data ?? []).map((item) => ({
      id: `shortcut-${item.id}`,
      type: "shortcut" as const,
      title: item.label,
      summary: item.href,
      href: item.href,
    })),
    ...(home.campaigns.data ?? []).map((item) => ({
      id: `campaign-${item.id}`,
      type: "campaign" as const,
      title: item.title,
      summary: item.effectiveRange || item.statusLabel,
      href: "/employee/announcements",
    })),
    ...(home.documents.data ?? []).map((item) => ({
      id: `document-${item.id}`,
      type: "document" as const,
      title: item.title,
      summary: item.description || item.updatedAt,
      href: item.url || "/employee/more",
    })),
    ...(home.stickyNotes.data ?? []).map((item) => ({
      id: `sticky-note-${item.id}`,
      type: "document" as const,
      title: item.title,
      summary: item.content,
      href: "/employee",
    })),
  ];

  return candidates
    .filter((item) => includesQuery(`${item.title} ${item.summary} ${item.type}`, normalizedQuery))
    .slice(0, 12);
};

const taskStatusToSummaryStatus = (status: string): TaskSummary["status"] =>
  status === "done" ? "done" : status === "in_progress" ? "in_progress" : "pending";

const mapTaskSummary = (task: Task): TaskSummary => ({
  id: String(task.id),
  title: task.title,
  content: task.content,
  status: taskStatusToSummaryStatus(task.status),
  priority: task.priority === "high" || task.priority === "low" ? task.priority : "normal",
  dueLabel: task.dueAt ? new Date(task.dueAt).toLocaleString("zh-TW") : undefined,
  dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : null,
  createdByName: task.createdByName,
  assignedToName: task.assignedToName,
  source: task.source === "supervisor" || task.source === "system" ? task.source : "employee",
});

const mapOperationalHandoverSummary = (handover: OperationalHandover): HandoverSummary => ({
  id: String(handover.id),
  title: handover.title,
  content: handover.content,
  authorName: handover.createdByName || "主管",
  status: handover.status === "done"
    ? "completed"
    : handover.dueAt && handover.dueAt.getTime() < Date.now()
      ? "expired"
      : "pending",
  facilityKey: handover.facilityKey,
  targetDate: handover.targetDate,
  targetShiftLabel: handover.targetShiftLabel,
  dueLabel: handover.dueAt ? new Date(handover.dueAt).toLocaleString("zh-TW") : `${handover.targetDate} ${handover.targetShiftLabel}`,
  reportNote: handover.reportNote,
  assigneeName: handover.assigneeName,
});

const toTimeRange = (startsAt?: string, endsAt?: string) => startsAt && endsAt
  ? `${new Date(startsAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} - ${new Date(endsAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
  : undefined;

const buildStaffingSummary = async (container: AppContainer, facilityKeys: string[]) => {
  const now = Date.now();
  const [employeeResult, ...shiftResults] = await Promise.all([
    container.integrations.ragicAuth.listActiveEmployees(),
    ...facilityKeys.map((facilityKey) => container.integrations.schedule.listTodayShifts(facilityKey)),
  ]);
  const employees = employeeResult.data ?? [];
  const activeEmployees: StaffMemberSummary[] = employees
    .filter((employee) => facilityKeys.length === 0 || employee.grantedFacilities.some((key) => facilityKeys.includes(key)))
    .map((employee) => ({
      employeeNumber: employee.employeeNumber,
      name: employee.displayName,
      facilityKey: employee.grantedFacilities[0],
      facilityName: employee.grantedFacilities[0] ? facilityLabel(employee.grantedFacilities[0]) : employee.department,
      title: employee.title,
      department: employee.department,
      status: "off" as const,
    }));

  const shifts = shiftResults.flatMap((result) => result.data ?? []);
  const currentOnDuty: StaffMemberSummary[] = shifts
    .filter((shift) => shift.startsAt && shift.endsAt && Date.parse(shift.startsAt) <= now && Date.parse(shift.endsAt) >= now)
    .map((shift) => ({
      employeeNumber: shift.employeeNumber,
      name: shift.employeeName || shift.label,
      facilityKey: shift.facilityKey,
      facilityName: shift.venueName || facilityLabel(shift.facilityKey),
      shiftLabel: shift.kind || "當班",
      timeRange: toTimeRange(shift.startsAt, shift.endsAt),
      status: "active" as const,
    }));
  const nextOnDuty: StaffMemberSummary[] = shifts
    .filter((shift) => shift.startsAt && Date.parse(shift.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 20)
    .map((shift) => ({
      employeeNumber: shift.employeeNumber,
      name: shift.employeeName || shift.label,
      facilityKey: shift.facilityKey,
      facilityName: shift.venueName || facilityLabel(shift.facilityKey),
      shiftLabel: shift.kind || "下一班",
      timeRange: toTimeRange(shift.startsAt, shift.endsAt),
      status: "upcoming" as const,
    }));

  return {
    active: activeEmployees.length,
    total: activeEmployees.length,
    onShift: currentOnDuty.length,
    absent: Math.max(activeEmployees.length - currentOnDuty.length, 0),
    activeEmployees,
    currentOnDuty,
    nextOnDuty,
    byFacility: facilityKeys.map((facilityKey) => ({
      facilityKey,
      facilityName: facilityLabel(facilityKey),
      active: activeEmployees.filter((employee) => employee.facilityKey === facilityKey || employee.department?.includes(findFacilityLineGroup(facilityKey)?.ragicDepartmentAliases[0] ?? facilityKey)).length,
      onShift: currentOnDuty.filter((employee) => employee.facilityKey === facilityKey).length,
      next: nextOnDuty.filter((employee) => employee.facilityKey === facilityKey).length,
    })),
  };
};

const enrichEmployeeHome = async (
  dto: EmployeeHomeDto,
  facilityKey: string,
  container: AppContainer,
): Promise<EmployeeHomeDto> => {
  const normalizedFacilityKey = findFacilityLineGroup(facilityKey)?.facilityKey ?? facilityKey;
  const now = new Date().toISOString();
  const currentShiftCount = dto.shifts.data?.length ?? 0;
  const layoutSetting = await storage.getWidgetLayout({
    facilityKey: normalizedFacilityKey,
    role: "employee",
    layoutKey: "employee-home",
  }).catch(() => null);
  let nextDto: EmployeeHomeDto = {
    ...dto,
    layout: ok(normalizeWidgetLayout(layoutSetting?.widgets, defaultEmployeeHomeWidgets), now),
    stickyNotes: dto.stickyNotes ?? ok([], now),
  };
  const employeeResources = await getEmployeeResourceSections(normalizedFacilityKey);
  const localTasks = await storage.listTasks({ facilityKey: normalizedFacilityKey, limit: 50 }).catch(() => []);
  nextDto = {
    ...nextDto,
    tasks: ok(localTasks.map(mapTaskSummary), now),
    shortcuts: ok(defaultEmployeeShortcuts, now),
    announcements: ok(
      [...employeeResources.announcements, ...(nextDto.announcements.data ?? [])]
        .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || announcementSortTime(b) - announcementSortTime(a))
        .slice(0, 10),
      now,
    ),
    campaigns: ok([...employeeResources.campaigns, ...(nextDto.campaigns.data ?? [])].slice(0, 10), now),
    documents: ok([...employeeResources.documents, ...(nextDto.documents.data ?? [])].slice(0, 10), now),
    stickyNotes: ok([...employeeResources.stickyNotes, ...(nextDto.stickyNotes.data ?? [])].slice(0, 8), now),
  };

  const handovers = await storage.listOperationalHandovers({ facilityKey: normalizedFacilityKey, limit: 50 }).catch(() => []);
  if (handovers.length > 0) {
    nextDto = {
      ...nextDto,
      handover: ok([...(nextDto.handover.data ?? []), ...handovers.map(mapOperationalHandoverSummary)], now),
    };
  }

  if (currentShiftCount > 0) return nextDto;
  if (env.dataSourceMode === "mock") return nextDto;

  const scheduleResult = await container.integrations.schedule.listTodayShifts(normalizedFacilityKey);
  if (!scheduleResult.data?.length) return nextDto;

  return {
    ...nextDto,
    shifts: degraded(mapScheduleShifts(scheduleResult.data), ["line-bot-facility-home-today-shift"], now),
  };
};

const attachAnnouncementAcknowledgements = async (
  dto: EmployeeHomeDto,
  facilityKey: string,
  userId?: string,
): Promise<EmployeeHomeDto> => {
  if (!userId || !dto.announcements.data?.length) return dto;
  const normalizedFacilityKey = findFacilityLineGroup(facilityKey)?.facilityKey ?? facilityKey;
  const acknowledgements = await storage.listAnnouncementAcknowledgements({
    facilityKey: normalizedFacilityKey,
    userId,
  }).catch(() => []);
  if (!acknowledgements.length) {
    return {
      ...dto,
      announcements: {
        ...dto.announcements,
        data: dto.announcements.data.map((item) => ({ ...item, isAcknowledged: false })),
      },
    };
  }
  const acknowledgementById = new Map(acknowledgements.map((item) => [item.announcementId, item]));
  return {
    ...dto,
    announcements: {
      ...dto.announcements,
      data: dto.announcements.data.map((item) => {
        const acknowledgement = acknowledgementById.get(item.id);
        return {
          ...item,
          isAcknowledged: Boolean(acknowledgement),
          acknowledgedAt: acknowledgement?.acknowledgedAt?.toISOString(),
        };
      }),
    },
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
      const fallbackHome = await buildEmployeeHomeFallback(
        facilityKey,
        container,
        result.meta.fallbackReason || "Employee home projection is unavailable",
      );
      const home = await attachAnnouncementAcknowledgements(fallbackHome, facilityKey, req.workbenchSession?.userId);
      return res.json(attachEmployeeHomeContract(home, req));
    }

    const home = await enrichEmployeeHome(result.data, facilityKey, container);
    const acknowledgedHome = await attachAnnouncementAcknowledgements(home, facilityKey, req.workbenchSession?.userId);
    return res.json(attachEmployeeHomeContract(acknowledgedHome, req));
  });

  app.get("/api/bff/employee/shifts/today", async (req, res) => {
    const requestedFacilityKey = typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined;
    if (
      requestedFacilityKey &&
      req.workbenchSession &&
      !req.workbenchSession.grantedFacilities.includes(requestedFacilityKey)
    ) {
      return res.status(403).json({ message: "Facility is not granted" });
    }
    const facilityKey = requestedFacilityKey || req.workbenchSession?.activeFacility || "xinbei_pool";
    if (env.dataSourceMode === "mock") {
      return res.json(buildShiftBoardFromSummaries(facilityKey, req.workbenchSession?.userId ?? "", [], {
        connected: false,
        errorMessage: "班表資料暫時無法取得。",
      }));
    }
    const result = await container.integrations.schedule.listTodayShifts(facilityKey);
    const shifts = mapScheduleShifts(result.data ?? []);
    return res.json(buildShiftBoardFromSummaries(facilityKey, req.workbenchSession?.userId ?? "", shifts, {
      connected: Boolean(result.data),
      lastSyncedAt: new Date().toISOString(),
      errorMessage: result.data ? undefined : result.meta.fallbackReason || "班表資料暫時無法取得。",
    }));
  });

  app.get("/api/bff/employee/search", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2) return res.json({ query, items: [] });
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
    const home = result.data
      ? await enrichEmployeeHome(result.data, facilityKey, container)
      : await buildEmployeeHomeFallback(facilityKey, container, result.meta.fallbackReason || "Employee home projection is unavailable");

    const items = buildEmployeeSearchItems(home, query);
    await storage.recordPortalEvent({
      employeeNumber: req.workbenchSession?.userId,
      employeeName: req.workbenchSession?.displayName,
      facilityKey,
      eventType: "search",
      target: "employee-home",
      targetLabel: query,
      metadata: JSON.stringify({ resultCount: items.length }),
    }).catch(() => undefined);

    return res.json({ query, items });
  });

  app.get("/api/search/global", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const role = req.workbenchSession?.activeRole ?? "employee";
    const normalizedQuery = query.toLowerCase();
    const moduleMatches = getModuleDescriptorsByRole(role)
      .filter((module) => {
        if (!normalizedQuery) return false;
        return `${module.name} ${module.description} ${module.searchKeywords.join(" ")}`.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 12)
      .map((module) => ({
        id: `module-${module.id}`,
        type: "module",
        moduleId: module.id,
        title: module.name,
        summary: module.description,
        href: module.routePath ?? module.bffEndpoint ?? "#",
      }));
    return res.json({
      query,
      items: moduleMatches,
      sourceStatus: {
        source: "MODULE_REGISTRY",
        connected: true,
        errorMessage: moduleMatches.length ? undefined : "全文搜尋尚未接線；目前只搜尋已註冊模組。",
      },
    });
  });

  app.get("/api/bff/supervisor/dashboard", async (req, res) => {
    const dashboard = env.dataSourceMode === "mock" ? getSupervisorDashboardMock() : await getSupervisorDashboardFromSources();
    const facilityKeys = req.workbenchSession?.grantedFacilities?.length
      ? req.workbenchSession.grantedFacilities
      : facilityLineGroups.map((facility) => facility.facilityKey);
    const facilityKey = req.workbenchSession?.activeFacility || dashboard.facility.key || "xinbei_pool";
    try {
      const [handovers, tasks, staffing] = await Promise.all([
        storage.listOperationalHandovers({ facilityKey, limit: 100 }).catch(() => []),
        storage.listTasks({ facilityKey, limit: 100 }).catch(() => []),
        buildStaffingSummary(container, facilityKeys),
      ]);
      return res.json({
        ...dashboard,
        staffing: ok(staffing),
        incompleteTasks: ok(tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").map(mapTaskSummary)),
        handoverOverview: ok({
          open: handovers.filter((handover) => handover.status !== "done" && handover.status !== "cancelled").length,
          confirmed: handovers.filter((handover) => handover.status === "done").length,
        }),
        shifts: ok([...staffing.currentOnDuty, ...staffing.nextOnDuty].slice(0, 12).map((member, index) => ({
          id: `${member.employeeNumber || member.name}-${index}`,
          label: `${member.name} / ${member.facilityName ?? ""}`.trim(),
          timeRange: member.timeRange ?? "依排班系統",
          status: member.status === "active" ? "active" : "upcoming",
          employeeName: member.name,
          venueName: member.facilityName,
        }))),
      });
    } catch {
      return res.json(dashboard);
    }
  });

  const systemDashboardHandler = async (_req: Request, res: Response) => {
    return res.json(env.dataSourceMode === "mock" ? getSystemOverviewMock() : await getSystemOverviewFromSources());
  };

  app.get("/api/bff/system/overview", systemDashboardHandler);
  app.get("/api/bff/system/dashboard", systemDashboardHandler);
};
