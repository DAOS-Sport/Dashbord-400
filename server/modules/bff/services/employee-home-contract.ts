import { facilityLabel } from "@shared/domain/facilities";
import type { EmployeeHomeDto } from "@shared/domain/workbench";
import { getNavigationModules, type HomeCardDto } from "@shared/modules";
import type { Request } from "express";
import { sectionToCard } from "./home-card-contract";
import { defaultEmployeeShortcuts } from "./home-contract-defaults";
import {
  buildShiftBoardFromSummaries,
  filterShiftSummariesForFacility,
} from "./shift-board-contract";

export const attachEmployeeHomeContract = (
  dto: EmployeeHomeDto,
  req: Request,
): EmployeeHomeDto => {
  const session = req.workbenchSession!;
  const facilityName = facilityLabel(
    session.activeFacility ?? dto.facility.key,
  );
  const navigation = getNavigationModules(
    "employee",
    session.permissionsSnapshot,
  );
  const bookingSnapshotCard: HomeCardDto = {
    moduleId: "booking-snapshot",
    title: "報名 / 課程",
    status: "not_connected",
    routePath: "/employee/documents",
    order: 55,
    payload: null,
    sourceStatus: {
      source: "/api/bff/employee/home",
      connected: false,
      errorMessage: "報名 / 課程模組已註冊，但 booking provider 尚未接線。",
    },
  };
  const todayTasks = sectionToCard(
    "handover",
    "今日交接",
    10,
    "/employee/handover",
    dto.handover,
    "今日沒有交接事項。",
    "櫃台交接資料暫時無法取得。",
  );
  const handover = sectionToCard(
    "handover",
    "交辦事項",
    20,
    "/employee/handover",
    dto.handover,
    "尚未設定交辦事項。",
    "交辦事項資料暫時無法取得。",
  );
  const handoverItems = (dto.handover.data ?? [])
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      preview: item.content ?? item.reportNote ?? "",
      dueDate: item.dueLabel ?? item.targetDate ?? "",
      status:
        item.status === "expired"
          ? "expired"
          : item.status === "completed" || item.status === "confirmed"
            ? "completed"
            : "pending",
    }))
    .slice(0, 5);
  handover.payload = {
    title: "交辦事項",
    items: handoverItems,
    totalPending: handoverItems.length,
    primaryAction: {
      label: "新增交辦事項",
      action: "open_drawer",
    },
    viewAllRoute: "/employee/handover",
  };
  const announcements = sectionToCard(
    "announcements",
    "群組重要公告",
    30,
    "/employee/announcements",
    dto.announcements,
    "目前沒有公告。",
    "公告模組已註冊，但資料來源尚未接線。",
  );
  const quickActions = sectionToCard(
    "quick-links",
    "快速操作",
    40,
    undefined,
    dto.shortcuts,
    "目前沒有快速操作。",
    "快速操作已註冊，但資料來源尚未接線。",
  );
  quickActions.payload =
    dto.shortcuts.data?.slice(0, 7) ?? defaultEmployeeShortcuts;
  const shiftReminder = sectionToCard(
    "shift-reminder",
    "今日班表",
    50,
    "/employee/shift",
    dto.shifts,
    "目前沒有班表資料。",
    "班表模組已註冊，但外部排班來源尚未接線。",
  );
  shiftReminder.payload = buildShiftBoardFromSummaries(
    dto.facility.key,
    session.userId,
    filterShiftSummariesForFacility(dto.shifts.data, dto.facility.key),
    {
      connected: dto.shifts.status !== "unavailable",
      lastSyncedAt: dto.shifts.meta.lastSyncAt,
      errorMessage:
        dto.shifts.status === "unavailable"
          ? (dto.shifts.meta.fallbackReason ?? "班表資料暫時無法取得。")
          : undefined,
    },
  );
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
      id: session.userId,
      displayName: session.displayName,
      role: "employee",
      facilityName,
    },
    date: dto.facility.businessDate,
    quickSearch: {
      placeholder: "搜尋模組、公告、交接、班表或 Q&A",
      enabledModules: [
        "handover",
        "announcements",
        "shift-reminder",
        "knowledge-base-qna",
      ],
    },
    todayTasks,
    handoverSummary: handover,
    importantAnnouncements: announcements,
    quickActions,
    todayShift: shiftReminder,
    weatherCard: sectionToCard(
      "weather-widget",
      "天氣卡片",
      60,
      undefined,
      dto.weather,
      "目前沒有天氣資料。",
      "天氣卡片已註冊，但資料來源尚未接線。",
    ),
    navigation,
    unreadCounts: {
      announcements: (dto.announcements.data ?? []).filter(
        (item) => item.priority === "required" && !item.isAcknowledged,
      ).length,
      handovers: (dto.handover.data ?? []).filter(
        (item) => item.status !== "confirmed" && item.status !== "completed",
      ).length,
    },
  };
};
