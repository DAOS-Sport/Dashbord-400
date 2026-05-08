import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getHomeLayoutCards,
  getModuleDescriptorsByRole,
  getModuleHealth,
  getNavigationModules,
} from "../shared/modules";
import type { WorkbenchRole } from "../shared/auth/me";
import { canMutateEmployeeResource, filterEmployeeResourcesForCaller } from "../shared/employee-resources/privacy";
import { isRawInspectorPath, rawInspectorTargets } from "../shared/system/raw-inspector";

const repoRoot = process.cwd();

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const sourceIncludes = (path: string, needle: string, message: string) => {
  assert(read(path).includes(needle), `${path}: ${message}`);
};

const sourceMatches = (path: string, pattern: RegExp, message: string) => {
  assert(pattern.test(read(path)), `${path}: ${message}`);
};

const rolePermissions = {
  employee: ["employee:home:read", "employee:resources:read", "employee:qna:read", "employee:checkin:read", "employee:booking:read", "workbench:search"],
  lifeguard: ["employee:home:read", "employee:resources:read", "employee:qna:read", "lifeguard:home:read", "lifeguard:log:read", "lifeguard:log:write", "workbench:search"],
  supervisor: ["supervisor:dashboard:read", "workbench:search"],
  system: [
    "system:overview:read",
    "system:module-registry:read",
    "system:raw-inspector:query",
    "system:audit:read",
    "system:integrations:read",
    "workbench:search",
  ],
};

const roles: WorkbenchRole[] = ["employee", "lifeguard", "supervisor", "system"];

