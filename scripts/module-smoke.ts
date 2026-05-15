import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { WorkbenchRole } from "../shared/auth/me";
import {
  assertModuleRegistryValid,
  getHomeLayoutCards,
  getModuleDescriptors,
  getModuleHealth,
  getNavigationModules,
} from "../shared/modules";
import {
  getPrimaryRoute,
  getRedirectForLegacyPath,
  getWorkbenchRoutes,
} from "../shared/navigation/workbench-routes";

const repoRoot = process.cwd();
const roles: WorkbenchRole[] = [
  "employee",
  "lifeguard",
  "supervisor",
  "system",
];

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const listFiles = (dir: string): string[] => {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (
      path.includes("node_modules") ||
      path.includes(".git") ||
      path.includes("dist")
    )
      continue;
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...listFiles(path));
    else result.push(path);
  }
  return result;
};

assertModuleRegistryValid();
const descriptors = getModuleDescriptors();
const ids = new Set<string>();

for (const descriptor of descriptors) {
  assert(!ids.has(descriptor.id), `Duplicate descriptor id: ${descriptor.id}`);
  ids.add(descriptor.id);
  assert(descriptor.roles.length > 0, `${descriptor.id} has no roles`);
  if (descriptor.defaultEnabled)
    assert(
      descriptor.roles.length > 0,
      `${descriptor.id} defaultEnabled but has no roles`,
    );
  if (descriptor.navVisible)
    assert(
      Boolean(descriptor.routePath),
      `${descriptor.id} navVisible but has no routePath`,
    );
}

for (const role of roles) {
  const navigation = getNavigationModules(role);
  const cards = getHomeLayoutCards(role);
  const health = getModuleHealth(role);
  assert(
    navigation.every((item) => ids.has(item.id)),
    `${role} navigation references an unknown module`,
  );
  assert(
    cards.every((card) => ids.has(card.moduleId)),
    `${role} home-layout references an unknown module`,
  );
  assert(
    health.every((item) => ids.has(item.moduleId)),
    `${role} health references an unknown module`,
  );
  assert(
    cards.every((card) =>
      ["ready", "empty", "not_connected", "incomplete", "error"].includes(
        card.status,
      ),
    ),
    `${role} has invalid HomeCardDto status`,
  );
  assert(
    cards.every((card) => {
      const stage =
        getModuleDescriptors().find((item) => item.id === card.moduleId)
          ?.stage ?? "";
      return ["planned", "api-wired", "bff-wired", "production-ready"].includes(
        stage,
      );
    }),
    `${role} home-layout exposes a disabled or ui-only module`,
  );
}

