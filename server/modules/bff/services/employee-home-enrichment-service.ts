import { findFacilityLineGroup } from "@shared/domain/facilities";
import {
  defaultEmployeeHomeWidgets,
  normalizeWidgetLayout,
} from "@shared/domain/layout";
import type {
  AnnouncementSummary,
  EmployeeHomeDto,
} from "@shared/domain/workbench";
import type { AppContainer } from "../../../app/container";
import { fetchCwaWeather } from "../../../integrations/weather/cwa-adapter";
import { degraded, ok, unavailable } from "../../../shared/bff/section";
import { env } from "../../../shared/config/env";
import { storage } from "../../../storage";
import { readFacilityLineAnnouncements } from "../../announcement-groups/service";

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
  mapTaskSummary,
} from "./supervisor-dashboard-service";

export const enrichEmployeeHome = async (
  dto: EmployeeHomeDto,
  facilityKey: string,
  container: AppContainer,
): Promise<EmployeeHomeDto> => {
  const normalizedFacilityKey =
    findFacilityLineGroup(facilityKey)?.facilityKey ?? facilityKey;
  const now = new Date().toISOString();
  const currentShiftCount = dto.shifts.data?.length ?? 0;

  // Fetch CWA weather in parallel with layout
  const [layoutSetting, cwaWeather] = await Promise.all([
    storage
      .getWidgetLayout({
        facilityKey: normalizedFacilityKey,
        role: "employee",
        layoutKey: "employee-home",
      })
      .catch(() => null),
    fetchCwaWeather().catch(() => null),
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
    stickyNotes: dto.stickyNotes ?? ok([], now),
    training: dto.training ?? ok([], now),
  };
  const employeeResources = await getEmployeeResourceSections(
    normalizedFacilityKey,
  );
  const lineAnnouncementsResult = await readFacilityLineAnnouncements({
    facilityKey: normalizedFacilityKey,
    limit: 20,
  }).catch((error) => ({
    announcements: [] as AnnouncementSummary[],
    fetchedAt: now,
    sourceStatus: {
      connected: false,
      errorMessage:
        error instanceof Error ? error.message : "LINE 公告群組讀取失敗",
    },
  }));
  const systemAnnouncements = await storage
    .listSystemAnnouncements(normalizedFacilityKey, true)
    .catch(() => []);
  const portalAnnouncements = systemAnnouncements
    .slice(0, 8)
    .map((item) => mapSystemAnnouncementSummary(item, now));
  const localTasks = await storage
    .listTasks({ facilityKey: normalizedFacilityKey, limit: 50 })
    .catch(() => []);
  const announcementsBeforeOverlay = uniqueAnnouncements([
    ...lineAnnouncementsResult.announcements,
    ...employeeResources.announcements,
    ...portalAnnouncements,
  ]).sort(
    (a, b) =>
      Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
      announcementSortTime(b) - announcementSortTime(a),
  );
  const announcements = (
    await applyAnnouncementOverlays(announcementsBeforeOverlay)
  ).slice(0, 10);
  nextDto = {
    ...nextDto,
    tasks: ok(localTasks.map(mapTaskSummary), now),
    shortcuts: ok(defaultEmployeeShortcuts, now),
    announcements: announcementSectionFromSources(
      announcements,
      {
        ...lineAnnouncementsResult.sourceStatus,
        fetchedAt: lineAnnouncementsResult.fetchedAt,
      },
      now,
    ),
    campaigns: ok(
      [...employeeResources.campaigns, ...(nextDto.campaigns.data ?? [])].slice(
        0,
        10,
      ),
      now,
    ),
    documents: ok(
      uniqueDocuments([
        ...employeeResources.documents,
        ...(nextDto.documents.data ?? []),
      ]).slice(0, 10),
      now,
    ),
    stickyNotes: ok(
      [
        ...employeeResources.stickyNotes,
        ...(nextDto.stickyNotes.data ?? []),
      ].slice(0, 8),
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
