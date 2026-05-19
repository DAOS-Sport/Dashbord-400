import { findFacilityLineGroup } from "@shared/domain/facilities";
import {
  defaultEmployeeHomeWidgets,
  normalizeWidgetLayout,
} from "@shared/domain/layout";
import type { EmployeeHomeDto } from "@shared/domain/workbench";
import type { AppContainer } from "../../../app/container";
import { fetchCwaWeather } from "../../../integrations/weather/cwa-adapter";
import { degraded, ok, unavailable } from "../../../shared/bff/section";
import { env } from "../../../shared/config/env";
import { storage } from "../../../storage";
import { readFacilityLineAnnouncements } from "../../announcement-groups/service";
import {
  getCampaignAnnouncements,
  getImportantAnnouncementsWithBreakdown,
  getLastSyncStatus,
} from "../../announcements/widget-service";
import { mapGroupBroadcastToAnnouncementSummary } from "./group-broadcast-mapper";

import {
  announcementSectionFromSources,
  announcementSortTime,
  applyAnnouncementOverlays,
  mapSystemAnnouncementSummary,
  uniqueAnnouncements,
} from "./announcement-service";
import { getEmployeeResourceSections } from "./employee-resource-section-service";
import { mapScheduleShifts } from "./employee-shift-service";
import { defaultEmployeeShortcuts } from "./home-contract";
import { uniqueDocuments } from "./resource-mappers";
import {
  mapOperationalHandoverSummary,
} from "./supervisor-dashboard-service";

export const enrichEmployeeHome = async (
  dto: EmployeeHomeDto,
  facilityKey: string,
  container: AppContainer,
  role?: string,
): Promise<EmployeeHomeDto> => {
  const normalizedFacilityKey =
    findFacilityLineGroup(facilityKey)?.facilityKey ?? facilityKey;
  const now = new Date().toISOString();
  const currentShiftCount = dto.shifts.data?.length ?? 0;

  // Fetch layout, weather, and candidate widgets in parallel
  const [
    layoutSetting,
    cwaWeather,
    candidateImportantResult,
    candidateCampaigns,
    lineAnnouncementsResult,
    groupBroadcastRows,
  ] =
    await Promise.all([
      storage
        .getWidgetLayout({
          facilityKey: normalizedFacilityKey,
          role: "employee",
          layoutKey: "employee-home",
        })
        .catch(() => null),
      fetchCwaWeather().catch(() => null),
      getImportantAnnouncementsWithBreakdown(normalizedFacilityKey, role, 5).catch(
        () => ({ data: [] as import("@shared/domain/workbench").AnnouncementSummary[], filterBreakdown: { upstreamTotal: 0, approvedTotal: 0, qualityFiltered: 0, scopeFiltered: 0, displayableTotal: 0 } }),
      ),
      getCampaignAnnouncements(normalizedFacilityKey, 5).catch(() => []),
      readFacilityLineAnnouncements({
        facilityKey: normalizedFacilityKey,
        limit: 100,
      }).catch(() => ({
        facility: {
          key: normalizedFacilityKey,
          name: normalizedFacilityKey,
        },
        groups: [],
        announcements: [],
        fetchedAt: now,
        sourceStatus: {
          connected: false,
          errorMessage: "LINE 公告群組讀取失敗",
        },
      })),
      storage.listGroupBroadcasts({ facilityKey: normalizedFacilityKey, limit: 8 }).catch(() => []),
    ]);

  let nextDto: EmployeeHomeDto = {
    ...dto,
    layout: ok(
      normalizeWidgetLayout(layoutSetting?.widgets, defaultEmployeeHomeWidgets),
      now,
    ),
    weather: cwaWeather
      ? ok(cwaWeather, now)
      : unavailable("天氣資料無法取得", "CWA_UNAVAILABLE"),
    training: dto.training ?? ok([], now),
  };

  const [employeeResources, systemAnnouncementRows] =
    await Promise.all([
      getEmployeeResourceSections(normalizedFacilityKey),
      storage.listSystemAnnouncements(normalizedFacilityKey, true).catch(() => []),
    ]);

  const portalAnnouncements = systemAnnouncementRows
    .slice(0, 8)
    .map((item) => mapSystemAnnouncementSummary(item, now));

  const candidateImportant = candidateImportantResult.data;
  const candidateFilterBreakdown = candidateImportantResult.filterBreakdown;

  const groupBroadcastAnnouncements = groupBroadcastRows.map((row) =>
    mapGroupBroadcastToAnnouncementSummary(row),
  );

  const announcementsBeforeOverlay = uniqueAnnouncements([
    ...groupBroadcastAnnouncements,
    ...lineAnnouncementsResult.announcements,
    ...employeeResources.announcements,
    ...portalAnnouncements,
    ...candidateImportant,
  ]).sort(
    (a, b) =>
      Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
      announcementSortTime(b) - announcementSortTime(a),
  );

  const announcements = (
    await applyAnnouncementOverlays(announcementsBeforeOverlay)
  ).slice(0, 100);

  const widgetSyncStatus = getLastSyncStatus(normalizedFacilityKey);
  const lineSourceStatus =
    lineAnnouncementsResult.sourceStatus.connected ||
    lineAnnouncementsResult.announcements.length > 0
      ? {
          ...lineAnnouncementsResult.sourceStatus,
          fetchedAt: lineAnnouncementsResult.fetchedAt,
        }
      : {
          connected: widgetSyncStatus.connected,
          errorMessage: widgetSyncStatus.errorMessage ?? null,
          fetchedAt: widgetSyncStatus.fetchedAt,
        };

  nextDto = {
    ...nextDto,
    shortcuts: ok(defaultEmployeeShortcuts, now),
    announcements: announcementSectionFromSources(
      announcements,
      lineSourceStatus,
      now,
      candidateFilterBreakdown,
    ),
    // Widget B (課程活動): candidate campaigns prepended to employee resource events
    campaigns: ok(
      [
        ...candidateCampaigns,
        ...employeeResources.campaigns,
        ...(nextDto.campaigns.data ?? []),
      ].slice(0, 50),
      now,
    ),
    documents: ok(
      uniqueDocuments([
        ...employeeResources.documents,
        ...(nextDto.documents.data ?? []),
      ]).slice(0, 50),
      now,
    ),
    training: ok(
      [...employeeResources.training, ...(nextDto.training.data ?? [])].slice(
        0,
        12,
      ),
      now,
    ),
  };

  const handovers = await storage
    .listOperationalHandovers({ facilityKey: normalizedFacilityKey, limit: 50 })
    .catch(() => []);
  if (handovers.length > 0) {
    nextDto = {
      ...nextDto,
      handover: ok(
        [
          ...(nextDto.handover.data ?? []),
          ...handovers.map(mapOperationalHandoverSummary),
        ],
        now,
      ),
    };
  }

  if (currentShiftCount > 0) return nextDto;
  if (env.dataSourceMode === "mock") return nextDto;

  const scheduleResult = await container.integrations.schedule.listTodayShifts(
    normalizedFacilityKey,
  );
  if (!scheduleResult.data?.length) return nextDto;

  return {
    ...nextDto,
    shifts: degraded(
      mapScheduleShifts(scheduleResult.data),
      ["line-bot-facility-home-today-shift"],
      now,
    ),
  };
};