assert(
  !getNavigationModules("employee").some((item) =>
    item.routePath.startsWith("/system"),
  ),
  "employee can see a system route",
);
const removedRawInspectorId = ["raw", "inspector"].join("-");
const removedLifeguardAuditId = ["system", "lifeguard", "audit"].join("-");
const removedTopologyId = ["system", "topology"].join("-");
assert(
  !getModuleDescriptors().some((item) =>
    [
      removedRawInspectorId,
      removedLifeguardAuditId,
      removedTopologyId,
    ].includes(item.id),
  ),
  "removed system observer modules still exist",
);
assert(
  getNavigationModules("employee")
    .map((item) => item.id)
    .join(",") ===
    "employee-home,tasks,announcements,handover,activity-periods,employee-resources,employee-training,personal-note,lifeguard-lost-and-found,courts,knowledge-base-qna",
  `employee navigation order changed: ${getNavigationModules("employee")
    .map((item) => item.id)
    .join(",")}`,
);
assert(
  getHomeLayoutCards("employee")
    .map((item) => item.moduleId)
    .join(",") ===
    "employee-home,tasks,announcements,handover,activity-periods,employee-resources,employee-training,personal-note,lifeguard-lost-and-found,courts,knowledge-base-qna,shift-reminder,booking-snapshot,notification-center,weather-widget,registration-courses,search",
  `employee home card order changed: ${getHomeLayoutCards("employee")
    .map((item) => item.moduleId)
    .join(",")}`,
);
assert(
  getNavigationModules("lifeguard")
    .map((item) => item.id)
    .join(",") ===
    "lifeguard-home,lifeguard-water-quality,lifeguard-coach-dive,lifeguard-cleanup,lifeguard-lane-issues,lifeguard-lost-and-found,lifeguard-lane-rentals,lifeguard-log,announcements,employee-training,knowledge-base-qna",
  `lifeguard navigation order changed: ${getNavigationModules("lifeguard")
    .map((item) => item.id)
    .join(",")}`,
);
assert(
  getHomeLayoutCards("lifeguard")
    .map((item) => item.moduleId)
    .join(",") ===
    "lifeguard-home,lifeguard-water-quality,lifeguard-coach-dive,lifeguard-cleanup,lifeguard-lane-issues,lifeguard-lost-and-found,lifeguard-lane-rentals,lifeguard-log,announcements,employee-training,knowledge-base-qna,search",
  `lifeguard home card order changed: ${getHomeLayoutCards("lifeguard")
    .map((item) => item.moduleId)
    .join(",")}`,
);
assert(
  getNavigationModules("supervisor")
    .map((item) => item.id)
    .join(",") ===
    "supervisor-dashboard,facilities,parking,counter-log,lane-rentals,courts,tasks,announcements,announcement-groups,supervisor-lifeguard-overview,handover,employee-training,anomalies,analytics",
  `supervisor navigation order changed: ${getNavigationModules("supervisor")
    .map((item) => item.id)
    .join(",")}`,
);
for (const item of getNavigationModules("supervisor")) {
  assert(
    !item.routePath.startsWith("/admin/"),
    `supervisor navigation must not include legacy admin path: ${item.id} -> ${item.routePath}`,
  );
  assert(
    !item.routePath.startsWith("/courts/"),
    `supervisor navigation must not include naked courts path: ${item.id} -> ${item.routePath}`,
  );
  assert(
    item.routePath !== "/analytics",
    "supervisor navigation must not include legacy analytics path",
  );
  assert(
    item.routePath !== "/operations",
    "supervisor navigation must not include legacy operations path",
  );
}
assert(
  getWorkbenchRoutes("supervisor")
    .map((item) => item.moduleId)
    .join(",") ===
    "supervisor-dashboard,facilities,parking,counter-log,lane-rentals,courts,tasks,announcements,announcement-groups,supervisor-lifeguard-overview,handover,employee-training,anomalies,analytics",
  "supervisor route manifest must match sidebar order",
);
assert(
  getPrimaryRoute("parking", "supervisor") === "/supervisor/parking",
  "parking supervisor primary path changed",
);
assert(
  getPrimaryRoute("counter-log", "supervisor") ===
    "/supervisor/counter-log/submissions",
  "counter-log supervisor primary path changed",
);
assert(
  getPrimaryRoute("lane-rentals", "supervisor") === "/supervisor/lane-rentals",
  "lane-rentals supervisor primary path changed",
);
assert(
  getPrimaryRoute("courts", "supervisor") === "/supervisor/courts/xinbei",
  "courts supervisor primary path changed",
);
assert(
  getPrimaryRoute("courts", "employee") === "/employee/courts/xinbei",
  "courts employee primary path changed",
);
assert(
  getRedirectForLegacyPath("/admin/parking/dashboard") ===
    "/supervisor/parking",
  "legacy admin parking dashboard must redirect to supervisor parking",
);
assert(
  getRedirectForLegacyPath("/admin/announcement-groups") ===
    "/supervisor/announcement-groups",
  "legacy announcement groups path must redirect to supervisor announcement groups",
);
assert(
  getRedirectForLegacyPath("/admin/counter-logs/submissions") ===
    "/supervisor/counter-log/submissions",
  "legacy counter logs path must redirect to supervisor counter log",
);
assert(
  getRedirectForLegacyPath("/admin/lane-rentals") ===
    "/supervisor/lane-rentals",
  "legacy lane rentals path must redirect to supervisor lane rentals",
);
assert(
  getRedirectForLegacyPath("/courts/xinbei") === "/supervisor/courts/xinbei",
  "legacy courts path must redirect to supervisor courts",
);
assert(
  getHomeLayoutCards("supervisor")
    .map((item) => item.moduleId)
    .join(",") ===
    "supervisor-dashboard,facilities,parking,counter-log,lane-rentals,courts,tasks,announcements,announcement-groups,supervisor-lifeguard-overview,handover,employee-training,anomalies,analytics,booking-snapshot,notification-center,search",
  `supervisor home card order changed: ${getHomeLayoutCards("supervisor")
    .map((item) => item.moduleId)
    .join(",")}`,
);
assert(
  getNavigationModules("system")
    .map((item) => item.id)
    .join(",") ===
    "system-control-center,system-watchdog,system-operations,system-insights,system-governance,helper-status,line-whitelist",
  `system navigation order changed: ${getNavigationModules("system")
    .map((item) => item.id)
    .join(",")}`,
);
assert(
  getHomeLayoutCards("system")
    .map((item) => item.moduleId)
    .join(",") ===
    "system-control-center,system-watchdog,system-operations,system-insights,system-governance,helper-status,line-whitelist",
  `system home card order changed: ${getHomeLayoutCards("system")
    .map((item) => item.moduleId)
    .join(",")}`,
);
for (const role of roles) {
  const cards = getHomeLayoutCards(role);
  getNavigationModules(role).forEach((item) =>
    assert(
      cards.some((card) => card.moduleId === item.id),
      `${role} navigation module missing home card: ${item.id}`,
    ),
  );
}

const clientFiles = listFiles(join(repoRoot, "client", "src")).filter((file) =>
  /\.(ts|tsx)$/.test(file),
);
const localStorageViolations: string[] = [];
const externalFetchViolations: string[] = [];
const hardcodedNavigationViolations: string[] = [];

