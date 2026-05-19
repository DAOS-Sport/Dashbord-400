import {
  facilityLabel,
  facilityLineGroups,
  findFacilityLineGroup,
} from "@shared/domain/facilities";
import { getCourtName, getSchoolName, isValidSchool, type SchoolId } from "@shared/court-config";
import type { OperationalHandover } from "@shared/schema";
import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { ok } from "../../shared/bff/section";
import { env } from "../../shared/config/env";
import { storage } from "../../storage";
import { requireRole } from "../auth/context";
import { courtsStorage } from "../courts/storage";
import {
  getSupervisorDashboardFromSources,
  getSupervisorDashboardMock,
} from "./employee-home";
import {
  buildStaffingSummary,
  openOperationalHandovers,
  withTimeout,
} from "./employee-home-service";

const todayTaipei = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
const startOfTaipeiDay = () => new Date(`${todayTaipei()}T00:00:00+08:00`);

const toIso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : typeof value === "string" ? value : undefined;

const roleBucket = (member: { title?: string; department?: string; shiftLabel?: string }) => {
  const label = [member.title, member.department, member.shiftLabel].filter(Boolean).join(" ");
  if (label.includes("救生")) return "lifeguard";
  if (label.includes("櫃台")) return "counter";
  return "other";
};

const imageAttachment = (id: string, label: string, url?: string | null, source = "lifeguard") =>
  url ? [{ id, kind: "image" as const, label, url, source }] : [];

const mapPhotoRecord = (
  item: {
    id: number;
    description?: string | null;
    photoUrl?: string | null;
    createdAt?: Date | null;
    clientCaptureTime?: Date | null;
    createdBy?: string | null;
  },
  label: string,
  status = "已回報",
) => ({
  id: String(item.id),
  title: `${label} #${item.id}`,
  status,
  meta: toIso(item.clientCaptureTime) ?? toIso(item.createdAt),
  description: item.description ?? null,
  attachments: imageAttachment(`${label}-${item.id}`, "現場照片", item.photoUrl, label),
});

const courtSchoolsForFacility = (facilityKey: string): SchoolId[] => {
  const key = facilityKey.toLowerCase();
  const name = facilityLabel(facilityKey);
  if (key.includes("salu") || key.includes("sanchong") || key.includes("sanlu") || /三重商工|三蘆|商工/.test(name)) return ["sanchong"];
  if (key.includes("xinbei") || /新北高中|新北高中游泳池|新北/.test(name)) return ["xinbei"];
  return [];
};

const statusForCount = (count: number) => count > 0 ? "ready" as const : "empty" as const;
const promoPattern = /優惠|折扣|促銷|快訊|方案|折價|活動價|早鳥|特價/;

const linkAttachment = (id: string, label: string, url?: string | null, source = "front-desk") =>
  url ? [{ id, kind: "link" as const, label, url, source }] : [];

const isImageLike = (value?: string | null) =>
  Boolean(value && /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value));

const mapOperationalHandoverForBff = (handover: OperationalHandover) => ({
  ...handover,
  visibleFrom: handover.visibleFrom?.toISOString?.() ?? handover.visibleFrom,
  dueAt: handover.dueAt?.toISOString?.() ?? handover.dueAt,
  completedAt: handover.completedAt?.toISOString?.() ?? handover.completedAt,
  createdAt: handover.createdAt?.toISOString?.() ?? handover.createdAt,
  updatedAt: handover.updatedAt?.toISOString?.() ?? handover.updatedAt,
  facilityName: facilityLabel(handover.facilityKey),
});

