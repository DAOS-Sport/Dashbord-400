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
  getNavigationModules("employee").map((item) => item.id).join(",") === "employee-home,handover,activity-periods,employee-resources,personal-note,knowledge-base-qna,checkins",
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
assert(bffRoutes.includes("attachEmployeeHomeContract"), "/api/bff/employee/home does not attach stable home-card contract");
assert(bffRoutes.includes("/api/search/global"), "/api/search/global is not registered");
assert(bffRoutes.includes("/api/bff/system/dashboard"), "/api/bff/system/dashboard alias is not registered");
assert(bffRoutes.includes("/api/bff/employee/shifts/today"), "/api/bff/employee/shifts/today is not registered");
const handoverRoutes = readFileSync(join(repoRoot, "server", "modules", "handover", "index.ts"), "utf8");
assert(handoverRoutes.includes("/api/bff/employee/handover/summary"), "/api/bff/employee/handover/summary is not registered");
assert(handoverRoutes.includes("/api/handover/:id/complete"), "/api/handover/:id/complete is not registered");

console.log("Module smoke checks passed");
console.log(`descriptors: ${descriptors.length}`);
for (const role of roles) {
  const completed = getModuleHealth(role).filter((item) => item.status === "ready").length;
  const unfinished = getModuleHealth(role).filter((item) => item.status !== "ready").length;
  console.log(`${role}: navigation=${getNavigationModules(role).length}, cards=${getHomeLayoutCards(role).length}, ready=${completed}, unfinished=${unfinished}`);
}