for (const file of clientFiles) {
  const text = readFileSync(file, "utf8");
  const rel = relative(repoRoot, file);
  const storageMatches = text.matchAll(
    /localStorage\.(?:setItem|getItem)\(["'`]([^"'`]+)["'`]/g,
  );
  for (const match of storageMatches) {
    const key = match[1].toLowerCase();
    if (/(token|session|role|facility|auth|sid)/.test(key) && key !== "theme") {
      localStorageViolations.push(`${rel}: localStorage key ${match[1]}`);
    }
  }
  if (
    (/fetch\(["'`]https?:\/\//.test(text) ||
      /apiGet<.*>\(["'`]https?:\/\//.test(text)) &&
    !rel.endsWith("modules\\lifeguard\\shared\\camera-capture.tsx")
  ) {
    externalFetchViolations.push(rel);
  }
  if (
    rel.endsWith("modules\\employee\\employee-shell.tsx") ||
    rel.endsWith("modules\\employee\\home\\employee-home-page.tsx") ||
    rel.endsWith("modules\\workbench\\role-shell.tsx")
  ) {
    if (
      /const\s+(navItems|employeeNav|mobileNav|roleNav|roleMobileNav)\s*=/.test(
        text,
      )
    ) {
      hardcodedNavigationViolations.push(rel);
    }
  }
}

assert(
  localStorageViolations.length === 0,
  `localStorage authority violations:\n${localStorageViolations.join("\n")}`,
);
assert(
  externalFetchViolations.length === 0,
  `frontend direct external API calls:\n${externalFetchViolations.join("\n")}`,
);
assert(
  hardcodedNavigationViolations.length === 0,
  `hardcoded navigation module lists detected:\n${hardcodedNavigationViolations.join("\n")}`,
);

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
const bffRoutes = bffRuntimeFiles
  .map((file) => readFileSync(join(repoRoot, file), "utf8"))
  .join("\n");
const appRoutes = readFileSync(
  join(repoRoot, "client", "src", "App.tsx"),
  "utf8",
);
const authSessionStore = readFileSync(
  join(repoRoot, "server", "modules", "auth", "session-store.ts"),
  "utf8",
);
const telemetryRepository = readFileSync(
  join(repoRoot, "server", "modules", "telemetry", "repository.ts"),
  "utf8",
);
const employeeTrainingPage = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "employee",
    "training",
    "page.tsx",
  ),
  "utf8",
);
const employeeQnaPage = readFileSync(
  join(repoRoot, "client", "src", "modules", "employee", "qna", "page.tsx"),
  "utf8",
);
const roleShellSource = readFileSync(
  join(repoRoot, "client", "src", "modules", "workbench", "role-shell.tsx"),
  "utf8",
);
const employeeHomeMockSource = readFileSync(
  join(repoRoot, "server", "modules", "bff", "employee-home.ts"),
  "utf8",
);
const supervisorTasksPage = readFileSync(
  join(repoRoot, "client", "src", "modules", "supervisor", "tasks", "page.tsx"),
  "utf8",
);
const supervisorPeoplePage = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "supervisor",
    "people",
    "page.tsx",
  ),
  "utf8",
);
const supervisorHandoverPage = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "supervisor",
    "handover",
    "page.tsx",
  ),
  "utf8",
);
const supervisorAnnouncementsPage = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "supervisor",
    "announcements",
    "page.tsx",
  ),
  "utf8",
);
const domainWriteMetadata = readFileSync(
  join(repoRoot, "server", "shared", "data", "write-metadata.ts"),
  "utf8",
);
const domainMetadataMigration = readFileSync(
  join(repoRoot, "migrations", "0003_domain_5w1h_metadata.sql"),
  "utf8",
);
const qnaMigration = readFileSync(
  join(repoRoot, "migrations", "0005_knowledge_base_qna.sql"),
  "utf8",
);
const supervisorAnnouncementMigration = readFileSync(
  join(repoRoot, "migrations", "0006_supervisor_announcement_controls.sql"),
  "utf8",
);
const legacyRoutes = [
  "server/routes.ts",
  "server/modules/anomalies/legacy-routes.ts",
  "server/modules/auth/legacy-ragic-auth.ts",
  "server/modules/external-proxy/legacy-routes.ts",
  "server/modules/notification-recipients/legacy-routes.ts",
  "server/modules/portal/content-routes.ts",
  "server/modules/portal/handover-routes.ts",
]
  .map((file) => readFileSync(join(repoRoot, file), "utf8"))
  .join("\n");
