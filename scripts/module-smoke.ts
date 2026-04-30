import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  assertModuleRegistryValid,
  getHomeLayoutCards,
  getModuleDescriptors,
  getModuleHealth,
  getNavigationModules,
} from "../shared/modules";
import type { WorkbenchRole } from "../shared/auth/me";

const repoRoot = process.cwd();
const roles: WorkbenchRole[] = ["employee", "supervisor", "system"];

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const listFiles = (dir: string): string[] => {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (path.includes("node_modules") || path.includes(".git") || path.includes("dist")) continue;
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
  if (descriptor.defaultEnabled) assert(descriptor.roles.length > 0, `${descriptor.id} defaultEnabled but has no roles`);
  if (descriptor.navVisible) assert(Boolean(descriptor.routePath), `${descriptor.id} navVisible but has no routePath`);
}

for (const role of roles) {
  const navigation = getNavigationModules(role);
  const cards = getHomeLayoutCards(role);
  const health = getModuleHealth(role);
  assert(navigation.every((item) => ids.has(item.id)), `${role} navigation references an unknown module`);
  assert(cards.every((card) => ids.has(card.moduleId)), `${role} home-layout references an unknown module`);
  assert(health.every((item) => ids.has(item.moduleId)), `${role} health references an unknown module`);
  assert(cards.every((card) => ["ready", "empty", "not_connected", "incomplete", "error"].includes(card.status)), `${role} has invalid HomeCardDto status`);
  assert(cards.every((card) => ["bff-wired", "production-ready"].includes(getModuleDescriptors().find((item) => item.id === card.moduleId)?.stage ?? "")), `${role} home-layout exposes a module below bff-wired`);
}

assert(!getNavigationModules("employee").some((item) => item.routePath.startsWith("/system")), "employee can see a system route");
assert(!getNavigationModules("supervisor").some((item) => item.id === "raw-inspector"), "supervisor can see raw inspector");
assert(
  getNavigationModules("employee").map((item) => item.id).join(",") === "employee-home,handover,activity-periods,employee-resources,employee-training,personal-note,knowledge-base-qna",
  `employee navigation order changed: ${getNavigationModules("employee").map((item) => item.id).join(",")}`,
);

const clientFiles = listFiles(join(repoRoot, "client", "src")).filter((file) => /\.(ts|tsx)$/.test(file));
const localStorageViolations: string[] = [];
const externalFetchViolations: string[] = [];
const hardcodedNavigationViolations: string[] = [];

