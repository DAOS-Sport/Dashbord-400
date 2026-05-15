import {
  facilityLabel,
  facilityLineGroups,
  findFacilityLineGroup,
} from "@shared/domain/facilities";
import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { listRagicH05FacilityCandidates } from "../../integrations/ragic/facility-adapter";
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
  mapTaskSummary,
  openOperationalHandovers,
  openTasks,
  withTimeout,
} from "./employee-home-service";

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
      const ragicFacilities = await withTimeout(
        listRagicH05FacilityCandidates().catch(() => undefined),
        1200,
        undefined,
      );
      const ragicOtFacilityKeys = new Set(
        (ragicFacilities?.data ?? []).map((facility) => facility.facilityKey),
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
        const [allHandovers, allTasks, staffing] = await Promise.all([
          withTimeout(
            storage.listOperationalHandovers({ limit: 300 }).catch(() => []),
            1500,
            [],
          ),
          withTimeout(
            storage
              .listTasks({ includeCancelled: false, limit: 300 })
              .catch(() => []),
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
        ]);
        const scopedHandovers = allHandovers.filter((handover) =>
          facilityKeys.includes(handover.facilityKey),
        );
        const scopedTasks = allTasks.filter((task) =>
          facilityKeys.includes(task.facilityKey),
        );
        const selectedHandovers = scopedHandovers
          .filter((handover) => handover.facilityKey === facilityKey)
          .slice(0, 100);
        const selectedTasks = scopedTasks
          .filter((task) => task.facilityKey === facilityKey)
          .slice(0, 100);
        const facilityWork = facilityKeys.map((key) => {
          const facilityHandovers = scopedHandovers.filter(
            (handover) => handover.facilityKey === key,
          );
          const facilityTasks = scopedTasks.filter(
            (task) => task.facilityKey === key,
          );
          const staffingRow = staffing.byFacility?.find(
            (row) => row.facilityKey === key,
          );
          const currentLead = staffing.currentOnDuty?.find(
            (member) => member.facilityKey === key,
          );
          return {
            facilityKey: key,
            facilityName: facilityLabel(key),
            area: findFacilityLineGroup(key)?.area ?? "未分類",
            active: staffingRow?.active ?? 0,
            onShift: staffingRow?.onShift ?? 0,
            next: staffingRow?.next ?? 0,
            openHandovers: openOperationalHandovers(facilityHandovers).length,
            incompleteTasks: openTasks(facilityTasks).length,
            currentLead,
          };
        });
        return res.json({
          ...dashboard,
          facilities: ok(facilityWork),
          staffing: ok(staffing),
          incompleteTasks: ok(openTasks(selectedTasks).map(mapTaskSummary)),
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
};
