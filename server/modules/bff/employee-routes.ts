import { facilityLabel } from "@shared/domain/facilities";
import type { ShortcutSummary } from "@shared/domain/workbench";
import {
  getHomeLayoutCards,
  getModuleDescriptorsByRole,
  getNavigationModules,
} from "@shared/modules";
import type { Express } from "express";
import { z } from "zod";
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
  defaultEmployeeShortcuts,
  enrichEmployeeHome,
  filterShiftSummariesForFacility,
  mapScheduleShifts,
  resolveSessionFacilityKey,
  uniqueAnnouncements,
  type SearchItem,
} from "./employee-home-service";

const employeeWorkbenchPreferenceKey = "employee.workbench";
const shortcutToneSchema = z.enum(["blue", "green", "amber", "violet", "rose", "cyan"]);
const shortcutSourceTypeSchema = z.enum(["module", "document", "custom"]);
const shortcutSummarySchema = z.object({
  id: z.string().min(1).max(160),
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048),
  tone: shortcutToneSchema,
  helper: z.string().max(120).optional(),
  sourceType: shortcutSourceTypeSchema.optional(),
  resourceId: z.number().int().positive().optional(),
  facilityScoped: z.boolean().optional(),
});

const employeeWorkbenchPreferenceSchema = z.object({
  quickActions: z.array(shortcutSummarySchema).max(7).optional(),
  preferredFacilityKey: z.string().min(1).nullable().optional(),
});

const normalizeShortcut = (item: ShortcutSummary): ShortcutSummary => ({
  id: item.id,
  label: item.label,
  href: item.href,
  tone: item.tone,
  helper: item.helper,
  sourceType: item.sourceType ?? "module",
  resourceId: item.resourceId,
  facilityScoped: Boolean(item.facilityScoped),
});

const buildEmployeeQuickActionCandidates = async (facilityKey: string): Promise<ShortcutSummary[]> => {
  const documentRows = await storage
    .listEmployeeResources({ facilityKey, category: "document", limit: 100 })
    .catch(() => []);
  const documentShortcuts: ShortcutSummary[] = documentRows
    .filter((item) => Boolean(item.url?.trim()))
    .map((item) => ({
      id: `document-${item.id}`,
      label: item.title,
      helper: item.subCategory || "常用文件",
      href: item.url || "/employee/documents",
      tone: "cyan",
      sourceType: "document",
      resourceId: item.id,
      facilityScoped: true,
    }));
  return [
    ...defaultEmployeeShortcuts.map((item) => normalizeShortcut({ ...item, sourceType: "module", facilityScoped: false })),
    ...documentShortcuts,
  ];
};

const mergeStoredQuickActions = (candidates: ShortcutSummary[], stored: ShortcutSummary[] | undefined): ShortcutSummary[] => {
  const byId = new Map(candidates.map((item) => [item.id, item]));
  const merged: ShortcutSummary[] = [];
  for (const item of stored ?? []) {
    const candidate = byId.get(item.id);
    if (!candidate && item.sourceType !== "custom") continue;
    merged.push(normalizeShortcut({
      ...(candidate ?? item),
      tone: item.tone ?? candidate?.tone ?? "blue",
      href: item.href || candidate?.href || "/employee",
    }));
  }
  for (const candidate of candidates) {
    if (merged.length >= 7) break;
    if (!merged.some((item) => item.id === candidate.id)) merged.push(normalizeShortcut(candidate));
  }
  return merged.slice(0, 7);
};

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

    const home = await enrichEmployeeHome(result.data, facilityKey, container, session.activeRole);
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

  app.get("/api/bff/employee/quick-action-candidates", requireSession, async (req, res) => {
    const session = req.workbenchSession!;
    const requestedFacilityKey =
      typeof req.query.facilityKey === "string"
        ? req.query.facilityKey
        : undefined;
    const facility = resolveSessionFacilityKey(session, requestedFacilityKey);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const candidates = await buildEmployeeQuickActionCandidates(facility.facilityKey);
    return res.json({ items: candidates });
  });

  app.get("/api/bff/employee/workbench-preferences", requireSession, async (req, res) => {
    const session = req.workbenchSession!;
    const facility = resolveSessionFacilityKey(session);
    if (!facility.ok) return res.status(facility.status).json({ message: facility.message });
    const candidates = await buildEmployeeQuickActionCandidates(facility.facilityKey);
    const preference = await storage
      .getUserWorkbenchPreference({
        userId: session.userId,
        role: "employee",
        preferenceKey: employeeWorkbenchPreferenceKey,
      })
      .catch(() => undefined);
    const parsed = employeeWorkbenchPreferenceSchema.safeParse(preference?.payload ?? {});
    const payload = parsed.success ? parsed.data : {};
    return res.json({
      quickActions: mergeStoredQuickActions(candidates, payload.quickActions),
      preferredFacilityKey: payload.preferredFacilityKey ?? session.activeFacility ?? null,
      candidates,
      sourceStatus: {
        connected: Boolean(preference || env.databaseUrl),
        hasPersistedPreference: Boolean(preference),
        errorMessage: parsed.success ? undefined : "偏好設定格式不正確，已使用預設入口。",
      },
    });
  });

  app.put("/api/bff/employee/workbench-preferences", requireSession, async (req, res) => {
    const session = req.workbenchSession!;
    const parsed = employeeWorkbenchPreferenceSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ message: "偏好設定格式錯誤", errors: parsed.error.flatten() });
    if (parsed.data.preferredFacilityKey && !session.grantedFacilities.includes(parsed.data.preferredFacilityKey)) {
      return res.status(403).json({ message: "無此館別權限" });
    }
    const candidates = await buildEmployeeQuickActionCandidates(session.activeFacility);
    const payload = {
      quickActions: mergeStoredQuickActions(candidates, parsed.data.quickActions),
      preferredFacilityKey: parsed.data.preferredFacilityKey ?? session.activeFacility,
    };
    const saved = await storage.upsertUserWorkbenchPreference({
      userId: session.userId,
      role: "employee",
      preferenceKey: employeeWorkbenchPreferenceKey,
      payload,
      updatedBy: session.displayName,
    });
    await storage.recordPortalEvent({
      employeeNumber: session.userId,
      employeeName: session.displayName,
      facilityKey: session.activeFacility,
      eventType: "layout_update",
      target: employeeWorkbenchPreferenceKey,
      targetLabel: "employee workbench preferences",
      metadata: JSON.stringify({ quickActionCount: payload.quickActions.length }),
    }).catch(() => undefined);
    return res.json({
      quickActions: payload.quickActions,
      preferredFacilityKey: payload.preferredFacilityKey,
      candidates,
      sourceStatus: {
        connected: true,
        hasPersistedPreference: Boolean(saved),
      },
    });
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
        ? await enrichEmployeeHome(result.data, facilityKey, container, session.activeRole)
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
        ? await enrichEmployeeHome(result.data, facilityKey, container, session.activeRole)
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
      ? await enrichEmployeeHome(result.data, facilityKey, container, session.activeRole)
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
