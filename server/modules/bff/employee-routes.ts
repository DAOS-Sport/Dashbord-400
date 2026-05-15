import { facilityLabel } from "@shared/domain/facilities";
import {
  getHomeLayoutCards,
  getModuleDescriptorsByRole,
  getNavigationModules,
} from "@shared/modules";
import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { env } from "../../shared/config/env";
import { storage } from "../../storage";
import { requireRole, requireSession } from "../auth/context";
import {
  announcementSortTime,
  attachAnnouncementAcknowledgements,
  attachEmployeeHomeContract,
  auditEmployeeAnnouncementPreview,
  buildEmployeeHomeFallback,
  buildEmployeeSearchItems,
  buildShiftBoardFromSummaries,
  enrichEmployeeHome,
  filterShiftSummariesForFacility,
  mapScheduleShifts,
  resolveSessionFacilityKey,
  uniqueAnnouncements,
  type SearchItem,
} from "./employee-home-service";

export const registerEmployeeBffRoutes = (
  app: Express,
  container: AppContainer,
) => {
  app.get(
    "/api/bff/lifeguard/home",
    requireRole("lifeguard", "system"),
    async (req, res) => {
      const session = req.workbenchSession!;
      const facilityKey = session.activeFacility;
      const cards = getHomeLayoutCards(
        "lifeguard",
        session.permissionsSnapshot,
      ).map((card) => ({
        ...card,
        payload:
          card.moduleId === "shift-reminder"
            ? buildShiftBoardFromSummaries(facilityKey, session.userId, [], {
                connected: false,
                errorMessage: "班表資料暫時無法取得。",
              })
            : card.payload,
      }));
      return res.json({
        facility: { key: facilityKey, name: facilityLabel(facilityKey) },
        currentUser: {
          id: session.userId,
          displayName: session.displayName,
          role: "lifeguard",
        },
        cards,
        navigation: getNavigationModules(
          "lifeguard",
          session.permissionsSnapshot,
        ),
      });
    },
  );

  app.get("/api/bff/employee/home", requireSession, async (req, res) => {
    const requestedFacilityKey =
      typeof req.query.facilityKey === "string"
        ? req.query.facilityKey
        : undefined;
    const session = req.workbenchSession!;
    const facility = resolveSessionFacilityKey(session, requestedFacilityKey);
    if (!facility.ok)
      return res.status(facility.status).json({ message: facility.message });
    const facilityKey = facility.facilityKey;
    const result =
      await container.integrations.replitData.getEmployeeHomeProjection(
        facilityKey,
      );

    if (!result.data) {
      const fallbackHome = await buildEmployeeHomeFallback(
        facilityKey,
        container,
        result.meta.fallbackReason || "Employee home projection is unavailable",
      );
      const home = await attachAnnouncementAcknowledgements(
        fallbackHome,
        facilityKey,
        session.userId,
      );
      await auditEmployeeAnnouncementPreview(
        container,
        req,
        facilityKey,
        home,
        "EMPLOYEE_HOME_ANNOUNCEMENTS_PREVIEWED",
      );
      return res.json(attachEmployeeHomeContract(home, req));
    }

    const home = await enrichEmployeeHome(result.data, facilityKey, container);
    const acknowledgedHome = await attachAnnouncementAcknowledgements(
      home,
      facilityKey,
      session.userId,
    );
    await auditEmployeeAnnouncementPreview(
      container,
      req,
      facilityKey,
      acknowledgedHome,
      "EMPLOYEE_HOME_ANNOUNCEMENTS_PREVIEWED",
    );
    return res.json(attachEmployeeHomeContract(acknowledgedHome, req));
  });

  app.get(
    "/api/bff/employee/shifts/today",
    requireSession,
    async (req, res) => {
      const requestedFacilityKey =
        typeof req.query.facilityKey === "string"
          ? req.query.facilityKey
          : undefined;
      const session = req.workbenchSession!;
      const facility = resolveSessionFacilityKey(session, requestedFacilityKey);
      if (!facility.ok)
        return res.status(facility.status).json({ message: facility.message });
      const facilityKey = facility.facilityKey;
      if (env.dataSourceMode === "mock") {
        return res.json(
          buildShiftBoardFromSummaries(facilityKey, session.userId, [], {
            connected: false,
            errorMessage: "班表資料暫時無法取得。",
          }),
        );
      }
      const result =
        await container.integrations.schedule.listTodayShifts(facilityKey);
      const shifts = filterShiftSummariesForFacility(
        mapScheduleShifts(result.data ?? []),
        facilityKey,
      );
      return res.json(
        buildShiftBoardFromSummaries(facilityKey, session.userId, shifts, {
          connected: Boolean(result.data),
          lastSyncedAt: new Date().toISOString(),
          errorMessage: result.data
            ? undefined
            : result.meta.fallbackReason || "班表資料暫時無法取得。",
        }),
      );
    },
  );

  app.get(
    "/api/bff/employee/announcements",
    requireSession,
    async (req, res) => {
      const requestedFacilityKey =
        typeof req.query.facilityKey === "string"
          ? req.query.facilityKey
          : undefined;
      const session = req.workbenchSession!;
      const facility = resolveSessionFacilityKey(session, requestedFacilityKey);
      if (!facility.ok)
        return res.status(facility.status).json({ message: facility.message });
      const facilityKey = facility.facilityKey;
      const result =
        await container.integrations.replitData.getEmployeeHomeProjection(
          facilityKey,
        );
      const home = result.data
        ? await enrichEmployeeHome(result.data, facilityKey, container)
        : await buildEmployeeHomeFallback(
            facilityKey,
            container,
            result.meta.fallbackReason ||
              "Employee home projection is unavailable",
          );
      const acknowledgedHome = await attachAnnouncementAcknowledgements(
        home,
        facilityKey,
        session.userId,
      );
      await auditEmployeeAnnouncementPreview(
        container,
        req,
        facilityKey,
        acknowledgedHome,
        "EMPLOYEE_ANNOUNCEMENTS_LIST_VIEWED",
      );
      const items = uniqueAnnouncements(
        acknowledgedHome.announcements.data ?? [],
      )
        .sort(
          (a, b) =>
            Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
            announcementSortTime(b) - announcementSortTime(a),
        )
        .slice(0, 100);
      return res.json({
        facility: { key: facilityKey, name: facilityLabel(facilityKey) },
        items,
        sourceStatus: {
          connected: acknowledgedHome.announcements.status !== "unavailable",
          lastSyncedAt: acknowledgedHome.announcements.meta.lastSyncAt,
          errorMessage: acknowledgedHome.announcements.meta.fallbackReason,
        },
      });
    },
  );

  app.get(
    "/api/bff/employee/announcements/:id",
    requireSession,
    async (req, res) => {
      const requestedFacilityKey =
        typeof req.query.facilityKey === "string"
          ? req.query.facilityKey
          : undefined;
      const session = req.workbenchSession!;
      const facility = resolveSessionFacilityKey(session, requestedFacilityKey);
      if (!facility.ok)
        return res.status(facility.status).json({ message: facility.message });
      const facilityKey = facility.facilityKey;
      const result =
        await container.integrations.replitData.getEmployeeHomeProjection(
          facilityKey,
        );
      const home = result.data
        ? await enrichEmployeeHome(result.data, facilityKey, container)
        : await buildEmployeeHomeFallback(
            facilityKey,
            container,
            result.meta.fallbackReason ||
              "Employee home projection is unavailable",
          );
      const acknowledgedHome = await attachAnnouncementAcknowledgements(
        home,
        facilityKey,
        session.userId,
      );
      const item = uniqueAnnouncements(
        acknowledgedHome.announcements.data ?? [],
      ).find((announcement) => announcement.id === req.params.id);
      if (!item)
        return res.status(404).json({ message: "Announcement not found" });
      return res.json({ item });
    },
  );

  app.get("/api/bff/employee/search", requireSession, async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2) return res.json({ query, items: [] });
    const requestedFacilityKey =
      typeof req.query.facilityKey === "string"
        ? req.query.facilityKey
        : undefined;
    const session = req.workbenchSession!;
    const facility = resolveSessionFacilityKey(session, requestedFacilityKey);
    if (!facility.ok)
      return res.status(facility.status).json({ message: facility.message });
    const facilityKey = facility.facilityKey;
    const result =
      await container.integrations.replitData.getEmployeeHomeProjection(
        facilityKey,
      );
    const home = result.data
      ? await enrichEmployeeHome(result.data, facilityKey, container)
      : await buildEmployeeHomeFallback(
          facilityKey,
          container,
          result.meta.fallbackReason ||
            "Employee home projection is unavailable",
        );

    const qnaItems = await storage
      .listKnowledgeBaseQna({ facilityKey, query, limit: 8 })
      .then((items) =>
        items.map(
          (item): SearchItem => ({
            id: `qna-${item.id}`,
            type: "qna",
            title: item.question,
            summary: [item.answer, item.category, ...(item.tags ?? [])]
              .filter(Boolean)
              .join(" · "),
            href: `/employee/qna?q=${encodeURIComponent(query)}`,
          }),
        ),
      )
      .catch(() => []);
    const items = [...qnaItems, ...buildEmployeeSearchItems(home, query)].slice(
      0,
      12,
    );
    await storage
      .recordPortalEvent({
        employeeNumber: session.userId,
        employeeName: session.displayName,
        facilityKey,
        eventType: "search",
        target: "employee-home",
        targetLabel: query,
        metadata: JSON.stringify({ resultCount: items.length }),
      })
      .catch(() => undefined);

    return res.json({ query, items });
  });

  app.get("/api/search/global", requireSession, async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const role = req.workbenchSession!.activeRole;
    const normalizedQuery = query.toLowerCase();
    const moduleMatches = getModuleDescriptorsByRole(role)
      .filter((module) => {
        if (!normalizedQuery) return false;
        return `${module.name} ${module.description} ${module.searchKeywords.join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery);
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
        errorMessage: moduleMatches.length
          ? undefined
          : "全文搜尋尚未接線；目前只搜尋已註冊模組。",
      },
    });
  });
};
