import {
  facilityLabel,
  facilityLineGroups,
  findFacilityLineGroup,
} from "@shared/domain/facilities";
import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { ok } from "../../shared/bff/section";
import { env } from "../../shared/config/env";
import { storage } from "../../storage";
import { requireRole } from "../auth/context";
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
      const [staffing, handovers, waterQuality, coachDive, cleanup, laneIssues, lostItems] = await Promise.all([
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
        storage.listLifeguardHandoverNotes({ facilityKey, workDate: todayTaipei(), limit: 100 }).catch(() => []),
        storage.listLifeguardLostAndFound({ facilityKey, fromDate, limit: 100 }).catch(() => []),
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

      res.json({
        facility,
        staffing: { current, next },
        frontDesk: {
          openHandovers: openHandovers.length,
          items: openHandovers.slice(0, 20).map((handover) => ({
            id: String(handover.id),
            title: handover.title,
            status: handover.status,
            meta: [handover.targetDate, handover.targetShiftLabel, handover.assigneeName].filter(Boolean).join(" · "),
            description: handover.content,
            attachments: handover.linkedActionUrl
              ? [{ id: `handover-${handover.id}-link`, kind: "link", label: handover.linkedActionType ?? "詳細連結", url: handover.linkedActionUrl, source: "handover" }]
              : [],
          })),
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