const acceptedBackgroundPending = new Set([
  "auth",
  "bff-projections",
  "booking-snapshot",
  "campaigns-events",
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
    navigation.map((item) => item.id).join(",") === "employee-home,handover,activity-periods,employee-resources,employee-training,personal-note,knowledge-base-qna,checkins",
    `employee navigation mismatch: ${navigation.map((item) => item.id).join(",")}`,
  );
  assert(
    cards.map((item) => item.moduleId).join(",") === "employee-home,handover,activity-periods,employee-resources,employee-training,personal-note,knowledge-base-qna,shift-reminder,booking-snapshot,notification-center,weather-widget,registration-courses,checkins,search",
    `employee home cards mismatch: ${cards.map((item) => item.moduleId).join(",")}`,
  );
  navigation.forEach((item) => assert(cards.some((card) => card.moduleId === item.id), `employee nav module missing home card: ${item.id}`));
  ["booking-snapshot", "notification-center", "weather-widget", "registration-courses", "search"].forEach((id) =>
    assert(cards.some((card) => card.moduleId === id), `employee homepage-only module missing card: ${id}`),
  );
  sourceIncludes("server/modules/bff/routes.ts", "weatherCard", "employee home must expose a weather not_connected card");
  sourceIncludes("server/modules/bff/routes.ts", "bookingSnapshotCard", "employee home must expose a booking/course not_connected card");
  sourceIncludes("server/modules/bff/routes.ts", "storage.listKnowledgeBaseQna", "employee search must include Q&A rows");
  sourceMatches("client/src/modules/employee/training/page.tsx", /trackEvent\("TRAINING_VIEW"/, "training page must report TRAINING_VIEW");
};

const runSupervisorModuleTests = () => {
  const navigation = getNavigationModules("supervisor", rolePermissions.supervisor);
  const cards = getHomeLayoutCards("supervisor", rolePermissions.supervisor);
  const expected = ["supervisor-dashboard", "facilities", "tasks", "announcements", "handover", "employee-training", "anomalies", "analytics"];
  assert(navigation.map((item) => item.id).join(",") === expected.join(","), `supervisor navigation mismatch: ${navigation.map((item) => item.id).join(",")}`);
  expected.forEach((id) => assert(cards.some((item) => item.moduleId === id), `supervisor home card missing ${id}`));
  sourceIncludes("client/src/modules/supervisor/dashboard-page.tsx", "OnDutyDrawer", "dashboard must keep on-duty drawer");
  sourceIncludes("client/src/modules/supervisor/tasks/page.tsx", "supervisor-drawer", "tasks must use right drawer create flow");
  sourceIncludes("client/src/modules/supervisor/announcements/page.tsx", "手動發布公告", "announcements must support manual publish");
};

const runLifeguardModuleTests = () => {
  const navigation = getNavigationModules("lifeguard", rolePermissions.lifeguard);
  const cards = getHomeLayoutCards("lifeguard", rolePermissions.lifeguard);
  const expected = ["lifeguard-home", "lifeguard-log", "shift-reminder", "announcements", "handover", "personal-note", "knowledge-base-qna", "employee-training"];
  assert(navigation.map((item) => item.id).join(",") === expected.join(","), `lifeguard navigation mismatch: ${navigation.map((item) => item.id).join(",")}`);
  assert(cards.map((item) => item.moduleId).join(",") === "lifeguard-home,lifeguard-log,shift-reminder,announcements,handover,personal-note,knowledge-base-qna,employee-training,search", `lifeguard home cards mismatch: ${cards.map((item) => item.moduleId).join(",")}`);
  expected.forEach((id) => assert(cards.some((card) => card.moduleId === id), `lifeguard home card missing ${id}`));
  sourceIncludes("server/modules/auth/session-store.ts", '"lifeguard" as const', "lifeguard role must be added to grantedRoles");
  sourceIncludes("server/modules/auth/session-store.ts", 'activeRole: isSupervisor ? "supervisor" : isLifeguard ? "lifeguard" : "employee"', "lifeguard-only users must default to lifeguard active role");
  sourceIncludes("server/integrations/ragic/real-auth-adapter.ts", "isLifeguardTitle", "Ragic auth adapter must infer lifeguard role from title");
  sourceMatches("server/modules/bff/routes.ts", /app\.get\("\/api\/bff\/lifeguard\/home",\s*requireRole\("lifeguard",\s*"system"\)/, "lifeguard home BFF must require lifeguard or system role");
  sourceIncludes("client/src/App.tsx", "/lifeguard/log", "lifeguard log page must be routed");
  sourceIncludes("client/src/modules/lifeguard/log/page.tsx", "/api/work-logs/handover", "lifeguard log page must write via work-log endpoint");
  sourceIncludes("server/modules/work-logs/routes.ts", 'action: "LIFEGUARD_LOG_CREATED"', "lifeguard log create must write audit row");
  sourceIncludes("server/modules/work-logs/routes.ts", 'action: "LIFEGUARD_LOG_UPDATED"', "lifeguard log update must write audit row");
};

const runSystemModuleTests = () => {
  const navigation = getNavigationModules("system", rolePermissions.system);
  const expected = ["system-dashboard", "system-health", "system-observability", "integration-sync-jobs", "telemetry-audit", "raw-inspector", "employee-training"];
  assert(navigation.map((item) => item.id).join(",") === expected.join(","), `system navigation mismatch: ${navigation.map((item) => item.id).join(",")}`);
  const cards = getHomeLayoutCards("system", rolePermissions.system);
  expected.forEach((id) => assert(cards.some((card) => card.moduleId === id), `system home card missing ${id}`));
  assert(cards.some((card) => card.moduleId === "watchdog-events"), "system home cards must include watchdog events");
  const health = getModuleHealth("system", rolePermissions.system);
  assert(health.some((item) => item.moduleId === "raw-inspector"), "system health must include raw inspector");
  assert(health.some((item) => item.moduleId === "watchdog-events"), "system health must include watchdog events");
  sourceIncludes("shared/modules/types.ts", '"telemetry_pending"', "ModuleHealthDto must expose telemetry_pending");
  sourceIncludes("client/src/modules/system/dashboard-page.tsx", "Telemetry Pending", "system dashboard must show telemetry_pending separately");
};

const runRawInspectorTests = () => {
  assert(rawInspectorTargets.length === 8, "raw inspector target list changed without test update");
  rawInspectorTargets.forEach((target) => assert(isRawInspectorPath(target.path), `raw inspector target not allowed: ${target.path}`));
  assert(!isRawInspectorPath("https://example.com/api" as never), "raw inspector must reject absolute external URL");
  sourceMatches("server/modules/system/routes.ts", /app\.post\("\/api\/bff\/system\/raw-inspector",\s*requireSession,\s*requireRole\("system"\)/, "raw inspector endpoint must require system role");
  sourceIncludes("server/modules/system/routes.ts", "RAW_INSPECTOR_QUERY", "raw inspector must write audit action");
  sourceIncludes("client/src/modules/system/raw-inspector/api.ts", "/api/bff/system/raw-inspector", "client must use server-side raw inspector proxy");
};

const runTelemetryAuditTests = () => {
  sourceIncludes("server/modules/telemetry/repository.ts", "listAuditLogs", "telemetry repository must expose audit log listing");
  sourceMatches("server/modules/telemetry/routes.ts", /app\.get\("\/api\/audit\/logs",\s*requireSession,\s*requireRole\("system"\)/, "audit logs endpoint must require system role");
  sourceIncludes("client/src/modules/system/audit/page.tsx", "fetchAuditLogs", "system audit page must query audit logs");
};

const runRegistryGuardTests = () => {
  sourceMatches("server/modules/registry/moduleRegistryController.ts", /app\.get\("\/api\/system\/module-registry",\s*requireSession,\s*requireRole\("system"\),\s*requireSystemRegistryRead/, "raw module registry endpoint must be guarded");
  sourceIncludes("server/modules/auth/session-store.ts", "system:module-registry:read", "system sessions must include registry read permission");
  sourceIncludes("server/modules/auth/session-store.ts", "system:raw-inspector:query", "system sessions must include raw inspector permission");
};

const runPersonalNoteOwnerPolicyTests = () => {
  const rows = [
    { id: 1, category: "sticky_note", createdByEmployeeNumber: "A001" },
    { id: 2, category: "sticky_note", createdByEmployeeNumber: "B002" },
    { id: 3, category: "document", createdByEmployeeNumber: "B002" },
  ];
  const employeeA = filterEmployeeResourcesForCaller(rows, "A001").map((item) => item.id).join(",");
  const employeeB = filterEmployeeResourcesForCaller(rows, "B002").map((item) => item.id).join(",");
  assert(employeeA === "1,3", `employee A sticky-note visibility leaked: ${employeeA}`);
  assert(employeeB === "2,3", `employee B sticky-note visibility leaked: ${employeeB}`);
  assert(!canMutateEmployeeResource(rows[1], { employeeNumber: "A001", isSupervisor: true }), "supervisor must not mutate another user's sticky_note");
  assert(canMutateEmployeeResource(rows[0], { employeeNumber: "A001", isSupervisor: true }), "supervisor may mutate only their own sticky_note");
  sourceIncludes("server/storage.ts", "ownerEmployeeNumber", "employee resource storage must expose owner filter");
  sourceIncludes("server/routes.ts", "canMutateEmployeeResource(existing, caller)", "employee resource mutations must enforce sticky-note owner policy");
  sourceIncludes("client/src/modules/employee/personal-note/page.tsx", 'fetchEmployeeResources(facilityKey, "sticky_note"', "personal-note page must query owner-filtered sticky_note endpoint");
};

const runQnaReviewPolicyTests = () => {
  sourceIncludes("shared/schema.ts", 'reviewStatus: text("review_status").default("approved").notNull()', "Q&A schema must include review_status");
  sourceIncludes("migrations/0007_qna_supervisor_review.sql", "ADD COLUMN IF NOT EXISTS review_status", "Q&A review migration must add review_status");
  sourceIncludes("server/storage.ts", "viewerEmployeeNumber", "Q&A storage must support employee visibility filter");
  sourceIncludes("server/routes.ts", 'reviewStatus: "pending"', "employee-created Q&A must default to pending review");
  sourceIncludes("server/routes.ts", 'app.get("/api/bff/supervisor/qna-review"', "supervisor Q&A review BFF route must be registered");
  sourceIncludes("server/routes.ts", 'action: reviewStatus === "approved" ? "QNA_APPROVED" : "QNA_REJECTED"', "Q&A review must audit approve/reject actions");
  sourceIncludes("client/src/App.tsx", "/supervisor/qna-review", "supervisor Q&A review page must be routed");
  sourceIncludes("client/src/modules/supervisor/qna-review/page.tsx", "核准公開", "supervisor Q&A review page must expose approve action");
  sourceIncludes("client/src/modules/employee/qna/page.tsx", "reviewStatusLabel", "employee Q&A page must display review status badge");
};

const runNotConnectedUxTests = () => {
  sourceIncludes("client/src/components/shared/not-connected-card.tsx", "export function NotConnectedCard", "shared NotConnectedCard component must exist");
  sourceIncludes("client/src/components/shared/not-connected-card.tsx", "export function DegradedCard", "shared DegradedCard component must exist");
  sourceIncludes("client/src/components/shared/not-connected-card.tsx", "外部資料源待接通", "not_connected UX must explain external pending state");
  sourceIncludes("client/src/components/shared/not-connected-card.tsx", 'data-state={reason === "degraded" ? "degraded" : "not_connected"}', "not_connected UX must expose stable render state");
  sourceIncludes("client/src/modules/employee/home/employee-home-page.tsx", '<NotConnectedCard title="天氣卡片"', "weather widget must use NotConnectedCard");
  sourceIncludes("client/src/modules/employee/home/employee-home-page.tsx", '<DegradedCard title="今日班表"', "shift reminder must use DegradedCard when source is disconnected");
  sourceIncludes("client/src/modules/employee/more/page.tsx", "/employee/checkins", "checkins route must render a not_connected surface");
  sourceIncludes("client/src/modules/employee/more/page.tsx", "/employee/registration-courses", "registration-courses route must render a not_connected surface");
};

const runUnfinishedModulePolicyTests = () => {
  for (const role of roles) {
    const permissions = rolePermissions[role];
    const navigation = getNavigationModules(role, permissions);
    const cards = getHomeLayoutCards(role, permissions);
    const descriptors = getModuleDescriptorsByRole(role);
    const navIds = new Set(navigation.map((item) => item.id));
    const cardIds = new Set(cards.map((item) => item.moduleId));
    const nonReady = getModuleHealth(role, permissions).filter((item) => item.status !== "ready");

    for (const item of nonReady) {
      const descriptor = descriptors.find((module) => module.id === item.moduleId);
      assert(Boolean(descriptor), `${role} non-ready module lacks descriptor: ${item.moduleId}`);
      const isVisible = navIds.has(item.moduleId) || cardIds.has(item.moduleId);
      const isAcceptedBackground = acceptedBackgroundPending.has(item.moduleId) || descriptor?.stage === "disabled";
      assert(
        isVisible || isAcceptedBackground,
        `${role} non-ready module is neither visible nor policy-classified: ${item.moduleId}`,
      );
      if (cardIds.has(item.moduleId)) {
        const card = cards.find((entry) => entry.moduleId === item.moduleId)!;
        assert(card.status !== "error", `${role} card for ${item.moduleId} must not render as error by default`);
        assert(Boolean(card.sourceStatus.source), `${role} card for ${item.moduleId} must expose source status`);
      }
    }
  }
};

runEmployeeModuleTests();
runLifeguardModuleTests();
runSupervisorModuleTests();
runSystemModuleTests();
runRawInspectorTests();
runTelemetryAuditTests();
runRegistryGuardTests();
runPersonalNoteOwnerPolicyTests();
runQnaReviewPolicyTests();
runNotConnectedUxTests();
runUnfinishedModulePolicyTests();

console.log("Module unit tests passed");
console.log(`employee descriptors: ${getModuleDescriptorsByRole("employee").length}`);
console.log(`lifeguard descriptors: ${getModuleDescriptorsByRole("lifeguard").length}`);
console.log(`supervisor descriptors: ${getModuleDescriptorsByRole("supervisor").length}`);
console.log(`system descriptors: ${getModuleDescriptorsByRole("system").length}`);
