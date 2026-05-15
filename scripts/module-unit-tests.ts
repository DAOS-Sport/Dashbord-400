import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkbenchRole } from "../shared/auth/me";
import {
  canMutateEmployeeResource,
  filterEmployeeResourcesForCaller,
} from "../shared/employee-resources/privacy";
import {
  isCanonicalFacilityKey,
  toCanonicalFacilityKey,
} from "../shared/facility/canonical-keys";
import {
  calculateCompletionRate,
  classifyInsightAnomaly,
  getHomeLayoutCards,
  getModuleDescriptorsByRole,
  getModuleHealth,
  getNavigationModules,
} from "../shared/modules";
import {
  getPrimaryRoute,
  getRedirectForLegacyPath,
  getWorkbenchRoutes,
} from "../shared/navigation/workbench-routes";

const repoRoot = process.cwd();
const bffRuntimeFiles = [
  "server/modules/bff/routes.ts",
  "server/modules/bff/employee-routes.ts",
  "server/modules/bff/supervisor-routes.ts",
  "server/modules/bff/system-routes.ts",
  "server/modules/bff/employee-home-service.ts",
  "server/modules/bff/services/session-facility.ts",
  "server/modules/bff/services/home-contract.ts",
  "server/modules/bff/services/home-contract-defaults.ts",
  "server/modules/bff/services/home-card-contract.ts",
  "server/modules/bff/services/shift-board-contract.ts",
  "server/modules/bff/services/employee-home-contract.ts",
  "server/modules/bff/services/resource-mappers.ts",
  "server/modules/bff/services/announcement-service.ts",
  "server/modules/bff/services/announcement-summary-service.ts",
  "server/modules/bff/services/announcement-overlay-service.ts",
  "server/modules/bff/services/announcement-section-service.ts",
  "server/modules/bff/services/announcement-fetch-service.ts",
  "server/modules/bff/services/employee-home-builder.ts",
  "server/modules/bff/services/employee-home-fallback-service.ts",
  "server/modules/bff/services/employee-home-fallback-mappers.ts",
  "server/modules/bff/services/employee-shift-service.ts",
  "server/modules/bff/services/employee-resource-section-service.ts",
  "server/modules/bff/services/employee-home-enrichment-service.ts",
  "server/modules/bff/services/employee-announcement-audit-service.ts",
  "server/modules/bff/services/employee-search-service.ts",
  "server/modules/bff/services/supervisor-dashboard-service.ts",
];

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const read = (path: string) => {
  if (path === "server/modules/bff/routes.ts") {
    return bffRuntimeFiles
      .map((file) => readFileSync(join(repoRoot, file), "utf8"))
      .join("\n");
  }
  return readFileSync(join(repoRoot, path), "utf8");
};

const sourceIncludes = (path: string, needle: string, message: string) => {
  assert(read(path).includes(needle), `${path}: ${message}`);
};

const sourceMatches = (path: string, pattern: RegExp, message: string) => {
  assert(pattern.test(read(path)), `${path}: ${message}`);
};

const rolePermissions = {
  employee: [
    "employee:home:read",
    "employee:resources:read",
    "employee:qna:read",
    "employee:checkin:read",
    "employee:booking:read",
    "workbench:search",
  ],
  lifeguard: [
    "employee:home:read",
    "employee:resources:read",
    "employee:qna:read",
    "lifeguard:home:read",
    "lifeguard:log:read",
    "lifeguard:log:write",
    "workbench:search",
  ],
  supervisor: ["supervisor:dashboard:read", "workbench:search"],
  system: [
    "system:overview:read",
    "system:module-registry:read",
    "system:audit:read",
    "system:integrations:read",
    "workbench:search",
  ],
};

const roles: WorkbenchRole[] = [
  "employee",
  "lifeguard",
  "supervisor",
  "system",
];

const acceptedBackgroundPending = new Set([
  "auth",
  "bff-projections",
  "booking-snapshot",
  "campaigns-events",
  "checkins",
  "employee-resources",
  "file-upload-export",
  "facilities",
  "gmail-integration",
  "integration-sync-jobs",
  "legacy-users",
  "linebot-integration",
  "notification-center",
  "notification-recipients",
  "operations",
  "portal-home",
  "portal-manage",
  "portal-review",
  "quick-links",
  "ragic-integration",
  "schedule-integration",
  "system-announcements",
  "tasks",
  "session-governance",
  "user-role-snapshots",
  "widget-layout-settings",
]);