for (const file of clientFiles) {
  const text = readFileSync(file, "utf8");
  const rel = relative(repoRoot, file);
  const storageMatches = text.matchAll(/localStorage\.(?:setItem|getItem)\(["'`]([^"'`]+)["'`]/g);
  for (const match of storageMatches) {
    const key = match[1].toLowerCase();
    if (/(token|session|role|facility|auth|sid)/.test(key) && key !== "theme") {
      localStorageViolations.push(`${rel}: localStorage key ${match[1]}`);
    }
  }
  if (/fetch\(["'`]https?:\/\//.test(text) || /apiGet<.*>\(["'`]https?:\/\//.test(text)) {
    externalFetchViolations.push(rel);
  }
  if (
    rel.endsWith("modules\\employee\\employee-shell.tsx") ||
    rel.endsWith("modules\\employee\\home\\employee-home-page.tsx") ||
    rel.endsWith("modules\\workbench\\role-shell.tsx")
  ) {
    if (/const\s+(navItems|employeeNav|mobileNav|roleNav|roleMobileNav)\s*=/.test(text)) {
      hardcodedNavigationViolations.push(rel);
    }
  }
}

assert(localStorageViolations.length === 0, `localStorage authority violations:\n${localStorageViolations.join("\n")}`);
assert(externalFetchViolations.length === 0, `frontend direct external API calls:\n${externalFetchViolations.join("\n")}`);
assert(hardcodedNavigationViolations.length === 0, `hardcoded navigation module lists detected:\n${hardcodedNavigationViolations.join("\n")}`);

const bffRoutes = readFileSync(join(repoRoot, "server", "modules", "bff", "routes.ts"), "utf8");
const authSessionStore = readFileSync(join(repoRoot, "server", "modules", "auth", "session-store.ts"), "utf8");
const telemetryRepository = readFileSync(join(repoRoot, "server", "modules", "telemetry", "repository.ts"), "utf8");
const employeeTrainingPage = readFileSync(join(repoRoot, "client", "src", "modules", "employee", "training", "page.tsx"), "utf8");
const domainWriteMetadata = readFileSync(join(repoRoot, "server", "shared", "data", "write-metadata.ts"), "utf8");
const domainMetadataMigration = readFileSync(join(repoRoot, "migrations", "0003_domain_5w1h_metadata.sql"), "utf8");
const legacyRoutes = readFileSync(join(repoRoot, "server", "routes.ts"), "utf8");
const taskRoutes = readFileSync(join(repoRoot, "server", "modules", "tasks", "index.ts"), "utf8");
const storageSource = readFileSync(join(repoRoot, "server", "storage.ts"), "utf8");
assert(bffRoutes.includes("attachEmployeeHomeContract"), "/api/bff/employee/home does not attach stable home-card contract");
assert(bffRoutes.includes("/api/search/global"), "/api/search/global is not registered");
assert(bffRoutes.includes("/api/bff/system/dashboard"), "/api/bff/system/dashboard alias is not registered");
assert(bffRoutes.includes("/api/bff/employee/shifts/today"), "/api/bff/employee/shifts/today is not registered");
assert(/app\.get\("\/api\/bff\/employee\/home",\s*requireSession/.test(bffRoutes), "/api/bff/employee/home must require session");
assert(/app\.get\("\/api\/bff\/employee\/search",\s*requireSession/.test(bffRoutes), "/api/bff/employee/search must require session");
assert(/app\.get\("\/api\/search\/global",\s*requireSession/.test(bffRoutes), "/api/search/global must require session");
assert(/app\.get\("\/api\/bff\/supervisor\/dashboard",\s*requireRole\("supervisor",\s*"system"\)/.test(bffRoutes), "/api/bff/supervisor/dashboard must require supervisor or system role");
assert(!authSessionStore.includes("user.isSupervisor ?? true"), "Ragic auth mapping must not fail open to supervisor/system");
assert(authSessionStore.includes("user.isSupervisor === true"), "Ragic auth mapping must explicitly require isSupervisor === true");
assert(authSessionStore.includes('activeRole: isSupervisor ? "supervisor" : "employee"'), "Supervisor sessions must default to supervisor, not system");
assert(telemetryRepository.includes("createPostgresTelemetryRepository"), "createPostgresTelemetryRepository must exist");
assert(employeeTrainingPage.includes("resourceId: String(item.resourceId ?? item.id)"), "TRAINING_VIEW must send a stable string resourceId");
assert(telemetryRepository.includes('typeof value === "number"') && telemetryRepository.includes("return String(value)"), "training view report must normalize numeric payload ids");
assert(taskRoutes.includes("withTaskCreateMetadata"), "task create route must use task create metadata helper");
assert(taskRoutes.includes("assignedByUserId: manager"), "task supervisor assignment must record assignedByUserId");
assert(taskRoutes.includes("assignedAt: manager"), "task supervisor assignment must record assignedAt");
assert(/storage\.updateTask\(id,\s*withUpdateMetadata/.test(taskRoutes), "task update routes must use update metadata");
assert(domainWriteMetadata.includes("withCreateMetadata"), "domain write metadata helper must expose withCreateMetadata");
assert(domainWriteMetadata.includes("withEmployeeCreateMetadata"), "domain write metadata helper must expose employee resource create metadata");
assert(domainWriteMetadata.includes("withTaskCreateMetadata"), "domain write metadata helper must expose task create metadata");
assert(domainWriteMetadata.includes("withUpdateMetadata"), "domain write metadata helper must expose withUpdateMetadata");
assert(domainMetadataMigration.includes("ALTER TABLE quick_links"), "domain 5W1H migration must cover quick_links");
assert(domainMetadataMigration.includes("ALTER TABLE employee_resources"), "domain 5W1H migration must cover employee_resources");
assert(domainMetadataMigration.includes("ALTER TABLE operational_handovers"), "domain 5W1H migration must cover operational_handovers");
assert(legacyRoutes.includes("withCreateMetadata(parsed.data"), "quick_links create route must use create metadata");
assert(legacyRoutes.includes("withUpdateMetadata(parsed.data"), "quick_links update route must use update metadata");
assert(legacyRoutes.includes("withEmployeeCreateMetadata(parsed.data"), "employee_resources create route must use employee create metadata");
assert(legacyRoutes.includes("isPrivate: body.category === \"sticky_note\""), "sticky_note resources must default to private at create");
assert(/storage\.updateEmployeeResource\(id,\s*withUpdateMetadata/.test(legacyRoutes), "employee_resources update route must use update metadata");
assert(/storage\.createOperationalHandover\(withEmployeeCreateMetadata/.test(legacyRoutes), "operational_handovers create route must use employee create metadata");
assert(/app\.patch\("\/api\/portal\/operational-handovers\/:id",[\s\S]*storage\.updateOperationalHandover\(id,\s*withUpdateMetadata/.test(legacyRoutes), "operational_handovers supervisor update route must use update metadata");
assert(/app\.patch\("\/api\/portal\/operational-handovers\/:id\/report",[\s\S]*storage\.updateOperationalHandover\(id,\s*withUpdateMetadata/.test(legacyRoutes), "operational_handovers report route must use update metadata");
assert(/app\.post\("\/api\/portal\/handovers"[\s\S]*createdByRole: role/.test(legacyRoutes), "handover_entries create route must record createdByRole");
assert(/app\.post\("\/api\/portal\/handovers"[\s\S]*source: "manual"/.test(legacyRoutes), "handover_entries create route must record source");
assert(/storage\.createSystemAnnouncement\(withCreateMetadata/.test(legacyRoutes), "system_announcements create route must use create metadata");
assert(/storage\.updateSystemAnnouncement\(id,\s*withUpdateMetadata/.test(legacyRoutes), "system_announcements update route must use update metadata");
assert(/storage\.createAnomalyReport\([\s\S]*source: "external-checkin-system"/.test(legacyRoutes), "anomaly_reports create route must record external-checkin-system source");
assert(/const actor = anomalyResolutionActor\(req\);[\s\S]*storage\.updateAnomalyReportResolution\(id,\s*resolution,\s*resolvedNote \?\? null,\s*actor\)/.test(legacyRoutes), "anomaly_reports single resolution route must pass actor metadata");
assert(/const actor = anomalyResolutionActor\(req\);[\s\S]*storage\.batchUpdateResolution\(ids,\s*resolution,\s*resolvedNote \?\? null,\s*actor\)/.test(legacyRoutes), "anomaly_reports batch resolution route must pass actor metadata");
assert(storageSource.includes("resolvedBy: resolution === \"resolved\" ? actor?.userId ?? null : null"), "anomaly_reports resolution storage must record resolvedBy");
assert(storageSource.includes("updatedBy: actor?.userId ?? null"), "anomaly_reports resolution storage must record updatedBy");
assert(/storage\.createRecipient\(withCreateMetadata/.test(legacyRoutes), "notification_recipients create route must use create metadata");
assert(/storage\.updateRecipient\(id,\s*withUpdateMetadata/.test(legacyRoutes), "notification_recipients update route must use update metadata");
assert(legacyRoutes.includes("facilityKey: typeof facilityKey === \"string\""), "notification_recipients create route must accept facilityKey");
const handoverRoutes = readFileSync(join(repoRoot, "server", "modules", "handover", "index.ts"), "utf8");
assert(handoverRoutes.includes("/api/bff/employee/handover/summary"), "/api/bff/employee/handover/summary is not registered");
assert(handoverRoutes.includes("/api/handover/:id/complete"), "/api/handover/:id/complete is not registered");

const routeBlock = (source: string, route: string) => {
  const start = source.indexOf(route);
  assert(start >= 0, `${route} route block was not found`);
  const next = source.indexOf("\n  app.", start + route.length);
  return source.slice(start, next >= 0 ? next : source.length);
};

const assertAuditAction = (source: string, route: string, action: string) => {
  const block = routeBlock(source, route);
  assert(block.includes("recordAudit({"), `${route} must call recordAudit`);
  assert(block.includes(`action: "${action}"`), `${route} must audit ${action}`);
};

assertAuditAction(legacyRoutes, 'app.post("/api/portal/operational-handovers"', "OPERATIONAL_HANDOVER_CREATED");
assertAuditAction(legacyRoutes, 'app.patch("/api/portal/operational-handovers/:id"', "OPERATIONAL_HANDOVER_UPDATED");
assertAuditAction(legacyRoutes, 'app.patch("/api/portal/operational-handovers/:id/report"', "OPERATIONAL_HANDOVER_REPORTED");
assertAuditAction(legacyRoutes, 'app.post("/api/portal/quick-links"', "QUICK_LINK_CREATED");
assertAuditAction(legacyRoutes, 'app.patch("/api/portal/quick-links/:id"', "QUICK_LINK_UPDATED");
assertAuditAction(legacyRoutes, 'app.post("/api/portal/employee-resources"', "EMPLOYEE_RESOURCE_CREATED");
assertAuditAction(legacyRoutes, 'app.patch("/api/portal/employee-resources/:id"', "EMPLOYEE_RESOURCE_UPDATED");
assertAuditAction(legacyRoutes, 'app.post("/api/portal/system-announcements"', "SYSTEM_ANNOUNCEMENT_CREATED");
assertAuditAction(legacyRoutes, 'app.patch("/api/portal/system-announcements/:id"', "SYSTEM_ANNOUNCEMENT_UPDATED");
assertAuditAction(legacyRoutes, 'app.post("/api/portal/handovers"', "HANDOVER_ENTRY_CREATED");
assertAuditAction(legacyRoutes, 'app.post("/api/anomaly-report"', "ANOMALY_REPORTED");
assertAuditAction(legacyRoutes, 'app.patch("/api/anomaly-reports/:id/resolution"', "ANOMALY_RESOLVED");
assertAuditAction(legacyRoutes, 'app.patch("/api/anomaly-reports/batch/resolution"', "ANOMALY_RESOLVED");
assertAuditAction(legacyRoutes, 'app.post("/api/notification-recipients"', "NOTIFICATION_RECIPIENT_CREATED");
assertAuditAction(legacyRoutes, 'app.patch("/api/notification-recipients/:id"', "NOTIFICATION_RECIPIENT_UPDATED");
assertAuditAction(legacyRoutes, 'app.delete("/api/notification-recipients/:id"', "NOTIFICATION_RECIPIENT_DELETED");
assertAuditAction(taskRoutes, 'app.post("/api/tasks"', "TASK_CREATED");
assertAuditAction(taskRoutes, 'app.patch("/api/tasks/:id"', "TASK_UPDATED");
assertAuditAction(taskRoutes, 'app.patch("/api/tasks/:id/status"', "TASK_STATUS_UPDATED");

console.log("Module smoke checks passed");
console.log(`descriptors: ${descriptors.length}`);
for (const role of roles) {
  const completed = getModuleHealth(role).filter((item) => item.status === "ready").length;
  const unfinished = getModuleHealth(role).filter((item) => item.status !== "ready").length;
  console.log(`${role}: navigation=${getNavigationModules(role).length}, cards=${getHomeLayoutCards(role).length}, ready=${completed}, unfinished=${unfinished}`);
}
