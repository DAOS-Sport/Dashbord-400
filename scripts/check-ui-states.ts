import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULE_REGISTRY, type ModuleDefinition } from "../shared/modules";

const repoRoot = process.cwd();

const hasBffBinding = (module: ModuleDefinition) =>
  Boolean(
    module.bff.employeeSectionKey ||
    module.bff.supervisorSectionKey ||
    module.bff.systemSectionKey ||
    module.bff.plannedEndpoints?.length,
  );

const stateTokens: Record<NonNullable<ModuleDefinition["bff"]["uiStates"]>[number], RegExp> = {
  loading: /isLoading|LoadingState|DreamLoader|載入|搜尋中/i,
  ready: /items\.length|data\?|return\s*\(|statusQuery|query\.data/i,
  empty: /EmptyState|尚無|沒有|目前沒有|length\s*===\s*0|!items\.length/i,
  error: /isError|ErrorState|無法|失敗|error/i,
  degraded: /DegradedState|degraded|降級|not_connected|unavailable|待接/i,
  unavailable: /unavailable|not_connected|無法|待接/i,
  disabled: /disabled=|aria-disabled|isPending|canSubmit/i,
  stale: /FreshnessIndicator|lastSync|lastSyncedAt|lastSyncAt|stale|上次更新|最後同步/i,
};

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const designSystemIndex = read("client/src/design-system/components/index.ts");
const missingContracts: string[] = [];
const checkedContracts: string[] = [];

for (const module of MODULE_REGISTRY.filter(hasBffBinding)) {
  const hasContract = Boolean(module.bff.uiStates?.length && module.bff.freshness);
  if (!hasContract) {
    missingContracts.push(module.id);
    continue;
  }

  assert(
    Boolean(module.bff.uiStateSourceFiles?.length),
    `${module.id}: bff.uiStateSourceFiles is required when uiStates/freshness are declared`,
  );

  const source = module.bff.uiStateSourceFiles!.map((file) => {
    assert(existsSync(join(repoRoot, file)), `${module.id}: uiStateSourceFile not found: ${file}`);
    return read(file);
  }).join("\n");

  for (const state of module.bff.uiStates ?? []) {
    assert(stateTokens[state].test(source), `${module.id}: cannot find UI evidence for state "${state}" in ${module.bff.uiStateSourceFiles!.join(", ")}`);
  }

  for (const component of module.bff.sharedComponents ?? []) {
    assert(designSystemIndex.includes(`./${component}`), `${module.id}: shared component ${component} is not exported from design-system/components`);
  }

  checkedContracts.push(module.id);
}

console.log("UI state contract check");
console.log("=======================");
console.log(`checked contracts: ${checkedContracts.join(", ") || "(none)"}`);
console.log(`missing contracts queued for cleanup-backlog: ${missingContracts.join(", ") || "(none)"}`);