export const registerSupervisorBffRoutes = (
  app: Express,
  container: AppContainer,
) => {
  app.get(
    "/api/bff/supervisor/dashboard",
    requireRole("supervisor", "system"),
    async (req, res) => {
      const session = req.workbenchSession!;
      const dashboard =
        env.dataSourceMode === "mock"
          ? getSupervisorDashboardMock()
          : await withTimeout(
              getSupervisorDashboardFromSources(),
              2500,
              getSupervisorDashboardMock(),
            );
      const grantedFacilityKeys = session.grantedFacilities.length
        ? session.grantedFacilities
        : facilityLineGroups.map((facility) => facility.facilityKey);
      const facilitiesSlot = container.services.ragicCache.getFacilities();
      const ragicOtFacilityKeys = new Set(
        (facilitiesSlot.data ?? []).map((facility) => facility.facilityKey),
      );
      const filteredFacilityKeys = ragicOtFacilityKeys.size
        ? grantedFacilityKeys.filter((facilityKey) =>
            ragicOtFacilityKeys.has(facilityKey),
          )
        : grantedFacilityKeys;
      const facilityKeys = filteredFacilityKeys.length
        ? filteredFacilityKeys
        : grantedFacilityKeys;
      const requestedActiveFacility =
        session.activeFacility || dashboard.facility.key || "xinbei_pool";
      const facilityKey = facilityKeys.includes(requestedActiveFacility)
        ? requestedActiveFacility
        : (facilityKeys[0] ?? "xinbei_pool");
      try {
        const [allHandovers, staffing, waterQualityToday] = await Promise.all([
          withTimeout(
            storage.listOperationalHandovers({ limit: 300 }).catch(() => []),
            1500,
            [],
          ),
          withTimeout(buildStaffingSummary(container, facilityKeys), 2500, {
            active: 0,
            total: 0,
            onShift: 0,
            absent: 0,
            activeEmployees: [],
            currentOnDuty: [],
            nextOnDuty: [],
            byFacility: facilityKeys.map((key) => ({
              facilityKey: key,
              facilityName: facilityLabel(key),
              active: 0,
              onShift: 0,
              next: 0,
            })),
          }),
          withTimeout(
            storage.listLifeguardWaterQualityLogs({ facilityKeys, fromDate: startOfTaipeiDay(), limit: 500 }).catch(() => []),
            1500,
            [],
          ),
        ]);
        const scopedHandovers = allHandovers.filter((handover) =>
          facilityKeys.includes(handover.facilityKey),
        );
        const selectedHandovers = scopedHandovers
          .filter((handover) => handover.facilityKey === facilityKey)
          .slice(0, 100);
        const facilityWork = facilityKeys.map((key) => {
          const facilityHandovers = scopedHandovers.filter(
            (handover) => handover.facilityKey === key,
          );
          const staffingRow = staffing.byFacility?.find(
            (row) => row.facilityKey === key,
          );
          const currentLead = staffing.currentOnDuty?.find(
            (member) => member.facilityKey === key,
          );
          const currentMembers = (staffing.currentOnDuty ?? []).filter((member) => member.facilityKey === key);
          const waterQualityRows = waterQualityToday.filter((row) => row.facilityKey === key);
          return {
            facilityKey: key,
            facilityName: facilityLabel(key),
            area: findFacilityLineGroup(key)?.area ?? "未分類",
            active: staffingRow?.active ?? 0,
            onShift: staffingRow?.onShift ?? 0,
            next: staffingRow?.next ?? 0,
            openHandovers: openOperationalHandovers(facilityHandovers).length,
            incompleteTasks: openOperationalHandovers(facilityHandovers).length,
            currentCounterCount: currentMembers.filter((member) => roleBucket(member) === "counter").length,
            currentLifeguardCount: currentMembers.filter((member) => roleBucket(member) === "lifeguard").length,
            lifeguardWaterQualityCount: waterQualityRows.length,
            lifeguardAttachmentCount: waterQualityRows.filter((row) => Boolean(row.photoUrl)).length,
            currentLead,
          };
        });
        const incompleteHandovers = openOperationalHandovers(selectedHandovers).map((handover) => ({
          id: String(handover.id),
          title: handover.title,
          content: handover.content,
          status: handover.status === "done" ? "done" as const : "pending" as const,
          priority: (handover.priority ?? "normal") as "low" | "normal" | "high",
          dueAt: handover.dueAt?.toISOString() ?? null,
          dueLabel: handover.dueAt ? handover.dueAt.toLocaleString("zh-TW") : undefined,
          createdByName: handover.createdByName,
          assignedToName: handover.assigneeName,
          source: "supervisor" as const,
          reportNote: handover.reportNote,
        }));
        return res.json({
          ...dashboard,
          facilities: ok(facilityWork),
          staffing: ok(staffing),
          incompleteTasks: ok(incompleteHandovers),
          handoverOverview: ok({
            open: openOperationalHandovers(selectedHandovers).length,
            confirmed: selectedHandovers.filter(
              (handover) => handover.status === "done",
            ).length,
          }),
          shifts: ok(
            [...staffing.currentOnDuty, ...staffing.nextOnDuty]
              .slice(0, 12)
              .map((member, index) => ({
                id: `${member.employeeNumber || member.name}-${index}`,
                label: `${member.name} / ${member.facilityName ?? ""}`.trim(),
                timeRange: member.timeRange ?? "依排班系統",
                status: member.status === "active" ? "active" : "upcoming",
                employeeName: member.name,
                venueName: member.facilityName,
              })),
          ),
        });
      } catch {
        return res.json(dashboard);
      }
    },
  );

  app.get(
    "/api/bff/supervisor/handovers",
    requireRole("supervisor", "system"),
    async (req, res) => {
      const session = req.workbenchSession!;
      const isSystem = session.grantedRoles.includes("system");
      const grantedFacilityKeys = session.grantedFacilities.length
        ? session.grantedFacilities
        : facilityLineGroups.map((facility) => facility.facilityKey);
      const facilityParam = typeof req.query.facilityKey === "string" ? req.query.facilityKey : "all";
      const facilityKeys = facilityParam && facilityParam !== "all"
        ? [facilityParam]
        : grantedFacilityKeys;
      if (!isSystem && facilityKeys.some((key) => !grantedFacilityKeys.includes(key))) {
        return res.status(403).json({ message: "無權限查看此館別" });
      }
      const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : undefined;
      const keyword = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const rows = await storage.listOperationalHandovers({ status, limit: 500 }).catch(() => []);
      const scoped = rows
        .filter((handover) => facilityKeys.includes(handover.facilityKey))
        .filter((handover) => {
          if (!keyword) return true;
          return `${handover.title} ${handover.content} ${handover.createdByName ?? ""} ${handover.assigneeName ?? ""} ${facilityLabel(handover.facilityKey)}`.toLowerCase().includes(keyword);
        });
      return res.json({
        items: scoped.map(mapOperationalHandoverForBff),
        facilities: grantedFacilityKeys.map((facilityKey) => ({
          facilityKey,
          facilityName: facilityLabel(facilityKey),
        })),
        summaryByFacility: grantedFacilityKeys.map((facilityKey) => {
          const items = scoped.filter((handover) => handover.facilityKey === facilityKey);
          return {
            facilityKey,
            facilityName: facilityLabel(facilityKey),
            open: openOperationalHandovers(items).length,
            total: items.length,
          };
        }),
      });
    },
  );

  app.get(
    "/api/bff/supervisor/facilities/:facilityKey/detail",
    requireRole("supervisor", "system"),
    async (req, res) => {
      const session = req.workbenchSession!;
      const facilityKeyParam = req.params.facilityKey;
      const facilityKey = Array.isArray(facilityKeyParam) ? facilityKeyParam[0] : facilityKeyParam;
      if (!facilityKey) {
        return res.status(400).json({ message: "缺少場館代碼" });
      }
      const isSystem = session.grantedRoles.includes("system");
      const grantedFacilityKeys = session.grantedFacilities.length
        ? session.grantedFacilities
        : facilityLineGroups.map((facility) => facility.facilityKey);
      if (!isSystem && !grantedFacilityKeys.includes(facilityKey)) {
        return res.status(403).json({ message: "無權限查看此場館" });
      }

      const fromDate = startOfTaipeiDay();
      const workDate = todayTaipei();
      const courtSchools = courtSchoolsForFacility(facilityKey);
      const [staffing, handovers, waterQuality, coachDive, cleanup, laneIssues, lostItems, employeeResources, systemAnnouncements, groupBroadcastRows, laneRentals, courtReservations] = await Promise.all([
        withTimeout(buildStaffingSummary(container, [facilityKey]), 2500, {
          active: 0,
          total: 0,
          onShift: 0,
          absent: 0,
          activeEmployees: [],
          currentOnDuty: [],
          nextOnDuty: [],
          byFacility: [{ facilityKey, facilityName: facilityLabel(facilityKey), active: 0, onShift: 0, next: 0 }],
        }),
        storage.listOperationalHandovers({ facilityKey, limit: 100 }).catch(() => []),
        storage.listLifeguardWaterQualityLogs({ facilityKey, fromDate, limit: 100 }).catch(() => []),
        storage.listLifeguardCoachDiveLogs({ facilityKey, fromDate, limit: 100 }).catch(() => []),
        storage.listLifeguardCleanupLogs({ facilityKey, fromDate, limit: 100 }).catch(() => []),
        storage.listLifeguardHandoverNotes({ facilityKey, workDate, limit: 100 }).catch(() => []),
        storage.listLifeguardLostAndFound({ facilityKey, fromDate, limit: 100 }).catch(() => []),
        storage.listEmployeeResources({ facilityKey, limit: 120 }).catch(() => []),
        storage.listSystemAnnouncements(facilityKey).catch(() => []),
        storage.listGroupBroadcasts({ facilityKey, limit: 60 }).catch(() => []),
        storage.listLaneRentals({ facilityKey, bookingDate: workDate, status: "active" }).catch(() => []),
        Promise.all(courtSchools.map((school) => courtsStorage.getReservationsByDate(school, workDate).catch(() => []))).then((groups) => groups.flat()).catch(() => []),
      ]);

      const staffingRow = staffing.byFacility?.find((row) => row.facilityKey === facilityKey);
      const current = (staffing.currentOnDuty ?? []).filter((member) => member.facilityKey === facilityKey);
      const next = (staffing.nextOnDuty ?? []).filter((member) => member.facilityKey === facilityKey);
      const openHandovers = openOperationalHandovers(handovers);
      const facility = {
        facilityKey,
        facilityName: facilityLabel(facilityKey),
        area: findFacilityLineGroup(facilityKey)?.area ?? "未分類",
        active: staffingRow?.active ?? staffing.active ?? 0,
        onShift: staffingRow?.onShift ?? current.length,
        next: staffingRow?.next ?? next.length,
        openHandovers: openHandovers.length,
        incompleteTasks: openHandovers.length,
        currentCounterCount: current.filter((member) => roleBucket(member) === "counter").length,
        currentLifeguardCount: current.filter((member) => roleBucket(member) === "lifeguard").length,
        lifeguardWaterQualityCount: waterQuality.length,
        lifeguardAttachmentCount: waterQuality.filter((row) => Boolean(row.photoUrl)).length
          + coachDive.filter((row) => Boolean(row.photoUrl)).length
          + cleanup.filter((row) => Boolean(row.photoUrl)).length
          + lostItems.filter((row) => Boolean(row.photoUrl)).length,
        currentLead: current[0] ? { name: current[0].name, title: current[0].title } : undefined,
      };
      const handoverItems = openHandovers.slice(0, 20).map((handover) => ({
        id: String(handover.id),
        title: handover.title,
        status: handover.status,
        meta: [handover.targetDate, handover.targetShiftLabel, handover.assigneeName].filter(Boolean).join(" · "),
        description: handover.content,
        attachments: handover.linkedActionUrl
          ? [{ id: `handover-${handover.id}-link`, kind: handover.linkedActionType === "image" ? "image" as const : "link" as const, label: handover.linkedActionType ?? "詳細連結", url: handover.linkedActionUrl, source: "handover" }]
          : [],
      }));
      const laneRentalItems = laneRentals.slice(0, 12).map((rental) => ({
        id: `lane-rental-${rental.id}`,
        title: rental.zoneLabel || `水道 ${rental.laneCode}`,
        status: rental.status,
        meta: `${rental.bookingDate} ${rental.startTime}-${rental.endTime}`,
        description: `${rental.renterName}${rental.note ? ` · ${rental.note}` : ""}`,
        attachments: [],
      }));
      const courtItems = courtReservations.slice(0, 12).map((reservation) => {
        const schoolName = isValidSchool(reservation.school) ? getSchoolName(reservation.school) : reservation.school;
        return {
          id: `court-${reservation.id}`,
          title: reservation.customerName || reservation.serviceName || "場租預約",
          status: reservation.status ?? "confirmed",
          meta: `${schoolName} · ${getCourtName(reservation.court)} · ${reservation.startTime}-${reservation.endTime}`,
          description: [reservation.serviceName, reservation.notes, reservation.bookingNumber].filter(Boolean).join(" · ") || null,
          attachments: [],
        };
      });
      const announcementEventItems = [
        ...systemAnnouncements
          .filter((item) => item.announcementType === "event" || item.announcementType === "notice" || item.isPinned)
          .slice(0, 8)
          .map((item) => ({
            id: `system-announcement-${item.id}`,
            title: item.title,
            status: item.announcementType,
            meta: item.publishedAt?.toLocaleString("zh-TW"),
            description: item.content,
            attachments: [],
          })),
        ...groupBroadcastRows
          .filter((item) => item.isEvent || item.priority !== "normal")
          .slice(0, 8)
          .map((item) => ({
            id: `group-broadcast-${item.id}`,
            title: item.title || "群組公告",
            status: item.priority,
            meta: item.createdAt?.toLocaleString("zh-TW"),
            description: item.summary || item.originalText,
            attachments: [],
          })),
        ...employeeResources
          .filter((item) => item.category === "event" || item.category === "announcement")
          .slice(0, 8)
          .map((item) => ({
            id: `employee-resource-${item.id}`,
            title: item.title,
            status: item.eventCategory || item.subCategory || item.category,
            meta: item.eventStartAt?.toLocaleString("zh-TW") ?? item.scheduledAt?.toLocaleString("zh-TW") ?? item.createdAt?.toLocaleString("zh-TW"),
            description: item.content,
            attachments: [
              ...(isImageLike(item.imageUrl) ? imageAttachment(`resource-${item.id}-image`, "圖片", item.imageUrl, "employee-resource") : []),
              ...linkAttachment(`resource-${item.id}-link`, "連結", item.url, "employee-resource"),
            ],
          })),
      ].slice(0, 20);
      const promotionItems = [
        ...systemAnnouncements
          .filter((item) => item.announcementType === "discount" || promoPattern.test(`${item.title} ${item.content}`))
          .map((item) => ({
            id: `system-promo-${item.id}`,
            title: item.title,
            status: item.severity,
            meta: item.publishedAt?.toLocaleString("zh-TW"),
            description: item.content,
            attachments: [],
          })),
        ...employeeResources
          .filter((item) => promoPattern.test(`${item.title} ${item.content ?? ""} ${item.eventCategory ?? ""} ${item.subCategory ?? ""}`))
          .map((item) => ({
            id: `employee-promo-${item.id}`,
            title: item.title,
            status: item.eventCategory || item.subCategory || "優惠快訊",
            meta: item.eventStartAt?.toLocaleString("zh-TW") ?? item.createdAt?.toLocaleString("zh-TW"),
            description: item.content,
            attachments: [
              ...(isImageLike(item.imageUrl) ? imageAttachment(`promo-${item.id}-image`, "圖片", item.imageUrl, "employee-resource") : []),
              ...linkAttachment(`promo-${item.id}-link`, "連結", item.url, "employee-resource"),
            ],
          })),
        ...groupBroadcastRows
          .filter((item) => promoPattern.test(`${item.title ?? ""} ${item.summary ?? ""} ${item.originalText}`))
          .map((item) => ({
            id: `group-promo-${item.id}`,
            title: item.title || "優惠快訊",
            status: item.priority,
            meta: item.createdAt?.toLocaleString("zh-TW"),
            description: item.summary || item.originalText,
            attachments: [],
          })),
      ].slice(0, 20);
      const frontDeskModules = [
        {
          id: "handover" as const,
          label: "交接事項",
          status: statusForCount(handoverItems.length),
          count: handoverItems.length,
          items: handoverItems,
          sourceStatus: { connected: true },
        },
        {
          id: "venue-rental" as const,
          label: "場租",
          status: statusForCount(laneRentalItems.length + courtItems.length),
          count: laneRentalItems.length + courtItems.length,
          items: [...laneRentalItems, ...courtItems].slice(0, 20),
          sourceStatus: { connected: true },
        },
        {
          id: "announcements-events" as const,
          label: "重要公告/活動檔期",
          status: statusForCount(announcementEventItems.length),
          count: announcementEventItems.length,
          items: announcementEventItems,
          sourceStatus: { connected: true },
        },
        {
          id: "promotions" as const,
          label: "優惠快訊",
          status: statusForCount(promotionItems.length),
          count: promotionItems.length,
          items: promotionItems,
          sourceStatus: { connected: true },
        },
      ];

      res.json({
        facility,
        staffing: { current, next },
        frontDesk: {
          openHandovers: openHandovers.length,
          items: handoverItems,
          modules: frontDeskModules,
        },
        lifeguard: {
          waterQualityStatus: waterQuality.length ? `今日已檢測 ${waterQuality.length} 筆` : "今日尚未檢測",
          modules: [
            {
              id: "water-quality",
              label: "水質檢測",
              status: waterQuality.length ? "ready" : "empty",
              count: waterQuality.length,
              items: waterQuality.slice(0, 20).map((item) => mapPhotoRecord(item, "水質檢測")),
            },
            {
              id: "coach-dive",
              label: "教練下水",
              status: coachDive.length ? "ready" : "empty",
              count: coachDive.length,
              items: coachDive.slice(0, 20).map((item) => mapPhotoRecord(item, "教練下水")),
            },
            {
              id: "cleanup",
              label: "下班打掃",
              status: cleanup.length ? "ready" : "empty",
              count: cleanup.length,
              items: cleanup.slice(0, 20).map((item) => mapPhotoRecord(item, "下班打掃")),
            },
            {
              id: "lane-issues",
              label: "水道事項",
              status: laneIssues.length ? "ready" : "empty",
              count: laneIssues.length,
              items: laneIssues.slice(0, 20).map((item) => ({
                id: String(item.id),
                title: item.category ?? "水道事項",
                status: item.needsAttention ? "需注意" : item.isImportant ? "重要" : "一般",
                meta: item.workDate,
                description: item.content,
                attachments: (item.photoUrls ?? []).map((url, index) => ({
                  id: `lane-issue-${item.id}-${index}`,
                  kind: "image" as const,
                  label: `附件 ${index + 1}`,
                  url,
                  source: "水道事項",
                })),
              })),
            },
            {
              id: "lost-and-found",
              label: "失物招領",
              status: lostItems.length ? "ready" : "empty",
              count: lostItems.length,
              items: lostItems.slice(0, 20).map((item) => ({
                ...mapPhotoRecord(item, "失物招領", item.claimStatus),
                title: item.itemDescription,
                description: item.description ?? item.foundLocationNote,
              })),
            },
          ],
        },
      });
    },
  );
};
