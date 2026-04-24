import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { facilityLabel, facilityLineGroups, findFacilityLineGroup } from "@shared/domain/facilities";
import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  EmployeeHomeDto,
  HandoverSummary,
  ShiftSummary,
  ShortcutSummary,
  StaffMemberSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import type { OperationalHandover } from "@shared/schema";
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
  { id: "handover-board", label: "交班事項", href: "/employee/tasks", tone: "green" },
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
      content: readText(item.body ?? item.content ?? item.originalText ?? item.summary, ""),
      priority: item.status === "pending" || Number(item.confidence ?? 0) >= 0.8 ? "required" : "normal",
      effectiveRange: readText(item.detectedAt ?? item.startAt, "即時"),
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
  const [handoversResult, operationalHandoversResult, quickLinksResult, systemAnnouncementsResult, shiftsResult, candidateAnnouncementsResult] = await Promise.allSettled([
    storage.listHandovers(normalizedFacilityKey, 20),
    storage.listOperationalHandovers({ facilityKey: normalizedFacilityKey, limit: 50 }),
    storage.listQuickLinks(normalizedFacilityKey, false),
    storage.listSystemAnnouncements(normalizedFacilityKey, false),
    container.integrations.schedule.listTodayShifts(normalizedFacilityKey),
    fetchAnnouncementCandidateFallback(normalizedFacilityKey),
  ]);

  const handovers = handoversResult.status === "fulfilled" ? handoversResult.value : [];
  const operationalHandovers = operationalHandoversResult.status === "fulfilled" ? operationalHandoversResult.value : [];
  const quickLinks = quickLinksResult.status === "fulfilled" ? quickLinksResult.value : [];
  const systemAnnouncements = systemAnnouncementsResult.status === "fulfilled" ? systemAnnouncementsResult.value : [];
  const scheduleResult = shiftsResult.status === "fulfilled" ? shiftsResult.value : null;
  const candidateAnnouncements = candidateAnnouncementsResult.status === "fulfilled" ? candidateAnnouncementsResult.value : [];

  const portalAnnouncements: AnnouncementSummary[] = systemAnnouncements.slice(0, 8).map((item) => ({
    id: `portal-ann-${item.id}`,
    title: item.title,
    summary: item.content,
    content: item.content,
    priority: item.severity === "critical" ? "required" : item.severity === "warning" ? "high" : "normal",
    effectiveRange: item.publishedAt ? new Date(item.publishedAt).toLocaleString("zh-TW") : "即時",
    deadlineLabel: item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("zh-TW") : "未設定",
  }));

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
    employeeName: item.employeeName,
    venueName: item.venueName,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
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
    tasks: ok(operationalHandovers.filter((item) => item.status !== "done" && item.status !== "cancelled").map(mapOperationalHandoverTask), now),
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

const mapScheduleShifts = (items: Awaited<ReturnType<AppContainer["integrations"]["schedule"]["listTodayShifts"]>>["data"]): ShiftSummary[] => {
  const now = Date.now();
  return (items ?? []).map((item, index) => ({
    id: item.id,
    label: item.label,
    timeRange: item.startsAt && item.endsAt ? `${item.startsAt} - ${item.endsAt}` : "依排班系統",
    status: item.startsAt && item.endsAt && Date.parse(item.startsAt) <= now && Date.parse(item.endsAt) >= now
      ? "active"
      : item.endsAt && Date.parse(item.endsAt) < now
        ? "finished"
        : index === 0 ? "active" : "upcoming",
    employeeName: item.employeeName,
    venueName: item.venueName,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
  }));
};

const handoverStatusToTaskStatus = (status: string): TaskSummary["status"] =>
  status === "done" ? "done" : status === "reported" ? "reported" : status === "in_progress" || status === "claimed" ? "in_progress" : "pending";

const mapOperationalHandoverTask = (handover: OperationalHandover): TaskSummary => ({
  id: String(handover.id),
  title: `${handover.targetDate} ${handover.targetShiftLabel} · ${handover.title}`,
  status: handoverStatusToTaskStatus(handover.status),
  priority: handover.priority === "high" || handover.priority === "low" ? handover.priority : "normal",
  dueLabel: handover.dueAt ? new Date(handover.dueAt).toLocaleString("zh-TW") : `${handover.targetDate} ${handover.targetShiftLabel}`,
  reportNote: handover.reportNote,
});

const mapOperationalHandoverSummary = (handover: OperationalHandover): HandoverSummary => ({
  id: String(handover.id),
  title: handover.title,
  content: handover.content,
  authorName: handover.createdByName || "主管",
  status: handover.status === "done" ? "confirmed" : handover.status === "reported" ? "read" : "unread",
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
  const currentTaskCount = dto.tasks.data?.length ?? 0;
  let nextDto = dto;

  if (currentTaskCount === 0) {
    const handovers = await storage.listOperationalHandovers({ facilityKey: normalizedFacilityKey, limit: 50 });
    if (handovers.length > 0) {
      nextDto = {
        ...nextDto,
        tasks: ok(handovers.filter((handover) => handover.status !== "done" && handover.status !== "cancelled").map(mapOperationalHandoverTask), now),
        handover: ok([...(nextDto.handover.data ?? []), ...handovers.map(mapOperationalHandoverSummary)], now),
      };
    }
  }

  if (currentShiftCount > 0) return nextDto;

  const scheduleResult = await container.integrations.schedule.listTodayShifts(normalizedFacilityKey);
  if (!scheduleResult.data?.length) return nextDto;

  return {
    ...nextDto,
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

  app.get("/api/bff/supervisor/dashboard", async (req, res) => {
    const dashboard = env.dataSourceMode === "mock" ? getSupervisorDashboardMock() : await getSupervisorDashboardFromSources();
    const facilityKeys = req.workbenchSession?.grantedFacilities?.length
      ? req.workbenchSession.grantedFacilities
      : facilityLineGroups.map((facility) => facility.facilityKey);
    const facilityKey = req.workbenchSession?.activeFacility || dashboard.facility.key || "xinbei_pool";
    try {
      const [handovers, staffing] = await Promise.all([
        storage.listOperationalHandovers({ facilityKey, limit: 100 }),
        buildStaffingSummary(container, facilityKeys),
      ]);
      return res.json({
        ...dashboard,
        staffing: ok(staffing),
        incompleteTasks: ok(handovers.filter((handover) => handover.status !== "done" && handover.status !== "cancelled").map(mapOperationalHandoverTask)),
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

  app.get("/api/bff/system/overview", async (_req, res) => {
    return res.json(env.dataSourceMode === "mock" ? getSystemOverviewMock() : await getSystemOverviewFromSources());
  });
};
