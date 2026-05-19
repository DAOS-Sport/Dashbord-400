import { findFacilityLineGroup } from "@shared/domain/facilities";
import { defaultEmployeeHomeWidgets } from "@shared/domain/layout";
import type {
  AnnouncementSummary,
  EmployeeHomeDto,
  ShiftSummary,
} from "@shared/domain/workbench";
import type { AppContainer } from "../../../app/container";
import type { ScheduleShift } from "../../../integrations/schedule/adapter";
import { fetchCwaWeather } from "../../../integrations/weather/cwa-adapter";
import { degraded, ok, unavailable } from "../../../shared/bff/section";
import { env } from "../../../shared/config/env";
import { sourceUnavailable } from "../../../shared/integrations/source-status";
import { storage } from "../../../storage";
import { readFacilityLineAnnouncements } from "../../announcement-groups/service";

import {
  announcementSectionFromSources,
  announcementSortTime,
  applyAnnouncementOverlays,
  fetchAnnouncementCandidateFallback,
  mapSystemAnnouncementSummary,
  uniqueAnnouncements,
} from "./announcement-service";
import {
  mapFallbackCampaigns,
  mapFallbackDocuments,
  mapFallbackHandovers,
  mapFallbackResourceAnnouncements,
  mapFallbackShortcuts,
  mapFallbackTraining,
} from "./employee-home-fallback-mappers";
import { mapScheduleShifts } from "./employee-shift-service";

export const buildEmployeeHomeFallback = async (
  facilityKey: string,
  container: AppContainer,
  fallbackReason: string,
): Promise<EmployeeHomeDto> => {
  const now = new Date().toISOString();
  const facility = findFacilityLineGroup(facilityKey);
  const normalizedFacilityKey = facility?.facilityKey ?? facilityKey;
  const [
    handoversResult,
    operationalHandoversResult,
    quickLinksResult,
    employeeResourcesResult,
    systemAnnouncementsResult,
    shiftsResult,
    candidateAnnouncementsResult,
    lineAnnouncementsResult,
    cwaWeatherResult,
  ] = await Promise.allSettled([
    storage.listHandovers(normalizedFacilityKey, 20),
    storage.listOperationalHandovers({
      facilityKey: normalizedFacilityKey,
      limit: 50,
    }),
    storage.listQuickLinks(normalizedFacilityKey, false),
    storage.listEmployeeResources({
      facilityKey: normalizedFacilityKey,
      limit: 100,
    }),
    storage.listSystemAnnouncements(normalizedFacilityKey, true),
    env.dataSourceMode === "mock"
      ? Promise.resolve(
          sourceUnavailable<ScheduleShift[]>(
            "smart-schedule",
            "Smart Schedule is not connected; mock schedule data is disabled for employee shift board.",
            "SMART_SCHEDULE_NOT_CONNECTED",
          ),
        )
      : container.integrations.schedule.listTodayShifts(normalizedFacilityKey),
    fetchAnnouncementCandidateFallback(normalizedFacilityKey),
    readFacilityLineAnnouncements({
      facilityKey: normalizedFacilityKey,
      limit: 20,
    }),
    fetchCwaWeather(),
  ]);

  const handovers =
    handoversResult.status === "fulfilled" ? handoversResult.value : [];
  const operationalHandovers =
    operationalHandoversResult.status === "fulfilled"
      ? operationalHandoversResult.value
      : [];
  const cwaWeather =
    cwaWeatherResult.status === "fulfilled" ? cwaWeatherResult.value : null;
  const quickLinks =
    quickLinksResult.status === "fulfilled" ? quickLinksResult.value : [];
  const employeeResources =
    employeeResourcesResult.status === "fulfilled"
      ? employeeResourcesResult.value
      : [];
  const systemAnnouncements =
    systemAnnouncementsResult.status === "fulfilled"
      ? systemAnnouncementsResult.value
      : [];
  const scheduleResult =
    shiftsResult.status === "fulfilled" ? shiftsResult.value : null;
  const candidateAnnouncements =
    candidateAnnouncementsResult.status === "fulfilled"
      ? candidateAnnouncementsResult.value
      : [];
  const lineAnnouncements =
    lineAnnouncementsResult.status === "fulfilled"
      ? lineAnnouncementsResult.value.announcements
      : [];
  const lineSource =
    lineAnnouncementsResult.status === "fulfilled"
      ? {
          ...lineAnnouncementsResult.value.sourceStatus,
          fetchedAt: lineAnnouncementsResult.value.fetchedAt,
        }
      : {
          connected: false,
          errorMessage: "LINE 公告群組讀取失敗",
          fetchedAt: now,
        };

  const portalAnnouncements: AnnouncementSummary[] = systemAnnouncements
    .slice(0, 8)
    .map((item) => mapSystemAnnouncementSummary(item, now));
  const resourceAnnouncements =
    mapFallbackResourceAnnouncements(employeeResources);
  const training = mapFallbackTraining(employeeResources);
  const mappedHandovers = mapFallbackHandovers(operationalHandovers, handovers);
  const shortcuts = mapFallbackShortcuts(quickLinks);
  const documents = mapFallbackDocuments(employeeResources, quickLinks);

  const shifts: ShiftSummary[] = mapScheduleShifts(scheduleResult?.data ?? []);

  const campaigns = mapFallbackCampaigns(
    employeeResources,
    candidateAnnouncements,
  );
  const announcementsBeforeOverlay = uniqueAnnouncements([
    ...lineAnnouncements,
    ...resourceAnnouncements,
    ...portalAnnouncements,
  ]).sort(
    (a, b) =>
      Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
      announcementSortTime(b) - announcementSortTime(a),
  );
  const announcements = (
    await applyAnnouncementOverlays(announcementsBeforeOverlay)
  ).slice(0, 10);

  return {
    facility: {
      key: normalizedFacilityKey,
      name: facility?.fullName ?? normalizedFacilityKey,
      businessDate: new Date().toLocaleDateString("zh-TW"),
      statusLabel: "降級資料",
    },
    layout: ok(defaultEmployeeHomeWidgets, now),
    weather: cwaWeather
      ? ok(cwaWeather, now)
      : unavailable("天氣資料無法取得", "CWA_UNAVAILABLE"),
    announcements: announcementSectionFromSources(
      announcements,
      lineSource,
      now,
    ),
    handover:
      handoversResult.status === "fulfilled"
        ? degraded(mappedHandovers, ["line-bot-facility-home"], now)
        : unavailable(
            "Portal handover DB 暫時無法讀取",
            "PORTAL_HANDOVER_UNAVAILABLE",
          ),
    shortcuts: ok(shortcuts, now),
    shifts: scheduleResult?.data
      ? degraded(shifts, ["line-bot-facility-home"], now)
      : unavailable(
          scheduleResult?.meta.fallbackReason ||
            "Smart Schedule 目前需要管理員授權",
          scheduleResult?.meta.errorCode || "SMART_SCHEDULE_UNAVAILABLE",
        ),
    campaigns: campaigns.length
      ? degraded(campaigns, ["line-bot-facility-home"], now)
      : unavailable(
          "活動檔期來源尚未提供 server-to-server 資料",
          "CAMPAIGN_SOURCE_UNAVAILABLE",
        ),
    documents: ok(documents, now),
    training: ok(training, now),
  };
};