const taskRoutes = readFileSync(
  join(repoRoot, "server", "modules", "tasks", "index.ts"),
  "utf8",
);
const storageSource = readFileSync(
  join(repoRoot, "server", "storage.ts"),
  "utf8",
);
assert(
  bffRoutes.includes("attachEmployeeHomeContract"),
  "/api/bff/employee/home does not attach stable home-card contract",
);
assert(
  bffRoutes.includes("/api/search/global"),
  "/api/search/global is not registered",
);
assert(
  bffRoutes.includes("/api/bff/system/dashboard"),
  "/api/bff/system/dashboard alias is not registered",
);
assert(
  bffRoutes.includes("/api/bff/employee/shifts/today"),
  "/api/bff/employee/shifts/today is not registered",
);
assert(
  /app\.get\("\/api\/bff\/employee\/home",\s*requireSession/.test(bffRoutes),
  "/api/bff/employee/home must require session",
);
assert(
  /app\.get\("\/api\/bff\/employee\/search",\s*requireSession/.test(bffRoutes),
  "/api/bff/employee/search must require session",
);
assert(
  /app\.get\("\/api\/search\/global",\s*requireSession/.test(bffRoutes),
  "/api/search/global must require session",
);
assert(
  /app\.get\(\s*"\/api\/bff\/supervisor\/dashboard",\s*requireRole\(\s*"supervisor",\s*"system"\s*\)/.test(
    bffRoutes,
  ),
  "/api/bff/supervisor/dashboard must require supervisor or system role",
);
assert(
  bffRoutes.includes("mapSystemAnnouncementSummary"),
  "employee BFF must expose a shared system announcement mapper",
);
assert(
  /enrichEmployeeHome[\s\S]*storage[\s\S]*\.listSystemAnnouncements\(\s*normalizedFacilityKey,\s*true\s*\)/.test(
    bffRoutes,
  ),
  "employee BFF enrich path must merge active supervisor-published system announcements",
);
assert(
  /uniqueAnnouncements\(\s*\[\s*\.\.\.lineAnnouncementsResult\.announcements,\s*\.\.\.employeeResources\.announcements,\s*\.\.\.portalAnnouncements/.test(
    bffRoutes,
  ),
  "employee BFF announcements must merge LINE group announcements, employee announcements, and portal system announcements",
);
assert(
  !authSessionStore.includes("user.isSupervisor ?? true"),
  "Ragic auth mapping must not fail open to supervisor/system",
);
assert(
  authSessionStore.includes("user.isSupervisor === true"),
  "Ragic auth mapping must explicitly require isSupervisor === true",
);
assert(
  authSessionStore.includes(
    'activeRole: isSupervisor ? "supervisor" : isLifeguard ? "lifeguard" : "employee"',
  ),
  "Lifeguard sessions must default to lifeguard and supervisor sessions must default to supervisor, not system",
);
assert(
  authSessionStore.includes('"lifeguard" as const'),
  "Lifeguard sessions must include lifeguard granted role",
);
assert(
  bffRoutes.includes("/api/bff/lifeguard/home"),
  "lifeguard BFF home route must be registered",
);
assert(
  appRoutes.includes("/lifeguard/log"),
  "lifeguard log route must be registered",
);
assert(
  appRoutes.includes("/supervisor/parking/event-days"),
  "parking event-days supervisor route must be registered",
);
assert(
  appRoutes.includes("/supervisor/parking"),
  "parking supervisor route must be registered",
);
assert(
  appRoutes.includes("/supervisor/announcement-groups"),
  "announcement groups supervisor route must be registered",
);
assert(
  appRoutes.includes("/supervisor/counter-log/submissions"),
  "counter-log supervisor route must be registered",
);
assert(
  appRoutes.includes("/supervisor/lane-rentals"),
  "lane-rentals supervisor route must be registered",
);
assert(
  appRoutes.includes("/supervisor/courts/:school"),
  "courts supervisor route must be registered",
);
assert(
  appRoutes.includes("SupervisorCourtsFrame"),
  "courts supervisor routes must be wrapped in the supervisor module shell",
);
assert(
  appRoutes.includes("/employee/courts/:school"),
  "courts employee route must be registered",
);
assert(
  appRoutes.includes("EmployeeCourtsFrame"),
  "courts employee routes must be wrapped in the employee shell",
);
assert(
  !appRoutes.includes("AppSidebar"),
  "App.tsx must not import or render the legacy AppSidebar",
);
assert(
  !appRoutes.includes("SidebarProvider"),
  "App.tsx must not import or render the legacy SidebarProvider fallback",
);
const moduleIdsSource = readFileSync(
  join(repoRoot, "shared", "modules", "ids.ts"),
  "utf8",
);
for (const id of [
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
]) {
  assert(
    moduleIdsSource.includes(`"${id}"`),
    `canonical module id missing: ${id}`,
  );
}
assert(
  !appRoutes.includes(`/system/${removedRawInspectorId}`),
  "raw inspector independent route must be removed",
);
assert(
  !appRoutes.includes(`/system/${["lifeguard", "audit"].join("-")}`),
  "lifeguard audit independent route must be removed",
);
assert(
  !appRoutes.includes("/system/topology"),
  "topology independent route must be removed",
);
const supervisorModuleShell = readFileSync(
  join(repoRoot, "client", "src", "modules", "supervisor", "module-shell.tsx"),
  "utf8",
);
assert(
  supervisorModuleShell.includes("SupervisorModuleShell"),
  "supervisor module shell must exist",
);
const parkingShell = readFileSync(
  join(repoRoot, "client", "src", "pages", "admin", "parking", "_shared.tsx"),
  "utf8",
);
const counterLogShell = readFileSync(
  join(repoRoot, "client", "src", "pages", "admin", "work-logs", "_shared.tsx"),
  "utf8",
);
const laneRentalsPage = readFileSync(
  join(repoRoot, "client", "src", "pages", "admin", "lane-rentals.tsx"),
  "utf8",
);
const courtsHeader = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "pages",
    "courts",
    "_components",
    "app-header.tsx",
  ),
  "utf8",
);
assert(
  parkingShell.includes("SupervisorModuleShell"),
  "parking pages must render inside supervisor module shell",
);
assert(
  counterLogShell.includes("SupervisorModuleShell"),
  "counter-log pages must render inside supervisor module shell",
);
assert(
  laneRentalsPage.includes("SupervisorModuleShell"),
  "lane rentals page must render inside supervisor module shell",
);
assert(
  !/href:\s*"\/admin\/parking/.test(parkingShell),
  "parking tabs must not use legacy admin hrefs",
);
assert(
  !/counter:\s*"\/admin\/counter-logs"/.test(counterLogShell),
  "counter-log tabs must not use legacy admin prefix",
);
assert(
  !courtsHeader.includes("`/courts/${school}"),
  "courts header must not use naked courts links",
);
assert(
  !courtsHeader.includes('href="/employee"'),
  "courts header must not expose old return-to-employee entry",
);
const facilityGateSource = readFileSync(
  join(repoRoot, "client", "src", "shared", "auth", "facility-gate.tsx"),
  "utf8",
);
assert(
  facilityGateSource.includes("無可用場館"),
  "facility gate must render no-facility state",
);
const lifeguardLogPage = readFileSync(
  join(repoRoot, "client", "src", "modules", "lifeguard", "log", "page.tsx"),
  "utf8",
);
assert(
  lifeguardLogPage.includes("currentShiftInTaipei"),
  "lifeguard log must derive current shift",
);
assert(
  !lifeguardLogPage.includes('"xinbei_pool"'),
  "lifeguard log must not fallback to xinbei_pool",
);
const workLogRoutes = readFileSync(
  join(repoRoot, "server", "modules", "work-logs", "routes.ts"),
  "utf8",
);
assert(
  workLogRoutes.includes('action: "LIFEGUARD_LOG_CREATED"'),
  "lifeguard log create must write audit action",
);
assert(
  workLogRoutes.includes('action: "LIFEGUARD_LOG_UPDATED"'),
  "lifeguard log update must write audit action",
);
assert(
  telemetryRepository.includes("createPostgresTelemetryRepository"),
  "createPostgresTelemetryRepository must exist",
);
assert(
  employeeTrainingPage.includes(
    "resourceId: String(item.resourceId ?? item.id)",
  ),
  "TRAINING_VIEW must send a stable string resourceId",
);
assert(
  employeeQnaPage.includes("fetchKnowledgeBaseQna"),
  "/employee/qna must read knowledge base Q&A data",
);
assert(
  employeeQnaPage.includes("createKnowledgeBaseQna"),
  "/employee/qna must create Q&A entries",
);
const employeeHomePageSource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "employee",
    "home",
    "employee-home-page.tsx",
  ),
  "utf8",
);
assert(
  employeeHomePageSource.includes("FloatingQuickActionsPanel"),
  "employee home must render the fixed floating quick actions panel from GitHub layout",
);
assert(
  !employeeHomePageSource.includes("QuickEntryStrip"),
  "employee home must not include the quick entry strip",
);
assert(
  employeeHomePageSource.includes("resolveEmployeeHomeSlots"),
  "employee home must use fixed canonical slots",
);
assert(
  employeeHomePageSource.includes('homeSlots.isEnabled("announcements")'),
  "employee announcements must render from canonical enabled slot",
);
assert(
  employeeHomePageSource.includes('homeSlots.isEnabled("tutoringToday")'),
  "employee home must render today tutoring from a canonical slot",
);
assert(
  employeeHomePageSource.includes("TodayTutoringCard"),
  "employee home must keep the GitHub tutoring card layout",
);
assert(
  !employeeHomePageSource.includes('homeSlots.isEnabled("tasks")'),
  "employee home must not render the today tasks card",
);
assert(
  /homeSlots\.isEnabled\("handover"\)[\s\S]*homeSlots\.isEnabled\("tutoringToday"\)[\s\S]*homeSlots\.isEnabled\("announcements"\)[\s\S]*homeSlots\.isEnabled\("shifts"\)[\s\S]*homeSlots\.isEnabled\("events"\)[\s\S]*homeSlots\.isEnabled\("documents"\)[\s\S]*homeSlots\.isEnabled\("courts"\)[\s\S]*homeSlots\.isEnabled\("stickyNotes"\)/.test(
    employeeHomePageSource,
  ),
  "employee home slots must render in the GitHub fixed dashboard order",
);
assert(
  /homeSlots\.isEnabled\("courts"\) && courtSchools\.length[\s\S]*lg:col-span-8[\s\S]*<CourtsScrollCard schools=\{courtSchools\} onOpenDrawer=\{\(\) => setCourtsDrawerOpen\(true\)\} \/>/.test(
    employeeHomePageSource,
  ),
  "employee courts scroll strip must render only for court-enabled facilities and span two desktop grid blocks",
);
const employeeCourtsVisibilitySource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "employee",
    "courts-visibility.ts",
  ),
  "utf8",
);
assert(
  employeeCourtsVisibilitySource.includes('return ["xinbei"]'),
  "employee courts visibility must map Xinbei facilities to Xinbei school",
);
assert(
  employeeCourtsVisibilitySource.includes('return ["sanchong"]'),
  "employee courts visibility must map Sanchong/Sanlu facilities to Sanchong school",
);
assert(
  employeeHomePageSource.includes('fetchEmployeeCourtsToday("xinbei"'),
  "employee courts preview must load Xinbei rent summary",
);
assert(
  employeeHomePageSource.includes('fetchEmployeeCourtsToday("sanchong"'),
  "employee courts preview must load Sanchong rent summary",
);
assert(
  employeeHomePageSource.includes("/employee/courts/${school}"),
  "employee courts preview must link school-specific rent pages",
);
const courtsHeaderSource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "pages",
    "courts",
    "_components",
    "app-header.tsx",
  ),
  "utf8",
);
assert(
  courtsHeaderSource.includes("{schoolName}場租查看"),
  "courts page header must show school-specific rent view title",
);
assert(
  courtsHeaderSource.includes("單日場租"),
  "courts page must expose a daily rent view tab",
);
assert(
  courtsHeaderSource.includes("搜尋場租"),
  "courts page must expose a rent search tab",
);
assert(
  !employeeHomePageSource.includes("家教預約資料尚未接入"),
  "employee home must not show tutoring not-connected placeholder",
);
assert(
  employeeHomePageSource.includes("家教預約模組規劃中"),
  "employee home must show tutoring as a future module preview",
);
assert(
  employeeHomePageSource.includes("即將加入"),
  "employee tutoring preview must clearly state it is a future module",
);
assert(
  !employeeHomePageSource.includes("/employee/tutoring"),
  "employee home must not link to nonexistent tutoring route",
);
assert(
  employeeHomePageSource.includes("CourtsScrollCard"),
  "employee home must render the fixed courts scroll strip",
);
assert(
  !employeeHomePageSource.includes("xl:pr-[280px]"),
  "employee desktop content must keep the original page width",
);
assert(
  !employeeHomePageSource.includes("xl:pr-[104px]"),
  "employee desktop content must not reserve quick-action rail space",
);
assert(
  !employeeHomePageSource.includes("apiRequest("),
  "employee home placeholder cards must not call mutation APIs",
);
assert(
  roleShellSource.includes('getWorkbenchRoutes("supervisor")'),
  "supervisor shell must use canonical workbench route manifest",
);
assert(
  roleShellSource.includes("h-dvh overflow-hidden"),
  "workbench shell must stay full viewport height without body scroll gaps",
);
assert(
  roleShellSource.includes("w-[220px]"),
  "desktop supervisor/system sidebar width must follow supervisor design token width",
);
assert(
  roleShellSource.includes("todayLabel"),
  "workbench shell must render a dynamic date label",
);
assert(
  !roleShellSource.includes("2026/04/23"),
  "workbench shell must not render a hardcoded date",
);
assert(
  !employeeHomeMockSource.includes("2026年4月23日"),
  "employee home BFF mock must not return a stale hardcoded business date",
);
assert(
  !employeeHomeMockSource.includes("2026/04/23"),
  "supervisor BFF mock must not return a stale hardcoded business date",
);
assert(
  employeeHomeMockSource.includes("businessDateLabel"),
  "BFF mock dates must use a dynamic Taipei business date label",
);
assert(
  roleShellSource.includes("System Console"),
  "system shell must expose system-specific console copy",
);
assert(
  roleShellSource.includes("IT 治理與監控工作台"),
  "system shell must expose IT-specific scope copy",
);
const systemControlCenterPage = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "system",
    "control-center",
    "page.tsx",
  ),
  "utf8",
);
assert(
  systemControlCenterPage.includes("給系統管理員的一句話"),
  "system control center must use IT/system-facing language",
);
assert(
  !systemControlCenterPage.includes("給主管的一句話"),
  "system control center must not use supervisor-facing copy",
);
const supervisorDashboardPage = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "supervisor",
    "dashboard-page.tsx",
  ),
  "utf8",
);
const supervisorHomeDrawers = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "supervisor",
    "home-module-drawers.tsx",
  ),
  "utf8",
);
assert(
  supervisorDashboardPage.includes("現在當班人員"),
  "supervisor dashboard must expose now-on-duty drawer",
);
assert(
  supervisorDashboardPage.includes("查看當班人員"),
  "supervisor facility module must provide a visible now-on-duty drawer trigger",
);
assert(
  supervisorDashboardPage.includes("OnDutyDrawer"),
  "supervisor dashboard must keep now-on-duty drawer as an explicit component",
);
assert(
  supervisorDashboardPage.includes("buildDutyGroups"),
  "supervisor now-on-duty drawer must group staff by facility and position",
);
assert(
  supervisorDashboardPage.includes("positionLabel"),
  "supervisor now-on-duty drawer must derive an extensible position grouping label",
);
assert(
  supervisorDashboardPage.includes("SupervisorQuickActionRail"),
  "supervisor desktop quick actions must use a floating panel",
);
assert(
  supervisorDashboardPage.includes("canLoadSupervisorDashboard"),
  "supervisor dashboard must wait for supervisor/system active role before loading BFF data",
);
assert(
  supervisorDashboardPage.includes(
    "enabled: Boolean(canLoadSupervisorDashboard)",
  ),
  "supervisor dashboard query must not fire before active role is supervisor/system",
);
assert(
  /queryKey: \["supervisor-home", "parking"\][\s\S]*?retry: false,/.test(
    supervisorDashboardPage,
  ),
  "supervisor preview queries must fail fast when optional module APIs return errors",
);
assert(
  supervisorDashboardPage.includes("主管資料無法載入"),
  "supervisor dashboard must show an explicit BFF error state instead of infinite loading",
);
for (const id of ["parking", "counter-log", "lane-rentals", "courts"]) {
  assert(
    supervisorDashboardPage.includes(`moduleId: "${id}"`),
    `supervisor dashboard module drawer missing ${id}`,
  );
  assert(
    supervisorHomeDrawers.includes(
      `supervisor-module-preview-${"${preview.moduleId}"}`,
    ),
    "supervisor module preview cards must expose stable test ids",
  );
}
for (const path of [
  "/supervisor/parking",
  "/supervisor/parking/payments",
  "/supervisor/counter-log/submissions",
  "/supervisor/lane-rentals",
  "/supervisor/courts/xinbei",
  "/supervisor/courts/xinbei/search",
]) {
  assert(
    supervisorDashboardPage.includes(path),
    `supervisor home drawer CTA missing ${path}`,
  );
}
for (const forbidden of [
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
]) {
  assert(
    !supervisorHomeDrawers.includes(forbidden),
    `supervisor home drawers must be preview-only and canonical, found ${forbidden}`,
  );
}
assert(
  appRoutes.includes("/supervisor/facilities/:facilityKey"),
  "supervisor facility detail route must be registered",
);
assert(
  supervisorDashboardPage.includes(
    "const getFacilityDetailHref = (facilityKey: string) => `/supervisor/facilities/${encodeURIComponent(facilityKey)}`",
  ),
  "supervisor dashboard must define facility detail route helper",
);
assert(
  supervisorDashboardPage.includes(
    "navigate(getFacilityDetailHref(facility.facilityKey))",
  ) &&
    supervisorDashboardPage.includes("isInteractiveRailTarget") &&
    supervisorDashboardPage.includes("suppressFacilityClickAfterDrag") &&
    supervisorDashboardPage.includes("進入詳細面板"),
  "supervisor dashboard facility entry must deterministically navigate to the facility detail panel",
);
assert(
  supervisorPeoplePage.includes("FACILITY DETAIL"),
  "supervisor facilities page must render a facility detail mode",
);
assert(
  supervisorTasksPage.includes("setCreateOpen(true)") &&
    supervisorTasksPage.includes("supervisor-drawer"),
  "supervisor tasks page must use a right-side create drawer",
);
assert(
  supervisorPeoplePage.includes("selectedFacilityKey") &&
    supervisorPeoplePage.includes("facilities.map"),
  "supervisor facilities page must support facility-level filtering",
);
assert(
  !supervisorHandoverPage.includes("targetShiftLabel"),
  "supervisor handover page must not require fixed shift labels",
);
assert(
  supervisorAnnouncementsPage.includes("手動發布公告"),
  "supervisor announcements page must support manual announcement publishing",
);
assert(
  supervisorAnnouncementsPage.includes("公告類型") &&
    supervisorAnnouncementsPage.includes("置頂") &&
    supervisorAnnouncementsPage.includes("發布時間"),
  "supervisor announcements form must expose type, pinning, and publish time controls",
);
const lifeguardHomePageSource = readFileSync(
  join(repoRoot, "client", "src", "modules", "lifeguard", "home", "page.tsx"),
  "utf8",
);
const lifeguardShellSource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "lifeguard",
    "lifeguard-shell.tsx",
  ),
  "utf8",
);
const lifeguardOperationSource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "lifeguard",
    "operation-modules.ts",
  ),
  "utf8",
);
const lifeguardDetailSource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "lifeguard",
    "operation-detail-page.tsx",
  ),
  "utf8",
);
const systemDashboardPageSource = readFileSync(
  join(repoRoot, "client", "src", "modules", "system", "dashboard-page.tsx"),
  "utf8",
);
assert(
  lifeguardHomePageSource.includes("FloatingQuickActionsPanel"),
  "lifeguard desktop quick actions must use a floating panel",
);
assert(
  lifeguardHomePageSource.includes("LifeguardOperationDrawer"),
  "lifeguard home must expose module preview drawers",
);
assert(
  lifeguardHomePageSource.includes("setSelectedModuleId(module.id)"),
  "lifeguard operation cards must open a drawer preview",
);
assert(
  lifeguardShellSource.includes("primaryNav") &&
    lifeguardShellSource.includes("secondaryNav"),
  "lifeguard sidebar must split dedicated operations and shared links",
);
assert(
  lifeguardDetailSource.includes("LifeguardShell"),
  "lifeguard operation detail pages must use LifeguardShell",
);
for (const path of [
  "/lifeguard/water-quality",
  "/lifeguard/coach-dive",
  "/lifeguard/cleanup",
  "/lifeguard/lane-issues",
  "/lifeguard/lost-and-found",
  "/lifeguard/lane-rentals",
]) {
  assert(
    appRoutes.includes(path),
    `lifeguard operation detail route missing ${path}`,
  );
  assert(
    lifeguardOperationSource.includes(path),
    `lifeguard operation config must link ${path}`,
  );
}
for (const forbidden of [
  "POST",
  "PATCH",
  "DELETE",
  "apiPost",
  "apiPatch",
  "apiDelete",
  "/submit",
]) {
  assert(
    !lifeguardHomePageSource.includes(forbidden),
    `lifeguard home drawer must stay preview-only, found ${forbidden}`,
  );
}
assert(
  systemDashboardPageSource.includes("FloatingQuickActionsPanel"),
  "system desktop quick tools must use a floating panel",
);
assert(
  !lifeguardHomePageSource.includes("xl:pr-[280px]"),
  "lifeguard desktop content must keep the original page width",
);
assert(
  !systemDashboardPageSource.includes("xl:pr-[280px]"),
  "system desktop content must keep the original page width",
);
const floatingQuickActionsSource = readFileSync(
  join(
    repoRoot,
    "client",
    "src",
    "modules",
    "workbench",
    "floating-quick-actions.tsx",
  ),
  "utf8",
);
assert(
  floatingQuickActionsSource.includes("w-[80px]"),
  "floating quick actions must use the fixed compact rail width",
);
assert(
  floatingQuickActionsSource.includes("defaultActionSlot"),
  "floating quick actions must keep the same top control format across roles",
);
assert(
  floatingQuickActionsSource.includes("onPointerDown={beginDrag}"),
  "floating quick actions must support drag repositioning",
);
assert(
  floatingQuickActionsSource.includes("setIsOpen(false)") &&
    floatingQuickActionsSource.includes("setIsOpen(true)"),
  "floating quick actions must support close and reopen",
);
assert(
  floatingQuickActionsSource.includes("shortcutTileClasses"),
  "floating quick actions must render colored full-tile shortcuts",
);
assert(
  !floatingQuickActionsSource.includes('helper ?? "工作台入口"'),
  "floating quick actions must not show repeated workspace-entry helper text",
);
assert(
  floatingQuickActionsSource.includes("aria-current"),
  "floating quick actions must expose active route state",
);
assert(
  floatingQuickActionsSource.includes("sr-only"),
  "floating quick action accessibility text must be preserved",
);
assert(
  supervisorAnnouncementMigration.includes("announcement_type") &&
    supervisorAnnouncementMigration.includes("is_pinned"),
  "supervisor announcement migration must add type and pinning fields",
);
assert(
  qnaMigration.includes("CREATE TABLE IF NOT EXISTS knowledge_base_qna"),
  "Q&A migration must create knowledge_base_qna table",
);
assert(
  storageSource.includes("listKnowledgeBaseQna"),
  "storage must expose knowledge base Q&A list query",
);
assert(
  legacyRoutes.includes('app.get("/api/portal/knowledge-base-qna"'),
  "knowledge-base-qna list route must be registered",
);
assert(
  legacyRoutes.includes('app.post("/api/portal/knowledge-base-qna"'),
  "knowledge-base-qna create route must be registered",
);
assert(
  /storage\s*[\r\n\s]*\.\s*listKnowledgeBaseQna/.test(bffRoutes),
  "employee search BFF must include Q&A rows",
);
assert(
  telemetryRepository.includes('typeof value === "number"') &&
    telemetryRepository.includes("return String(value)"),
  "training view report must normalize numeric payload ids",
);
assert(
  taskRoutes.includes("withTaskCreateMetadata"),
  "task create route must use task create metadata helper",
);
assert(
  taskRoutes.includes("assignedByUserId: manager"),
  "task supervisor assignment must record assignedByUserId",
);
assert(
  taskRoutes.includes("assignedAt: manager"),
  "task supervisor assignment must record assignedAt",
);
assert(
  /storage\.updateTask\(id,\s*withUpdateMetadata/.test(taskRoutes),
  "task update routes must use update metadata",
);
assert(
  domainWriteMetadata.includes("withCreateMetadata"),
  "domain write metadata helper must expose withCreateMetadata",
);
assert(
  domainWriteMetadata.includes("withEmployeeCreateMetadata"),
  "domain write metadata helper must expose employee resource create metadata",
);
assert(
  domainWriteMetadata.includes("withTaskCreateMetadata"),
  "domain write metadata helper must expose task create metadata",
);
assert(
  domainWriteMetadata.includes("withUpdateMetadata"),
  "domain write metadata helper must expose withUpdateMetadata",
);
assert(
  domainMetadataMigration.includes("ALTER TABLE quick_links"),
  "domain 5W1H migration must cover quick_links",
);
assert(
  domainMetadataMigration.includes("ALTER TABLE employee_resources"),
  "domain 5W1H migration must cover employee_resources",
);
assert(
  domainMetadataMigration.includes("ALTER TABLE operational_handovers"),
  "domain 5W1H migration must cover operational_handovers",
);
assert(
  legacyRoutes.includes("withCreateMetadata(parsed.data"),
  "quick_links create route must use create metadata",
);
assert(
  legacyRoutes.includes("withUpdateMetadata(parsed.data"),
  "quick_links update route must use update metadata",
);
assert(
  legacyRoutes.includes("withEmployeeCreateMetadata(parsed.data"),
  "employee_resources create route must use employee create metadata",
);
assert(
  legacyRoutes.includes('isPrivate: body.category === "sticky_note"'),
  "sticky_note resources must default to private at create",
);
assert(
  /storage\.updateEmployeeResource\(id,\s*withUpdateMetadata/.test(
    legacyRoutes,
  ),
  "employee_resources update route must use update metadata",
);
assert(
  /storage\.createOperationalHandover\(withEmployeeCreateMetadata/.test(
    legacyRoutes,
  ),
  "operational_handovers create route must use employee create metadata",
);
assert(
  /app\.patch\("\/api\/portal\/operational-handovers\/:id",[\s\S]*storage\.updateOperationalHandover\(id,\s*withUpdateMetadata/.test(
    legacyRoutes,
  ),
  "operational_handovers supervisor update route must use update metadata",
);
assert(
  /app\.patch\("\/api\/portal\/operational-handovers\/:id\/report",[\s\S]*storage\.updateOperationalHandover\(id,\s*withUpdateMetadata/.test(
    legacyRoutes,
  ),
  "operational_handovers report route must use update metadata",
);
assert(
  /app\.post\("\/api\/portal\/handovers"[\s\S]*createdByRole: role/.test(
    legacyRoutes,
  ),
  "handover_entries create route must record createdByRole",
);
assert(
  /app\.post\("\/api\/portal\/handovers"[\s\S]*source: "manual"/.test(
    legacyRoutes,
  ),
  "handover_entries create route must record source",
);
assert(
  /storage\.createSystemAnnouncement\(withCreateMetadata/.test(legacyRoutes),
  "system_announcements create route must use create metadata",
);
assert(
  /storage\.updateSystemAnnouncement\(id,\s*withUpdateMetadata/.test(
    legacyRoutes,
  ),
  "system_announcements update route must use update metadata",
);
assert(
  /storage\.createAnomalyReport\([\s\S]*source: "external-checkin-system"/.test(
    legacyRoutes,
  ),
  "anomaly_reports create route must record external-checkin-system source",
);
assert(
  /const actor = anomalyResolutionActor\(req\);[\s\S]*storage\.updateAnomalyReportResolution\(id,\s*resolution,\s*resolvedNote \?\? null,\s*actor\)/.test(
    legacyRoutes,
  ),
  "anomaly_reports single resolution route must pass actor metadata",
);
assert(
  /const actor = anomalyResolutionActor\(req\);[\s\S]*storage\.batchUpdateResolution\(ids,\s*resolution,\s*resolvedNote \?\? null,\s*actor\)/.test(
    legacyRoutes,
  ),
  "anomaly_reports batch resolution route must pass actor metadata",
);
assert(
  storageSource.includes(
    'resolvedBy: resolution === "resolved" ? actor?.userId ?? null : null',
  ),
  "anomaly_reports resolution storage must record resolvedBy",
);
assert(
  storageSource.includes("updatedBy: actor?.userId ?? null"),
  "anomaly_reports resolution storage must record updatedBy",
);
assert(
  /storage\.createRecipient\(withCreateMetadata/.test(legacyRoutes),
  "notification_recipients create route must use create metadata",
);
assert(
  /storage\.updateRecipient\(id,\s*withUpdateMetadata/.test(legacyRoutes),
  "notification_recipients update route must use update metadata",
);
assert(
  legacyRoutes.includes('facilityKey: typeof facilityKey === "string"'),
  "notification_recipients create route must accept facilityKey",
);
const handoverRoutes = readFileSync(
  join(repoRoot, "server", "modules", "handover", "index.ts"),
  "utf8",
);
assert(
  handoverRoutes.includes("/api/bff/employee/handover/summary"),
  "/api/bff/employee/handover/summary is not registered",
);
assert(
  handoverRoutes.includes("/api/handover/:id/complete"),
  "/api/handover/:id/complete is not registered",
);

const routeBlock = (source: string, route: string) => {
  const start = source.indexOf(route);
  assert(start >= 0, `${route} route block was not found`);
  const next = source.indexOf("\n  app.", start + route.length);
  return source.slice(start, next >= 0 ? next : source.length);
};

const assertAuditAction = (source: string, route: string, action: string) => {
  const block = routeBlock(source, route);
  assert(block.includes("recordAudit({"), `${route} must call recordAudit`);
  assert(
    block.includes(`action: "${action}"`),
    `${route} must audit ${action}`,
  );
};

assertAuditAction(
  legacyRoutes,
  'app.post("/api/portal/operational-handovers"',
  "OPERATIONAL_HANDOVER_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/portal/operational-handovers/:id"',
  "OPERATIONAL_HANDOVER_UPDATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/portal/operational-handovers/:id/report"',
  "OPERATIONAL_HANDOVER_REPORTED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/portal/quick-links"',
  "QUICK_LINK_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/portal/quick-links/:id"',
  "QUICK_LINK_UPDATED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/portal/employee-resources"',
  "EMPLOYEE_RESOURCE_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/portal/employee-resources/:id"',
  "EMPLOYEE_RESOURCE_UPDATED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/portal/system-announcements"',
  "SYSTEM_ANNOUNCEMENT_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/portal/system-announcements/:id"',
  "SYSTEM_ANNOUNCEMENT_UPDATED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/portal/handovers"',
  "HANDOVER_ENTRY_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/anomaly-report"',
  "ANOMALY_REPORTED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/anomaly-reports/:id/resolution"',
  "ANOMALY_RESOLVED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/anomaly-reports/batch/resolution"',
  "ANOMALY_RESOLVED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/notification-recipients"',
  "NOTIFICATION_RECIPIENT_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/notification-recipients/:id"',
  "NOTIFICATION_RECIPIENT_UPDATED",
);
assertAuditAction(
  legacyRoutes,
  'app.delete("/api/notification-recipients/:id"',
  "NOTIFICATION_RECIPIENT_DELETED",
);
assertAuditAction(
  legacyRoutes,
  'app.post("/api/portal/knowledge-base-qna"',
  "KNOWLEDGE_QNA_CREATED",
);
assertAuditAction(
  legacyRoutes,
  'app.patch("/api/portal/knowledge-base-qna/:id"',
  "KNOWLEDGE_QNA_UPDATED",
);
assertAuditAction(
  legacyRoutes,
  'app.delete("/api/portal/knowledge-base-qna/:id"',
  "KNOWLEDGE_QNA_DELETED",
);
assertAuditAction(taskRoutes, 'app.post("/api/tasks"', "TASK_CREATED");
assertAuditAction(taskRoutes, 'app.patch("/api/tasks/:id"', "TASK_UPDATED");
assertAuditAction(
  taskRoutes,
  'app.patch("/api/tasks/:id/status"',
  "TASK_STATUS_UPDATED",
);

console.log("Module smoke checks passed");
console.log(`descriptors: ${descriptors.length}`);
for (const role of roles) {
  const completed = getModuleHealth(role).filter(
    (item) => item.status === "ready",
  ).length;
  const unfinished = getModuleHealth(role).filter(
    (item) => item.status !== "ready",
  ).length;
  console.log(
    `${role}: navigation=${getNavigationModules(role).length}, cards=${getHomeLayoutCards(role).length}, ready=${completed}, unfinished=${unfinished}`,
  );
}