const runEmployeeModuleTests = () => {
  const navigation = getNavigationModules("employee", rolePermissions.employee);
  const cards = getHomeLayoutCards("employee", rolePermissions.employee);
  assert(
    navigation.map((item) => item.id).join(",") ===
      "employee-home,tasks,announcements,handover,activity-periods,employee-resources,employee-training,personal-note,lifeguard-lost-and-found,courts,knowledge-base-qna",
    `employee navigation mismatch: ${navigation.map((item) => item.id).join(",")}`,
  );
  assert(
    cards.map((item) => item.moduleId).join(",") ===
      "employee-home,tasks,announcements,handover,activity-periods,employee-resources,employee-training,personal-note,lifeguard-lost-and-found,courts,knowledge-base-qna,shift-reminder,booking-snapshot,notification-center,weather-widget,registration-courses,search",
    `employee home cards mismatch: ${cards.map((item) => item.moduleId).join(",")}`,
  );
  navigation.forEach((item) =>
    assert(
      cards.some((card) => card.moduleId === item.id),
      `employee nav module missing home card: ${item.id}`,
    ),
  );
  [
    "booking-snapshot",
    "notification-center",
    "weather-widget",
    "registration-courses",
    "search",
  ].forEach((id) =>
    assert(
      cards.some((card) => card.moduleId === id),
      `employee homepage-only module missing card: ${id}`,
    ),
  );
  sourceIncludes(
    "server/modules/bff/routes.ts",
    "weatherCard",
    "employee home must expose a weather not_connected card",
  );
  sourceIncludes(
    "server/modules/bff/routes.ts",
    "bookingSnapshotCard",
    "employee home must expose a booking/course not_connected card",
  );
  sourceMatches(
    "server/modules/bff/routes.ts",
    /storage\s*[\r\n\s]*\.\s*listKnowledgeBaseQna/,
    "employee search must include Q&A rows",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "FloatingQuickActionsPanel",
    "employee home must render the fixed floating quick actions panel from GitHub layout",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "employeeHomeQuickActions",
    "employee home quick actions must use employee-safe destinations",
  );
  assert(
    !read("client/src/modules/employee/home/employee-home-page.tsx").includes(
      "QuickEntryStrip",
    ),
    "employee home must not render the quick entry strip",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "resolveEmployeeHomeSlots",
    "employee home must resolve canonical dashboard slots",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    'homeSlots.isEnabled("announcements")',
    "employee announcements must not depend on legacy notice area placement",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    'homeSlots.isEnabled("tutoringToday")',
    "employee home must render the tutoring preview from a canonical slot",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "TodayTutoringCard",
    "employee home must keep the GitHub tutoring card layout",
  );
  sourceIncludes(
    "shared/domain/layout.ts",
    "tutoringToday",
    "employee default widget layout must include today tutoring",
  );
  const employeeHomeSource = read(
    "client/src/modules/employee/home/employee-home-page.tsx",
  );
  assert(
    !employeeHomeSource.includes('homeSlots.isEnabled("tasks")'),
    "employee home must not render the today tasks card",
  );
  sourceMatches(
    "client/src/modules/employee/home/employee-home-page.tsx",
    /homeSlots\.isEnabled\("handover"\)[\s\S]*homeSlots\.isEnabled\("tutoringToday"\)[\s\S]*homeSlots\.isEnabled\("announcements"\)[\s\S]*homeSlots\.isEnabled\("shifts"\)[\s\S]*homeSlots\.isEnabled\("events"\)[\s\S]*homeSlots\.isEnabled\("documents"\)[\s\S]*homeSlots\.isEnabled\("courts"\)[\s\S]*homeSlots\.isEnabled\("stickyNotes"\)/,
    "employee home slots must render in the GitHub fixed dashboard order",
  );
  sourceMatches(
    "client/src/modules/employee/home/employee-home-page.tsx",
    /homeSlots\.isEnabled\("courts"\) && courtSchools\.length[\s\S]*lg:col-span-8[\s\S]*<CourtsScrollCard schools=\{courtSchools\} onOpenDrawer=\{\(\) => setCourtsDrawerOpen\(true\)\} \/>/,
    "employee courts scroll strip must render only for court-enabled facilities and span two desktop grid blocks",
  );
  sourceIncludes(
    "client/src/modules/employee/courts-visibility.ts",
    "getEmployeeCourtSchoolsForFacility",
    "employee courts visibility helper must exist",
  );
  sourceIncludes(
    "client/src/modules/employee/courts-visibility.ts",
    'return ["xinbei"]',
    "employee courts visibility must map Xinbei facilities to Xinbei school",
  );
  sourceIncludes(
    "client/src/modules/employee/courts-visibility.ts",
    'return ["sanchong"]',
    "employee courts visibility must map Sanchong/Sanlu facilities to Sanchong school",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    'fetchEmployeeCourtsToday("xinbei"',
    "employee courts preview must load Xinbei rent summary",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    'fetchEmployeeCourtsToday("sanchong"',
    "employee courts preview must load Sanchong rent summary",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "/employee/courts/${school}",
    "employee courts preview must link school-specific rent pages",
  );
  sourceIncludes(
    "client/src/pages/courts/_components/app-header.tsx",
    "{schoolName}場租查看",
    "courts page header must show school-specific rent view title",
  );
  sourceIncludes(
    "client/src/pages/courts/_components/app-header.tsx",
    "單日場租",
    "courts page must expose a daily rent view tab",
  );
  sourceIncludes(
    "client/src/pages/courts/_components/app-header.tsx",
    "搜尋場租",
    "courts page must expose a rent search tab",
  );
  assert(
    !employeeHomeSource.includes("家教預約資料尚未接入"),
    "employee home must not show tutoring not-connected placeholder",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "家教預約模組規劃中",
    "employee home must show tutoring as a future module preview",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "即將加入",
    "employee tutoring preview must clearly state it is a future module",
  );
  assert(
    !employeeHomeSource.includes("/employee/tutoring"),
    "employee home must not link to nonexistent tutoring route",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    "CourtsScrollCard",
    "employee home must render the fixed courts scroll strip",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/employee/courts/:school"',
    "employee courts route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "EmployeeCourtsFrame",
    "employee courts pages must be wrapped in employee shell",
  );
  assert(
    getPrimaryRoute("courts", "employee") === "/employee/courts/xinbei",
    "courts employee primary route must be employee workbench route",
  );
  assert(
    !read("client/src/modules/employee/home/employee-home-page.tsx").includes(
      "xl:pr-[280px]",
    ),
    "employee desktop content must keep the original page width",
  );
  assert(
    !read("client/src/modules/employee/home/employee-home-page.tsx").includes(
      "xl:pr-[104px]",
    ),
    "employee desktop content must not reserve quick-action rail space",
  );
  assert(
    !read("client/src/modules/employee/home/employee-home-page.tsx").includes(
      "apiRequest(",
    ),
    "employee home tutoring placeholder must not call mutation APIs",
  );
  sourceIncludes(
    "client/src/modules/employee/settings/page.tsx",
    "draggable",
    "employee settings must support shortcut drag sorting",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/employee/settings"',
    "employee settings route must be registered",
  );
  sourceMatches(
    "client/src/modules/employee/training/page.tsx",
    /trackEvent\("TRAINING_VIEW"/,
    "training page must report TRAINING_VIEW",
  );
};

const runSupervisorModuleTests = () => {
  const navigation = getNavigationModules(
    "supervisor",
    rolePermissions.supervisor,
  );
  const cards = getHomeLayoutCards("supervisor", rolePermissions.supervisor);
  const expected = [
    "supervisor-dashboard",
    "facilities",
    "parking",
    "counter-log",
    "lane-rentals",
    "courts",
    "tasks",
    "announcements",
    "announcement-groups",
    "supervisor-lifeguard-overview",
    "handover",
    "employee-training",
    "anomalies",
    "analytics",
  ];
  assert(
    navigation.map((item) => item.id).join(",") === expected.join(","),
    `supervisor navigation mismatch: ${navigation.map((item) => item.id).join(",")}`,
  );
  expected.forEach((id) =>
    assert(
      cards.some((item) => item.moduleId === id),
      `supervisor home card missing ${id}`,
    ),
  );
  navigation.forEach((item) => {
    assert(
      !item.routePath.startsWith("/admin/"),
      `supervisor navigation must not use legacy admin path: ${item.id} -> ${item.routePath}`,
    );
    assert(
      !item.routePath.startsWith("/courts/"),
      `supervisor navigation must not use naked courts path: ${item.id} -> ${item.routePath}`,
    );
    assert(
      item.routePath !== "/analytics",
      "supervisor navigation must not use legacy analytics path",
    );
    assert(
      item.routePath !== "/operations",
      "supervisor navigation must not use legacy operations path",
    );
  });
  assert(
    getWorkbenchRoutes("supervisor")
      .map((item) => item.moduleId)
      .join(",") === expected.join(","),
    "supervisor manifest order must match navigation order",
  );
  assert(
    getRedirectForLegacyPath("/admin/parking/dashboard") ===
      "/supervisor/parking",
    "legacy parking dashboard must redirect to supervisor workbench",
  );
  assert(
    getRedirectForLegacyPath("/admin/announcement-groups") ===
      "/supervisor/announcement-groups",
    "legacy announcement groups path must redirect to supervisor workbench",
  );
  assert(
    getRedirectForLegacyPath("/courts/xinbei") === "/supervisor/courts/xinbei",
    "legacy courts path must redirect to supervisor workbench",
  );
  assert(
    getPrimaryRoute("parking", "supervisor") === "/supervisor/parking",
    "parking primary route must be supervisor workbench route",
  );
  assert(
    getPrimaryRoute("counter-log", "supervisor") ===
      "/supervisor/counter-log/submissions",
    "counter-log primary route must be supervisor workbench route",
  );
  assert(
    getPrimaryRoute("lane-rentals", "supervisor") ===
      "/supervisor/lane-rentals",
    "lane-rentals primary route must be supervisor workbench route",
  );
  assert(
    getPrimaryRoute("courts", "supervisor") === "/supervisor/courts/xinbei",
    "courts primary route must be supervisor workbench route",
  );
  ["parking", "counter-log", "lane-rentals", "courts"].forEach((id) =>
    sourceIncludes(
      "client/src/modules/supervisor/dashboard-page.tsx",
      `moduleId: "${id}"`,
      `supervisor home drawer missing ${id} preview config`,
    ),
  );
  sourceIncludes(
    "client/src/modules/supervisor/home-module-drawers.tsx",
    "export function SupervisorHomeDrawer",
    "supervisor home drawer component must exist",
  );
  sourceIncludes(
    "client/src/modules/supervisor/home-module-drawers.tsx",
    "export function SupervisorModulePreviewCard",
    "supervisor module preview card component must exist",
  );
  sourceIncludes(
    "client/src/modules/supervisor/home-module-drawers.tsx",
    "查看詳細畫面",
    "supervisor module preview card must route to detail pages instead of opening drawer",
  );
  assert(
    !read("client/src/modules/supervisor/dashboard-page.tsx").includes(
      "setModuleDrawer",
    ),
    "supervisor dashboard module previews must not open a small drawer",
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "SupervisorQuickActionRail",
    "supervisor desktop quick actions must be lifted into a floating panel",
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "navigate(getFacilityDetailHref(facility.facilityKey))",
    "supervisor facility CTA must deterministically navigate to facility detail pages",
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "isInteractiveRailTarget",
    "supervisor facility rail drag must ignore interactive targets",
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "canLoadSupervisorDashboard",
    "supervisor dashboard query must wait for supervisor/system active role",
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "enabled: Boolean(canLoadSupervisorDashboard)",
    "supervisor dashboard BFF query must be disabled until role is ready",
  );
  sourceMatches(
    "client/src/modules/supervisor/dashboard-page.tsx",
    /queryKey: \["supervisor-home", "parking"\][\s\S]*?retry: false,/,
    "supervisor home preview queries must fail fast instead of retrying slow 500s",
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "主管資料無法載入",
    "supervisor dashboard must render an explicit BFF error state",
  );
  assert(
    !read("client/src/modules/supervisor/dashboard-page.tsx").includes(
      "xl:pr-[280px]",
    ),
    "supervisor desktop content must keep the original page width",
  );
  [
    "/supervisor/parking",
    "/supervisor/parking/payments",
    "/supervisor/counter-log/submissions",
    "/supervisor/lane-rentals",
    "/supervisor/courts/xinbei",
    "/supervisor/courts/xinbei/search",
  ].forEach((path) =>
    sourceIncludes(
      "client/src/modules/supervisor/dashboard-page.tsx",
      path,
      `supervisor drawer CTA missing canonical path ${path}`,
    ),
  );
  const drawerSource = read(
    "client/src/modules/supervisor/home-module-drawers.tsx",
  );
  [
    "/admin/",
    'href="/courts/',
    'href: "/courts/',
    "apiRequest(",
    '"POST"',
    '"PATCH"',
    '"DELETE"',
    "/approve",
    "/return",
    "reviewMutation",
    "createContract",
    "deleteLaneRental",
  ].forEach((needle) =>
    assert(
      !drawerSource.includes(needle),
      `supervisor home drawer must stay preview-only and canonical, found ${needle}`,
    ),
  );
  sourceIncludes(
    "client/src/modules/supervisor/dashboard-page.tsx",
    "OnDutyDrawer",
    "dashboard must keep on-duty drawer",
  );
  sourceIncludes(
    "client/src/modules/supervisor/tasks/page.tsx",
    "supervisor-drawer",
    "tasks must use right drawer create flow",
  );
  sourceIncludes(
    "client/src/modules/supervisor/announcements/page.tsx",
    "手動發布公告",
    "announcements must support manual publish",
  );
  sourceIncludes(
    "client/src/modules/supervisor/announcement-groups/page.tsx",
    "button-add-announcement-group",
    "announcement groups page must expose add binding action",
  );
};

const runLifeguardModuleTests = () => {
  const navigation = getNavigationModules(
    "lifeguard",
    rolePermissions.lifeguard,
  );
  const cards = getHomeLayoutCards("lifeguard", rolePermissions.lifeguard);
  const expected = [
    "lifeguard-home",
    "lifeguard-water-quality",
    "lifeguard-coach-dive",
    "lifeguard-cleanup",
    "lifeguard-lane-issues",
    "lifeguard-lost-and-found",
    "lifeguard-lane-rentals",
    "lifeguard-log",
    "announcements",
    "employee-training",
    "knowledge-base-qna",
  ];
  assert(
    navigation.map((item) => item.id).join(",") === expected.join(","),
    `lifeguard navigation mismatch: ${navigation.map((item) => item.id).join(",")}`,
  );
  assert(
    cards.map((item) => item.moduleId).join(",") ===
      "lifeguard-home,lifeguard-water-quality,lifeguard-coach-dive,lifeguard-cleanup,lifeguard-lane-issues,lifeguard-lost-and-found,lifeguard-lane-rentals,lifeguard-log,announcements,employee-training,knowledge-base-qna,search",
    `lifeguard home cards mismatch: ${cards.map((item) => item.moduleId).join(",")}`,
  );
  expected.forEach((id) =>
    assert(
      cards.some((card) => card.moduleId === id),
      `lifeguard home card missing ${id}`,
    ),
  );
  expected
    .slice(1, 6)
    .forEach((id) =>
      assert(
        getPrimaryRoute(id, "lifeguard")?.startsWith("/lifeguard/"),
        `lifeguard operation primary route must be under /lifeguard: ${id}`,
      ),
    );
  sourceIncludes(
    "server/modules/auth/session-store.ts",
    '"lifeguard" as const',
    "lifeguard role must be added to grantedRoles",
  );
  sourceIncludes(
    "server/modules/auth/session-store.ts",
    'activeRole: isSupervisor ? "supervisor" : isLifeguard ? "lifeguard" : "employee"',
    "lifeguard-only users must default to lifeguard active role",
  );
  sourceIncludes(
    "server/integrations/ragic/real-auth-adapter.ts",
    "isLifeguardTitle",
    "Ragic auth adapter must infer lifeguard role from title",
  );
  sourceMatches(
    "server/modules/bff/routes.ts",
    /app\.get\(\s*"\/api\/bff\/lifeguard\/home",\s*requireRole\(\s*"lifeguard",\s*"system"\s*\)/,
    "lifeguard home BFF must require lifeguard or system role",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/lifeguard/log",
    "lifeguard log page must be routed",
  );
  [
    "/lifeguard/water-quality",
    "/lifeguard/coach-dive",
    "/lifeguard/cleanup",
    "/lifeguard/lane-issues",
    "/lifeguard/lost-and-found",
    "/lifeguard/lane-rentals",
  ].forEach((path) =>
    sourceIncludes(
      "client/src/App.tsx",
      path,
      `lifeguard operation detail route missing: ${path}`,
    ),
  );
  sourceIncludes(
    "client/src/modules/lifeguard/operation-detail-page.tsx",
    "LifeguardShell",
    "lifeguard operation detail pages must use LifeguardShell",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/log/page.tsx",
    "/api/work-logs/handover",
    "lifeguard log page must write via work-log endpoint",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/log/page.tsx",
    "currentShiftInTaipei",
    "lifeguard log must derive shift from Taipei time",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/log/page.tsx",
    "無可用場館",
    "lifeguard log must not fallback to a hardcoded facility",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/operation-modules.ts",
    "水質檢測",
    "lifeguard operation config must expose mobile-first work-log task categories",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/home/page.tsx",
    "LifeguardOperationDrawer",
    "lifeguard home must expose module preview drawers",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/home/page.tsx",
    "setSelectedModuleId(module.id)",
    "lifeguard home operation cards must open a drawer preview",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/operation-modules.ts",
    "LifeguardOperationModuleId",
    "lifeguard operation config must expose module id type",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/lifeguard-shell.tsx",
    "primaryNav",
    "lifeguard sidebar must use dedicated primary operation nav",
  );
  sourceIncludes(
    "client/src/modules/lifeguard/lifeguard-shell.tsx",
    "secondaryNav",
    "lifeguard sidebar must move shared links to a secondary section",
  );
  const lifeguardHomeSource = read(
    "client/src/modules/lifeguard/home/page.tsx",
  );
  const lifeguardOperationSource = read(
    "client/src/modules/lifeguard/operation-modules.ts",
  );
  [
    "/lifeguard/water-quality",
    "/lifeguard/coach-dive",
    "/lifeguard/cleanup",
    "/lifeguard/lane-issues",
    "/lifeguard/lost-and-found",
    "/lifeguard/lane-rentals",
  ].forEach((path) =>
    assert(
      lifeguardOperationSource.includes(path),
      `floating quick actions must link to operation detail page: ${path}`,
    ),
  );
  [
    "POST",
    "PATCH",
    "DELETE",
    "apiPost",
    "apiPatch",
    "apiDelete",
    "/submit",
  ].forEach((needle) =>
    assert(
      !lifeguardHomeSource.includes(needle),
      `lifeguard home drawer must stay preview-only, found ${needle}`,
    ),
  );
  sourceIncludes(
    "client/src/modules/lifeguard/home/page.tsx",
    "FloatingQuickActionsPanel",
    "lifeguard desktop quick actions must use a floating panel layout",
  );
  assert(
    !read("client/src/modules/lifeguard/home/page.tsx").includes(
      "xl:pr-[280px]",
    ),
    "lifeguard desktop content must keep the original page width",
  );
  sourceIncludes(
    "server/modules/work-logs/routes.ts",
    'action: "LIFEGUARD_LOG_CREATED"',
    "lifeguard log create must write audit row",
  );
  sourceIncludes(
    "server/modules/work-logs/routes.ts",
    'action: "LIFEGUARD_LOG_UPDATED"',
    "lifeguard log update must write audit row",
  );
};

const runCanonicalModuleRegistrationTests = () => {
  const supervisorIds = getModuleDescriptorsByRole("supervisor").map(
    (item) => item.id,
  );
  [
    "parking",
    "parking-vehicles",
    "parking-plans",
    "parking-contracts",
    "parking-payments",
    "parking-event-days",
    "lane-rentals",
    "courts",
    "lifeguard-log",
    "counter-log",
    "lifeguard-water-quality",
    "lifeguard-coach-dive",
    "lifeguard-cleanup",
    "lifeguard-lane-issues",
    "lifeguard-lost-and-found",
    "lifeguard-lane-rentals",
    "supervisor-lifeguard-overview",
  ].forEach((id) =>
    sourceIncludes(
      "shared/modules/ids.ts",
      `"${id}"`,
      `${id} must be declared as a canonical module id`,
    ),
  );
  ["parking", "counter-log", "lane-rentals", "courts"].forEach((id) =>
    assert(
      supervisorIds.includes(id),
      `supervisor descriptors missing canonical module: ${id}`,
    ),
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/supervisor/parking/event-days",
    "parking event-days supervisor route must be registered even if it redirects to the dashboard",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/supervisor/counter-log/submissions",
    "counter-log supervisor route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/supervisor/lane-rentals",
    "lane-rentals supervisor route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/supervisor/announcement-groups",
    "announcement groups supervisor route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/supervisor/courts/:school",
    "courts supervisor route must be registered",
  );
  sourceIncludes(
    "client/src/modules/supervisor/module-shell.tsx",
    "SupervisorModuleShell",
    "supervisor module shell must exist for legacy module UIUX",
  );
  sourceIncludes(
    "client/src/pages/admin/parking/_shared.tsx",
    "SupervisorModuleShell",
    "parking pages must render inside supervisor module shell",
  );
  sourceIncludes(
    "client/src/pages/admin/work-logs/_shared.tsx",
    "SupervisorModuleShell",
    "counter-log pages must render inside supervisor module shell",
  );
  sourceIncludes(
    "client/src/pages/admin/lane-rentals.tsx",
    "SupervisorModuleShell",
    "lane rentals page must render inside supervisor module shell",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "SupervisorCourtsFrame",
    "courts pages must be wrapped in supervisor module shell",
  );
  assert(
    !/href:\s*"\/admin\/parking/.test(
      read("client/src/pages/admin/parking/_shared.tsx"),
    ),
    "parking tabs must not use legacy admin hrefs",
  );
  assert(
    !/counter:\s*"\/admin\/counter-logs"/.test(
      read("client/src/pages/admin/work-logs/_shared.tsx"),
    ),
    "counter-log tabs must not use legacy admin prefix",
  );
  assert(
    !read("client/src/pages/courts/_components/app-header.tsx").includes(
      "`/courts/${school}",
    ),
    "courts header must not use naked courts links",
  );
  assert(
    !read("client/src/pages/courts/_components/app-header.tsx").includes(
      'href="/employee"',
    ),
    "courts header must not expose old return-to-employee entry",
  );
  assert(
    !read("client/src/App.tsx").includes("AppSidebar"),
    "App.tsx must not render the legacy AppSidebar shell",
  );
  assert(
    !read("client/src/App.tsx").includes("SidebarProvider"),
    "App.tsx must not render the legacy sidebar provider fallback",
  );
  sourceIncludes(
    "client/src/shared/auth/facility-gate.tsx",
    "無可用場館",
    "employee/lifeguard gate must show a no-facility state",
  );
  sourceIncludes(
    "client/src/shared/auth/session.ts",
    '"/api/bff/lifeguard/home"',
    "facility switching must invalidate lifeguard home BFF",
  );
};

const runSystemModuleTests = () => {
  const navigation = getNavigationModules("system", rolePermissions.system);
  const expected = [
    "system-control-center",
    "system-watchdog",
    "system-operations",
    "system-insights",
    "system-governance",
    "helper-status",
    "line-whitelist",
  ];
  assert(
    navigation.map((item) => item.id).join(",") === expected.join(","),
    `system navigation mismatch: ${navigation.map((item) => item.id).join(",")}`,
  );
  const cards = getHomeLayoutCards("system", rolePermissions.system);
  assert(
    cards.map((item) => item.moduleId).join(",") === expected.join(","),
    `system home card mismatch: ${cards.map((item) => item.moduleId).join(",")}`,
  );
  assert(
    getWorkbenchRoutes("system")
      .map((item) => item.moduleId)
      .join(",") === expected.join(","),
    "system route manifest must expose the current IT architecture entries",
  );
  assert(
    cards.some(
      (card) =>
        card.moduleId === "system-control-center" &&
        card.routePath === "/system",
    ),
    "system control center card must route to /system",
  );
  assert(
    cards.some(
      (card) =>
        card.moduleId === "system-watchdog" &&
        card.routePath === "/system/watchdog",
    ),
    "system watchdog card must route to /system/watchdog",
  );
  assert(
    cards.some(
      (card) =>
        card.moduleId === "system-governance" &&
        card.routePath === "/system/governance",
    ),
    "system governance card must route to /system/governance",
  );
  assert(
    cards.some(
      (card) =>
        card.moduleId === "helper-status" &&
        card.routePath === "/system/lineXBS-status",
    ),
    "helper status card must route to /system/lineXBS-status",
  );
  assert(
    cards.some(
      (card) =>
        card.moduleId === "line-whitelist" &&
        card.routePath === "/system/line-whitelist",
    ),
    "line whitelist card must route to /system/line-whitelist",
  );
  const health = getModuleHealth("system", rolePermissions.system);
  expected.forEach((id) =>
    assert(
      health.some((item) => item.moduleId === id),
      `system health must include ${id}`,
    ),
  );
  assert(
    health.some((item) => item.moduleId === "system-function-relations"),
    "system health must include function relations",
  );
  assert(
    health.some((item) => item.moduleId === "watchdog-events"),
    "system health must include watchdog events",
  );
  const removedRawInspectorId = ["raw", "inspector"].join("-");
  const removedLifeguardAuditId = ["system", "lifeguard", "audit"].join("-");
  const removedTopologyId = ["system", "topology"].join("-");
  assert(
    !health.some((item) =>
      [
        removedRawInspectorId,
        removedLifeguardAuditId,
        removedTopologyId,
      ].includes(item.moduleId),
    ),
    "removed system observer routes must not remain in health",
  );
  sourceIncludes(
    "shared/modules/types.ts",
    '"telemetry_pending"',
    "ModuleHealthDto must expose telemetry_pending",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/control-center",\s*requireSession,\s*requireRole\("system"\)/,
    "system control-center endpoint must require system role",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/watchdog"',
    "system watchdog route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/operations"',
    "system operations route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/insights"',
    "system insights route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/governance"',
    "system governance route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/helper-status"',
    "helper status route must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/lineXBS-status"',
    "lineXBS status route alias must be registered",
  );
  sourceIncludes(
    "client/src/App.tsx",
    'path="/system/line-whitelist"',
    "line whitelist route must be registered",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "WATCHDOG",
    "system control center must render the watchdog entry tile",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "OPERATIONS",
    "system control center must render the operations entry tile",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "INSIGHTS",
    "system control center must render the insights entry tile",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "GOVERNANCE",
    "system control center must render the governance entry tile",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "HELPER STATUS",
    "system control center must render the helper status drawer tile",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "hasControlCenterData",
    "system control center must gate normal summaries behind real BFF data",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "已停止顯示 0 值摘要",
    "system control center must not show zero-value summaries after BFF failure",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "控制中心資料無法載入，請先確認權限與 BFF 狀態。",
    "system control center must show a trustworthy BFF error message",
  );
  sourceIncludes(
    "client/src/modules/system/control-center/page.tsx",
    "給系統管理員的一句話",
    "system control center must use IT/system-facing language",
  );
  assert(
    !read("client/src/modules/system/control-center/page.tsx").includes(
      "給主管的一句話",
    ),
    "system control center must not use supervisor-facing copy",
  );
  sourceIncludes(
    "client/src/modules/workbench/role-shell.tsx",
    "todayLabel",
    "workbench shell must render a dynamic date label",
  );
  assert(
    !read("client/src/modules/workbench/role-shell.tsx").includes("2026/04/23"),
    "workbench shell must not render a hardcoded date",
  );
  assert(
    !read("server/modules/bff/employee-home.ts").includes("2026年4月23日"),
    "employee BFF mock must not return a stale hardcoded business date",
  );
  assert(
    !read("server/modules/bff/employee-home.ts").includes("2026/04/23"),
    "supervisor BFF mock must not return a stale hardcoded business date",
  );
  sourceIncludes(
    "server/modules/bff/employee-home.ts",
    "businessDateLabel",
    "BFF mock dates must use a dynamic Taipei business date label",
  );
  sourceIncludes(
    "client/src/modules/workbench/role-shell.tsx",
    "System Console",
    "system shell must expose system-specific console copy",
  );
  sourceIncludes(
    "client/src/modules/workbench/role-shell.tsx",
    "IT 治理與監控工作台",
    "system shell must expose IT-specific scope copy",
  );
  sourceIncludes(
    "client/src/modules/system/watchdog/page.tsx",
    "Health",
    "watchdog page must include Health tab",
  );
  sourceIncludes(
    "client/src/modules/system/watchdog/page.tsx",
    "Alerts",
    "watchdog page must include Alerts tab",
  );
  sourceIncludes(
    "client/src/modules/system/watchdog/page.tsx",
    "Integrations",
    "watchdog page must include Integrations tab",
  );
  sourceIncludes(
    "client/src/modules/system/governance/page.tsx",
    "Module Registry",
    "governance page must include Module Registry tab",
  );
  sourceIncludes(
    "client/src/modules/system/governance/page.tsx",
    "Function Relations",
    "governance page must include Function Relations tab",
  );
  sourceIncludes(
    "client/src/modules/system/governance/page.tsx",
    "Audit Raw",
    "governance page must include Audit Raw tab",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/operations\/user-search",\s*requireSession,\s*requireRole\("system"\)/,
    "operations user search endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/operations\/user\/:userId",\s*requireSession,\s*requireRole\("system"\)/,
    "operations user detail endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.post\("\/api\/bff\/system\/operations\/user\/:userId\/reset-session",\s*requireSession,\s*requireRole\("system"\)/,
    "reset-session endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.post\("\/api\/bff\/system\/operations\/user\/:userId\/refresh-cache",\s*requireSession,\s*requireRole\("system"\)/,
    "refresh-cache endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.post\("\/api\/bff\/system\/operations\/user\/:userId\/resend-notification",\s*requireSession,\s*requireRole\("system"\)/,
    "resend-notification endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/operations\/recent-assists",\s*requireSession,\s*requireRole\("system"\)/,
    "recent assists endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/insights\/overview",\s*requireSession,\s*requireRole\("system"\)/,
    "insights overview endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/insights\/module\/:moduleId",\s*requireSession,\s*requireRole\("system"\)/,
    "insights module endpoint must require system role",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "reason: z.string().trim().min(3)",
    "operations interventions must require reason >= 3 chars",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "SYSTEM_USER_INTERVENTION_FORBIDDEN",
    "operations interventions must reject system-role targets",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "OPS_RESET_SESSION",
    "reset-session must write audit action",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "OPS_REFRESH_CACHE",
    "refresh-cache must write audit action",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "OPS_RESEND_NOTIFICATION",
    "resend-notification must write audit action",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "buildInsightsOverview(container, 7)",
    "control-center must calculate real insights severity",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "pendingAssistsLast24h > 5",
    "control-center must calculate real operations severity",
  );
  sourceIncludes(
    "client/src/modules/system/operations/page.tsx",
    "OpsActionDialog",
    "operations page must expose the intervention dialog",
  );
  sourceIncludes(
    "client/src/modules/system/operations/page.tsx",
    "不可對系統管理員介入",
    "operations page must disable intervention for system users",
  );
  sourceIncludes(
    "client/src/modules/system/insights/page.tsx",
    "ModuleDetailSheet",
    "insights page must expose module drill-down drawer",
  );
  sourceIncludes(
    "client/src/modules/system/insights/page.tsx",
    "function Sparkline",
    "insights page must use local SVG sparkline instead of adding chart dependencies",
  );
  assert(
    classifyInsightAnomaly(10, 1) === "spike",
    "insight anomaly detection must classify >300% increase as spike",
  );
  assert(
    classifyInsightAnomaly(6, 10) === "drop",
    "insight anomaly detection must classify >30% decrease as drop",
  );
  assert(
    classifyInsightAnomaly(8, 10) === null,
    "insight anomaly detection must ignore normal changes",
  );
  assert(
    calculateCompletionRate(10, 7) === 70,
    "completion rate must calculate completion/start percentage",
  );
  assert(
    calculateCompletionRate(0, 7) === undefined,
    "completion rate must be undefined when there are no starts",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "w-[80px]",
    "floating quick actions must use the fixed compact rail width",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "defaultActionSlot",
    "floating quick actions must keep the same top control format across roles",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "onPointerDown={beginDrag}",
    "floating quick actions must support drag repositioning",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "setIsOpen(false)",
    "floating quick actions must support closing",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "setIsOpen(true)",
    "floating quick actions must support reopening",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "shortcutTileClasses",
    "floating quick actions must render colored full-tile shortcuts",
  );
  assert(
    !read("client/src/modules/workbench/floating-quick-actions.tsx").includes(
      'helper ?? "工作台入口"',
    ),
    "floating quick actions must not show repeated workspace-entry helper text",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "aria-current",
    "floating quick actions must expose current-route state",
  );
  sourceIncludes(
    "client/src/modules/workbench/floating-quick-actions.tsx",
    "sr-only",
    "floating quick actions must preserve accessibility text",
  );
};

const runRemovedSystemObserverTests = () => {
  const appSource = read("client/src/App.tsx");
  const registrySource = read("shared/modules/registry.ts");
  const systemRoutesSource = read("server/modules/system/routes.ts");
  const rawInspectorId = ["raw", "inspector"].join("-");
  const lifeguardAuditId = ["lifeguard", "audit"].join("-");
  const systemLifeguardAuditId = ["system", "lifeguard", "audit"].join("-");
  assert(
    !appSource.includes(`/system/${rawInspectorId}`),
    "raw inspector independent route must be removed from App",
  );
  assert(
    !appSource.includes(`/system/${lifeguardAuditId}`),
    "lifeguard audit independent route must be removed from App",
  );
  assert(
    !appSource.includes("/system/topology"),
    "topology independent route must be removed from App",
  );
  assert(
    !registrySource.includes(`id: "${rawInspectorId}"`),
    "raw inspector must be removed from registry",
  );
  assert(
    !registrySource.includes(`id: "${systemLifeguardAuditId}"`),
    "system lifeguard audit must be removed from registry",
  );
  assert(
    !registrySource.includes('id: "system-topology"'),
    "system topology must be removed from registry",
  );
  assert(
    !systemRoutesSource.includes(`/api/bff/system/${rawInspectorId}`),
    "raw inspector API endpoint must be removed",
  );
  assert(
    !read("server/modules/lifeguard/routes.ts").includes(
      `/api/bff/system/${lifeguardAuditId}`,
    ),
    "lifeguard audit API endpoint must be removed",
  );
};

const runTelemetryAuditTests = () => {
  sourceIncludes(
    "server/modules/telemetry/repository.ts",
    "listAuditLogs",
    "telemetry repository must expose audit log listing",
  );
  sourceMatches(
    "server/modules/telemetry/routes.ts",
    /app\.get\("\/api\/audit\/logs",\s*requireSession,\s*requireRole\("system"\)/,
    "audit logs endpoint must require system role",
  );
  sourceMatches(
    "server/modules/telemetry/routes.ts",
    /app\.get\("\/api\/bff\/system\/ui-event-overview",\s*requireSession,\s*requireRole\("system"\)/,
    "ui event overview endpoint must require system role",
  );
  sourceMatches(
    "server/modules/telemetry/routes.ts",
    /app\.get\("\/api\/telemetry\/module-events",\s*requireSession,\s*requireRole\("system"\)/,
    "module events endpoint must require system role",
  );
  sourceIncludes(
    "client/src/modules/system/audit/page.tsx",
    "fetchAuditLogs",
    "system audit page must query audit logs",
  );
};

const runRegistryGuardTests = () => {
  sourceMatches(
    "server/modules/registry/moduleRegistryController.ts",
    /app\.get\("\/api\/system\/module-registry",\s*requireSession,\s*requireRole\("system"\),\s*requireSystemRegistryRead/,
    "raw module registry endpoint must be guarded",
  );
  sourceIncludes(
    "server/modules/auth/session-store.ts",
    "system:module-registry:read",
    "system sessions must include registry read permission",
  );
  sourceIncludes(
    "shared/modules/registry.ts",
    "Source of truth: this code manifest is authoritative",
    "module registry must declare code manifest as source of truth",
  );
};

const runSystemReadEndpointAuthTests = () => {
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/health-overview",\s*requireSession,\s*requireRole\("system"\)/,
    "health overview endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/integration-overview",\s*requireSession,\s*requireRole\("system"\)/,
    "integration overview endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/watchdog-events",\s*requireSession,\s*requireRole\("system"\)/,
    "watchdog events endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/helper-status",\s*requireSession,\s*requireRole\("system"\)/,
    "helper status endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/line-whitelist",\s*requireSession,\s*requireRole\("system"\)/,
    "line whitelist endpoint must require system role",
  );
  sourceMatches(
    "server/modules/system/routes.ts",
    /app\.get\("\/api\/bff\/system\/schedule-snapshot",\s*requireSession,\s*requireRole\("system"\)/,
    "schedule snapshot endpoint must require system role",
  );
  sourceIncludes(
    "server/modules/system/routes.ts",
    "adapter_is_mock_in_real_mode",
    "real mode mock adapters must expose degraded reason",
  );
};

const runCanonicalFacilityKeyTests = () => {
  assert(
    isCanonicalFacilityKey("xinbei_pool"),
    "xinbei_pool must be canonical",
  );
  assert(
    toCanonicalFacilityKey("xinbei-high-school") === "xinbei_pool",
    "legacy Xinbei key must map to canonical key",
  );
  assert(
    toCanonicalFacilityKey("not-a-facility") === undefined,
    "unknown facility key must not silently fallback",
  );
  assert(
    !read("server/modules/bff/employee-home.ts").includes("xinbei-high-school"),
    "employee home mock must not return legacy facility key",
  );
  sourceIncludes(
    "server/modules/bff/routes.ts",
    "INVALID_FACILITY_KEY",
    "employee BFF must hard-fail invalid facility keys",
  );
};

const runPersonalNoteOwnerPolicyTests = () => {
  const rows = [
    { id: 1, category: "sticky_note", createdByEmployeeNumber: "A001" },
    { id: 2, category: "sticky_note", createdByEmployeeNumber: "B002" },
    { id: 3, category: "document", createdByEmployeeNumber: "B002" },
  ];
  const employeeA = filterEmployeeResourcesForCaller(rows, "A001")
    .map((item) => item.id)
    .join(",");
  const employeeB = filterEmployeeResourcesForCaller(rows, "B002")
    .map((item) => item.id)
    .join(",");
  assert(
    employeeA === "1,3",
    `employee A sticky-note visibility leaked: ${employeeA}`,
  );
  assert(
    employeeB === "2,3",
    `employee B sticky-note visibility leaked: ${employeeB}`,
  );
  assert(
    !canMutateEmployeeResource(rows[1], {
      employeeNumber: "A001",
      isSupervisor: true,
    }),
    "supervisor must not mutate another user's sticky_note",
  );
  assert(
    canMutateEmployeeResource(rows[0], {
      employeeNumber: "A001",
      isSupervisor: true,
    }),
    "supervisor may mutate only their own sticky_note",
  );
  sourceIncludes(
    "server/storage.ts",
    "ownerEmployeeNumber",
    "employee resource storage must expose owner filter",
  );
  sourceIncludes(
    "server/modules/portal/content-routes.ts",
    "canMutateEmployeeResource(existing, caller)",
    "employee resource mutations must enforce sticky-note owner policy",
  );
  sourceIncludes(
    "client/src/modules/employee/personal-note/page.tsx",
    'fetchEmployeeResources(facilityKey, "sticky_note"',
    "personal-note page must query owner-filtered sticky_note endpoint",
  );
};

const runQnaReviewPolicyTests = () => {
  sourceIncludes(
    "shared/schema.ts",
    'reviewStatus: text("review_status").default("approved").notNull()',
    "Q&A schema must include review_status",
  );
  sourceIncludes(
    "migrations/0007_qna_supervisor_review.sql",
    "ADD COLUMN IF NOT EXISTS review_status",
    "Q&A review migration must add review_status",
  );
  sourceIncludes(
    "server/storage.ts",
    "viewerEmployeeNumber",
    "Q&A storage must support employee visibility filter",
  );
  sourceIncludes(
    "server/modules/portal/content-routes.ts",
    'reviewStatus: "pending"',
    "employee-created Q&A must default to pending review",
  );
  sourceIncludes(
    "server/modules/portal/content-routes.ts",
    'app.get("/api/bff/supervisor/qna-review"',
    "supervisor Q&A review BFF route must be registered",
  );
  sourceIncludes(
    "server/modules/portal/content-routes.ts",
    'action: reviewStatus === "approved" ? "QNA_APPROVED" : "QNA_REJECTED"',
    "Q&A review must audit approve/reject actions",
  );
  sourceIncludes(
    "client/src/App.tsx",
    "/supervisor/qna-review",
    "supervisor Q&A review page must be routed",
  );
  sourceIncludes(
    "client/src/modules/supervisor/qna-review/page.tsx",
    "核准公開",
    "supervisor Q&A review page must expose approve action",
  );
  sourceIncludes(
    "client/src/modules/employee/qna/page.tsx",
    "reviewStatusLabel",
    "employee Q&A page must display review status badge",
  );
};

const runNotConnectedUxTests = () => {
  sourceIncludes(
    "client/src/components/shared/not-connected-card.tsx",
    "export function NotConnectedCard",
    "shared NotConnectedCard component must exist",
  );
  sourceIncludes(
    "client/src/components/shared/not-connected-card.tsx",
    "export function DegradedCard",
    "shared DegradedCard component must exist",
  );
  sourceIncludes(
    "client/src/components/shared/not-connected-card.tsx",
    "外部資料源待接通",
    "not_connected UX must explain external pending state",
  );
  sourceIncludes(
    "client/src/components/shared/not-connected-card.tsx",
    'data-state={reason === "degraded" ? "degraded" : "not_connected"}',
    "not_connected UX must expose stable render state",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    '<NotConnectedCard title="天氣卡片"',
    "weather widget must use NotConnectedCard",
  );
  sourceIncludes(
    "client/src/modules/employee/home/employee-home-page.tsx",
    '<DegradedCard title="今日班表"',
    "shift reminder must use DegradedCard when source is disconnected",
  );
  sourceIncludes(
    "client/src/modules/employee/more/page.tsx",
    "/employee/checkins",
    "checkins route must render a not_connected surface",
  );
  sourceIncludes(
    "client/src/modules/employee/more/page.tsx",
    "/employee/registration-courses",
    "registration-courses route must render a not_connected surface",
  );
};

const runUnfinishedModulePolicyTests = () => {
  for (const role of roles) {
    const permissions = rolePermissions[role];
    const navigation = getNavigationModules(role, permissions);
    const cards = getHomeLayoutCards(role, permissions);
    const descriptors = getModuleDescriptorsByRole(role);
    const navIds = new Set(navigation.map((item) => item.id));
    const cardIds = new Set(cards.map((item) => item.moduleId));
    const nonReady = getModuleHealth(role, permissions).filter(
      (item) => item.status !== "ready",
    );

    for (const item of nonReady) {
      const descriptor = descriptors.find(
        (module) => module.id === item.moduleId,
      );
      assert(
        Boolean(descriptor),
        `${role} non-ready module lacks descriptor: ${item.moduleId}`,
      );
      const isVisible = navIds.has(item.moduleId) || cardIds.has(item.moduleId);
      const isAcceptedBackground =
        acceptedBackgroundPending.has(item.moduleId) ||
        descriptor?.stage === "disabled";
      assert(
        isVisible || isAcceptedBackground,
        `${role} non-ready module is neither visible nor policy-classified: ${item.moduleId}`,
      );
      if (cardIds.has(item.moduleId)) {
        const card = cards.find((entry) => entry.moduleId === item.moduleId)!;
        assert(
          card.status !== "error",
          `${role} card for ${item.moduleId} must not render as error by default`,
        );
        assert(
          Boolean(card.sourceStatus.source),
          `${role} card for ${item.moduleId} must expose source status`,
        );
      }
    }
  }
};

runEmployeeModuleTests();
runLifeguardModuleTests();
runSupervisorModuleTests();
runCanonicalModuleRegistrationTests();
runSystemModuleTests();
runRemovedSystemObserverTests();
runTelemetryAuditTests();
runRegistryGuardTests();
runSystemReadEndpointAuthTests();
runCanonicalFacilityKeyTests();
runPersonalNoteOwnerPolicyTests();
runQnaReviewPolicyTests();
runNotConnectedUxTests();
runUnfinishedModulePolicyTests();

console.log("Module unit tests passed");
console.log(
  `employee descriptors: ${getModuleDescriptorsByRole("employee").length}`,
);
console.log(
  `lifeguard descriptors: ${getModuleDescriptorsByRole("lifeguard").length}`,
);
console.log(
  `supervisor descriptors: ${getModuleDescriptorsByRole("supervisor").length}`,
);
console.log(
  `system descriptors: ${getModuleDescriptorsByRole("system").length}`,
);
