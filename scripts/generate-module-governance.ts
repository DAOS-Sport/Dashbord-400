import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MODULE_REGISTRY } from "../shared/modules/registry";
import type { AppRole } from "../shared/modules/types";

const roles: AppRole[] = ["employee", "lifeguard", "supervisor", "system", "SYSTEM_ADMIN"];

const statusIcon = (value: boolean) => value ? "✅" : "";

const moduleRows = MODULE_REGISTRY
  .map((module, index) => `| ${index + 1} | \`${module.id}\` | ${module.label} | ${module.status} | ${module.domainType} |`)
  .join("\n");

const matrixRows = MODULE_REGISTRY
  .map((module) => `| \`${module.id}\` | ${roles.map((role) => statusIcon(module.visibleRoles.includes(role))).join(" | ")} |`)
  .join("\n");

const content = `# Module Governance

Last generated: ${new Date().toISOString()}

## 治理原則

- Source of truth: code manifest in \`shared/modules/registry.ts\`.
- \`module_settings\` DB table is legacy/cache only; production navigation and permissions must not depend on it.
- Any module id, route, permission, visibility, or role exposure change must update the code manifest and rerun \`npm run docs:module-governance\`.
- DB governance can be reconsidered only after there is a migration plan, drift detector, rollback path, and ownership model.

## Canonical Module IDs

Total: ${MODULE_REGISTRY.length}

| # | id | label | status | domain |
|---|---|---|---|---|
${moduleRows}

## Role Permission Matrix

| module | ${roles.join(" | ")} |
|---|${roles.map(() => "---").join("|")}|
${matrixRows}

## 上線後遷移計畫

1. Keep code manifest authoritative through launch.
2. Treat \`module_settings\` as a read-through cache only after drift checks exist.
3. Add a DB-backed governance layer only when module ownership, approval workflow, rollback, and seed/migration ownership are explicit.
4. Before enabling DB governance, run a one-way reconciliation report from DB to code manifest and review every diff.
`;

const outputDir = join(process.cwd(), "docs", "governance");
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "module-governance.md"), content, "utf8");
console.log(`Generated docs/governance/module-governance.md from ${MODULE_REGISTRY.length} modules`);
