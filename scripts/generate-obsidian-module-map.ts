import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  getModuleArchitectureCoverage,
  getModuleArchitectureGroups,
  getSuspiciousUnboundModules,
  MODULE_REGISTRY,
  moduleStatusLabels,
} from "../shared/modules";
import type { ModuleDefinition } from "../shared/modules";

const docsRoot = join(process.cwd(), "docs", "obsidian");
const modulesRoot = join(docsRoot, "modules");
const generatedDate = "2026-05-18";

const normalizeValue = (value: unknown) => String(value ?? "未登記");

const list = (items: string[], empty = "未登記") =>
  items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;

const table = (headers: string[], rows: string[][], empty: string) => {
  if (rows.length === 0) return `_${empty}_`;
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  return [header, divider, ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\n/g, "<br>")).join(" | ")} |`)].join("\n");
};

const increment = <T extends string>(map: Map<T, number>, key: T) => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const statusLabel = (status: ModuleDefinition["status"]) => `${status} / ${moduleStatusLabels[status] ?? status}`;

const inferRagicDatabase = (module: ModuleDefinition) => {
  const ragic = module.integrations.filter((integration) => integration.provider === "RAGIC");
  if (ragic.length === 0) return `不使用 Ragic；資料源為 ${module.sourceOfTruth}`;
  return ragic.map((integration) => `RAGIC：${integration.purpose}`).join("；");
};

const inferPurpose = (module: ModuleDefinition) => `${module.description} 狀態：${statusLabel(module.status)}。`;

const ownerRole = (module: ModuleDefinition) =>
  module.governance.ownerRole ?? module.visibleRoles[0] ?? "未登記";

const writeMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const getModuleLogicFlow = (module: ModuleDefinition) => {
  const reads = module.apis.filter((api) => api.method === "GET");
  const writes = module.apis.filter((api) => writeMethods.has(api.method));
  const routes = module.routes.filter((route) => route.kind !== "api");
  const providers = module.integrations.map((integration) => integration.provider);
  const tables = module.data.map((data) => data.table ?? data.entity).filter(Boolean);

  return [
    routes.length
      ? `入口從 ${routes.map((route) => `\`${route.path}\``).join("、")} 進入，依角色 ${module.visibleRoles.join("、")} 顯示。`
      : "沒有獨立前端入口；由 BFF、背景工作或其他模組引用。",
    reads.length
      ? `讀取透過 ${reads.map((api) => `\`${api.method} ${api.path}\``).join("、")}。`
      : "沒有登記讀取 API；資料多半由其他 projection 或背景流程提供。",
    writes.length
      ? `寫入透過 ${writes.map((api) => `\`${api.method} ${api.path}\``).join("、")}。`
      : "目前沒有登記寫入 API；視為 read-only、external、planned 或 legacy surface。",
    providers.length
      ? `外部或基礎依賴：${Array.from(new Set(providers)).join("、")}。`
      : "沒有登記外部 provider。",
    tables.length
      ? `資料落點 / entity：${Array.from(new Set(tables)).map((item) => `\`${item}\``).join("、")}。`
      : "沒有登記資料表或 entity。",
  ];
};

const getDataWritingPolicy = (module: ModuleDefinition) => {
  const writeApis = module.apis.filter((api) => writeMethods.has(api.method));
  const postgresData = module.data.filter((data) => data.source === "postgres");
  const externalData = module.data.filter((data) => data.source === "external");
  const telemetryData = module.data.filter((data) => data.source === "telemetry");
  const projectionData = module.data.filter((data) => data.source === "projection");

  const policies = [
    `資料權威：\`${module.sourceOfTruth}\`。`,
    postgresData.length
      ? `Postgres 寫入需通過 server module / storage layer，不應在前端直接寫表：${postgresData.map((data) => `\`${data.table ?? data.entity}\``).join("、")}。`
      : "沒有 Postgres 寫入權威登記。",
    projectionData.length
      ? `Projection 資料只能由 BFF / sync job 重建或更新，頁面不得自行當作權威：${projectionData.map((data) => `\`${data.table ?? data.entity}\``).join("、")}。`
      : "沒有 projection 資料登記。",
    telemetryData.length
      ? `Telemetry / audit 資料採 append-only 或事件式寫入，避免覆寫歷史：${telemetryData.map((data) => `\`${data.table ?? data.entity}\``).join("、")}。`
      : "沒有 telemetry 資料登記。",
    externalData.length
      ? `External 資料需經 adapter/proxy 正規化後進 BFF，不把外部 payload 直接暴露成 UI contract。`
      : "沒有 external data binding。",
    writeApis.length
      ? `寫入 API 需保留權限檢查、審計或狀態切換語意：${writeApis.map((api) => `\`${api.method} ${api.path}\``).join("、")}。`
      : "沒有寫入 API；新增寫入前必須先補 module intake governance 三欄。",
  ];

  return policies;
};

const getSurfaceModel = (module: ModuleDefinition) => {
  if (module.visibility.includes("homepage_widget")) return "home-card / dashboard widget";
  if (module.visibility.includes("admin_page")) return "admin management surface";
  if (module.visibility.includes("portal_page")) return "legacy portal surface";
  if (module.visibility.includes("detail_page")) return "role detail page";
  if (module.visibility.includes("system_only")) return "system governance surface";
  if (module.visibility.includes("background_only")) return "background service";
  return "unclassified surface";
};

const getUiDensity = (module: ModuleDefinition) => {
  if (module.visibleRoles.includes("employee") || module.visibleRoles.includes("lifeguard")) {
    return "mobile-first、touch target 優先、資訊分段顯示";
  }
  if (module.visibleRoles.includes("supervisor")) {
    return "營運掃描密度、表格/列表可比較、批次操作需明確狀態";
  }
  if (module.visibleRoles.includes("system") || module.visibleRoles.includes("SYSTEM_ADMIN")) {
    return "IT governance density、狀態/錯誤可掃描、避免裝飾性版面";
  }
  return "依 consuming shell 決定密度";
};

const getUiUxLogic = (module: ModuleDefinition) => {
  const writeApis = module.apis.filter((api) => writeMethods.has(api.method));
  const bffBindings = bffRows(module);
  const telemetrySignals = [
    module.telemetry.trackPageView ? "page view" : "",
    module.telemetry.trackCardClick ? "card click" : "",
    module.telemetry.trackActionSubmit ? "action submit" : "",
    module.telemetry.auditRequired ? "audit required" : "",
  ].filter(Boolean);

  return [
    `Surface model：${getSurfaceModel(module)}；UI density：${getUiDensity(module)}。`,
    module.homepageWidget
      ? "首頁卡片需支援 ready / empty / stale / degraded / unavailable 狀態，不用顏色作為唯一提示。"
      : "非首頁卡片模組仍需在進入頁保留 loading、empty、error 與權限不足狀態。",
    module.bff.uiStates?.length
      ? `Registry uiStates：${module.bff.uiStates.map((state) => `\`${state}\``).join("、")}；freshness=\`${module.bff.freshness ?? "未登記"}\`。`
      : "尚未登記 uiStates / freshness；此缺口會由 `npm run check:ui-states` 列入 cleanup-backlog。",
    module.bff.sharedComponents?.length
      ? `跨 section 視覺最小單元：${module.bff.sharedComponents.map((component) => `\`${component}\``).join("、")}。`
      : "尚未登記 shared component；若同 DTO 被多個 section 使用，Phase A 必須抽 shared visual unit。",
    bffBindings.length
      ? `畫面資料應優先吃 BFF section / endpoint：${bffBindings.map(([, value]) => `\`${value}\``).join("、")}。`
      : "沒有 BFF binding 時，UI 不應直接新增外部 fetch；先補 BFF contract 或標成 legacy/background。",
    writeApis.length
      ? "有寫入操作；按鈕需具備 loading/disabled/error feedback，成功後需刷新對應 query 或 section。"
      : "目前 read-only 或背景型；若新增互動寫入，先補 registry API、BFF contract、audit/telemetry。",
    telemetrySignals.length
      ? `UI telemetry：${telemetrySignals.join("、")}。`
      : "未登記 UI telemetry；新增互動前需判斷是否需要 page/action/card 事件。",
  ];
};

const getBffReferencePolicy = (module: ModuleDefinition) => {
  const bffApis = module.apis.filter((api) => api.kind === "bff");
  const crudApis = module.apis.filter((api) => api.kind === "crud");
  const proxyApis = module.apis.filter((api) => api.kind === "proxy" || api.kind === "external");
  const bffBindings = bffRows(module);

  return [
    bffApis.length
      ? `BFF endpoint owner：${bffApis.map((api) => `\`${api.method} ${api.path}\``).join("、")}。`
      : "沒有 BFF endpoint owner；若 UI 需要新資料，優先新增 BFF 讀取端點而非 page-local fetch。",
    bffBindings.length
      ? `Section key / planned endpoint：${bffBindings.map(([kind, value]) => `${kind}=\`${value}\``).join("、")}。`
      : "沒有 section key；若要進首頁或 dashboard，需要先補 section key / planned endpoint。",
    crudApis.length
      ? `寫入後 BFF 需要刷新或重算的 CRUD endpoint：${crudApis.map((api) => `\`${api.method} ${api.path}\``).join("、")}。`
      : "沒有 CRUD endpoint；BFF 可視為 read-only projection 或外部相容層。",
    proxyApis.length
      ? `Proxy / external 邊界：${proxyApis.map((api) => `\`${api.method} ${api.path}\``).join("、")}；前端不得繞過此邊界。`
      : "沒有 proxy / external API 邊界。",
    `修改此模組時同步檢查：module registry、BFF DTO、role shell / route、query invalidation、telemetry/audit、[[../bff-reference-map|BFF Reference Map]]、[[../bff-technical-spec|BFF 技術規範]]。`,
  ];
};

const getChangeChecklist = (module: ModuleDefinition) => [
  `UI：確認 ${getSurfaceModel(module)} 的 loading / empty / degraded / error / disabled 狀態。`,
  "BFF：新增或調整欄位時，先改 server DTO / shared domain type，再改 page mapping。",
  module.data.length
    ? `資料：確認 ${module.data.map((data) => `\`${data.table ?? data.entity}\``).join("、")} 的讀寫方向沒有繞過 owner module。`
    : "資料：目前沒有登記 data binding；新增資料前先補 registry。",
  module.integrations.length
    ? `整合：確認 ${Array.from(new Set(module.integrations.map((integration) => integration.provider))).join("、")} 的 fallback / unavailable 狀態有對應 UI。`
    : "整合：沒有外部依賴，避免新增 page-local external fetch。",
  "文件：改動後重跑 `npm run docs:obsidian`，讓本頁、BFF Reference Map 與 BFF 技術規範同步。",
];

const implementationOwners = (module: ModuleDefinition) => {
  if (module.id === "linebot-management") {
    return [
      "UI owner：`client/src/modules/system/linebot-management/page.tsx`。",
      "BFF route owner：`server/modules/system/linebot-management-routes.ts`；此模組只做 read-only normalized DTO，不對 400LINE 執行寫入。",
      "DTO owner：`shared/system/linebot-management-contract.ts`；狀態固定為 `ready | degraded | waiting_for_400line_api | error`。",
      "Data authority：400LINE / LINE Bot Assistant；400QIAN 只保留 shadow/snapshot 與 diff。",
      "Registry owner：`shared/modules/registry/foundation.ts`、`shared/navigation/workbench-routes.ts`、`shared/modules/descriptors.ts`。",
    ];
  }
  if (module.id === "linebot-integration") {
    return [
      "System LINE Bot BFF route owner：`server/modules/system/line-bot-routes.ts`。",
      "Legacy announcement/facility LINE proxy owners remain in their existing route modules until the adapter migration is completed.",
      "Registry owner：`shared/modules/registry/portal-integrations.ts`。",
    ];
  }
  if (module.id === "helper-status") {
    return [
      "UI owner：`client/src/modules/system/helper-status/page.tsx`。",
      "BFF route owner：`server/modules/system/helper-status-routes.ts`；不得再把 400 小幫手狀態端點加回 `server/modules/system/routes.ts`。",
      "Catalog / DTO owner：`shared/system/helper-status.ts`；只可輸出 configured / missing 狀態，不得輸出 secret value。",
      "Authenticated BFF smoke：`scripts/authenticated-bff-smoke.ts` 必須覆蓋 anonymous 401、non-system 403、system 200。",
      "Registry owner：`shared/modules/registry/foundation.ts`。",
    ];
  }
  if (module.id === "system-operations") {
    return [
      "UI owner：`client/src/modules/system/operations/page.tsx`。",
      "BFF route owner：`server/modules/system/operations-routes.ts`；user lookup、user detail、soft intervention、recent assists 都集中於此檔。",
      "資料來源：`users`、`sessions_index`、`user_role_snapshots`、telemetry audit / client error repositories。",
      "寫入治理：POST 類介入必須保留 reason >= 3、audit、system target guard，不得在 smoke test 執行破壞性操作。",
      "Authenticated BFF smoke：`scripts/authenticated-bff-smoke.ts` read-only 覆蓋 `/api/bff/system/operations/recent-assists`。",
      "Registry owner：`shared/modules/registry/foundation.ts`。",
    ];
  }
  if (module.id !== "line-whitelist") return [];
  return [
    "UI owner：`client/src/modules/system/line-whitelist/page.tsx`、`client/src/modules/system/line-whitelist/api.ts`。",
    "BFF route owner：`server/modules/system/line-whitelist-routes.ts`；不得再把白名單 CRUD 加回 `server/modules/system/routes.ts`。",
    "慎用 / 面試權限 owner：`server/modules/system/caution-permissions-routes.ts`；授權期限、狀態切換、audit 都集中在此檔。",
    "400LINE 服務狀態 / proxy owner：`server/modules/system/line-bot-routes.ts`；前端不得直接呼叫 400LINE upstream。",
    "Domain service / DTO owner：`server/modules/system/line-whitelist-service.ts`、`shared/system/line-whitelist-contract.ts`。",
    "Registry owner：`shared/modules/registry/foundation.ts`、`shared/modules/descriptors.ts`。",
  ];
};

const routeRows = (module: ModuleDefinition) =>
  module.routes.map((route) => [
    route.path,
    route.role ?? "-",
    route.kind,
    route.status,
  ]);

const apiRows = (module: ModuleDefinition) =>
  module.apis.map((api) => [
    api.method,
    api.path,
    api.kind,
    api.status,
  ]);

const dataRows = (module: ModuleDefinition) =>
  module.data.map((data) => [
    data.table ?? data.entity ?? "-",
    data.entity ?? "-",
    data.source,
    data.status,
    data.notes ?? "",
  ]);

const integrationRows = (module: ModuleDefinition) =>
  module.integrations.map((integration) => [
    integration.provider,
    integration.purpose,
    integration.status,
    integration.notes ?? "",
  ]);

const bffRows = (module: ModuleDefinition) => {
  const rows: string[][] = [];
  if (module.bff.employeeSectionKey) rows.push(["employeeSectionKey", module.bff.employeeSectionKey]);
  if (module.bff.supervisorSectionKey) rows.push(["supervisorSectionKey", module.bff.supervisorSectionKey]);
  if (module.bff.systemSectionKey) rows.push(["systemSectionKey", module.bff.systemSectionKey]);
  for (const endpoint of module.bff.plannedEndpoints ?? []) rows.push(["plannedEndpoint", endpoint]);
  return rows;
};

const hasBffBinding = (module: ModuleDefinition) => bffRows(module).length > 0;

const uiContractRows = (module: ModuleDefinition) => [
  ["uiStates", module.bff.uiStates?.join(", ") ?? "未登記"],
  ["freshness", module.bff.freshness ?? "未登記"],
  ["uiStateSourceFiles", module.bff.uiStateSourceFiles?.map((file) => `\`${file}\``).join("<br>") ?? "未登記"],
  ["sharedComponents", module.bff.sharedComponents?.map((component) => `\`${component}\``).join(", ") ?? "未登記"],
];

const modulesMissingUiStateContract = () =>
  MODULE_REGISTRY.filter((module) => hasBffBinding(module) && !(module.bff.uiStates?.length && module.bff.freshness));

const walkSourceFiles = (dir: string): string[] => {
  const fullDir = join(process.cwd(), dir);
  return readdirSync(fullDir).flatMap((entry) => {
    const full = join(fullDir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walkSourceFiles(relative(process.cwd(), full));
    return /\.(tsx|ts)$/.test(entry) ? [full] : [];
  });
};

const hardcodedTitleCandidates = () => {
  const labels = new Set(MODULE_REGISTRY.map((module) => module.label));
  const rows: string[][] = [];
  const h1Pattern = /<h1[^>]*>([\s\S]*?)<\/h1>/g;
  for (const file of ["client/src/modules", "client/src/pages"].flatMap(walkSourceFiles)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(h1Pattern)) {
      const text = match[1]
        .replace(/<[^>]*>/g, "")
        .replace(/\{[^}]*\}/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (text && !labels.has(text)) rows.push([`\`${relative(process.cwd(), file)}\``, text, "改成 registry displayName / route manifest 或明確標為例外。"]);
    }
  }
  return rows;
};

const partialCategory = (module: ModuleDefinition) => {
  if (module.status !== "partial") return "";
  if (hasBffBinding(module) && module.routes.length > 0) return "能上線";
  if (module.visibility.includes("background_only") || module.domainType === "integration") return "上線後補";
  return "砍掉重練 / sunset 候選";
};

const partialGap = (module: ModuleDefinition) => {
  const gaps = [
    !hasBffBinding(module) ? "缺 BFF / section contract" : "",
    !(module.bff.uiStates?.length && module.bff.freshness) ? "缺 uiStates / freshness" : "",
    module.apis.some((api) => api.status === "legacy" || api.kind === "proxy") ? "仍依賴 legacy/proxy endpoint" : "",
    module.data.some((data) => data.status === "planned" || data.status === "partial") ? "資料層仍 partial/planned" : "",
    module.routes.some((route) => route.status === "partial" || route.kind === "legacy_admin" || route.kind === "legacy_portal") ? "路由仍 partial/legacy" : "",
  ].filter(Boolean);
  return gaps.join("；") || "只剩文件/治理狀態需收斂";
};

const modulePage = (module: ModuleDefinition) => `---
module_id: ${module.id}
label: ${JSON.stringify(module.label)}
status: ${module.status}
domain: ${module.domainType}
owner_role: ${ownerRole(module)}
source_of_truth: ${module.sourceOfTruth}
generated_at: ${generatedDate}
---

# ${module.label}

[[../00-index|模組總覽]] / [[../shared-surfaces|共用區塊]] / [[../bff-reference-map|BFF Reference Map]] / [[../bff-technical-spec|BFF 技術規範]] / [[../cleanup-backlog|清洗 backlog]]

## Module Intake Governance

1. 角色：${ownerRole(module)}；可見角色 ${module.visibleRoles.join(", ")}
2. RAGIC / 資料庫：${inferRagicDatabase(module)}
3. 功能 / 需求 / 用途：${inferPurpose(module)}

## Registry Snapshot

- Module ID: \`${module.id}\`
- Status: ${statusLabel(module.status)}
- Domain: \`${module.domainType}\`
- Source of truth: \`${module.sourceOfTruth}\`
- Homepage widget: ${module.homepageWidget ? "yes" : "no"}
- Visibility: ${module.visibility.join(", ") || "未登記"}
- Priority: ${JSON.stringify(module.priority)}

${implementationOwners(module).length ? `## Implementation Owners\n\n${list(implementationOwners(module))}\n` : ""}

## 功能邏輯

${list(getModuleLogicFlow(module))}

## 資料寫法 / 寫入規則

${list(getDataWritingPolicy(module))}

## UI/UX 邏輯

${list(getUiUxLogic(module))}

## BFF 參照 / 修改關聯

${list(getBffReferencePolicy(module))}

## 修改檢查清單

${list(getChangeChecklist(module))}

## Routes

${table(["Path", "Role", "Kind", "Status"], routeRows(module), "沒有 route 綁定")}

## API / BFF

${table(["Method", "Path", "Kind", "Status"], apiRows(module), "沒有 API 綁定")}

### BFF Sections

${table(["Binding", "Value"], bffRows(module), "沒有 BFF section 綁定")}

### UI State Contract

${table(["Field", "Value"], uiContractRows(module), "沒有 UI state contract")}

## Data

${table(["Table / Entity", "Entity", "Source", "Status", "Notes"], dataRows(module), "沒有資料表或資料源綁定")}

## Integrations

${table(["Provider", "Purpose", "Status", "Notes"], integrationRows(module), "沒有外部整合綁定")}

## Telemetry / Governance

- Telemetry: pageView=${module.telemetry.trackPageView ? "yes" : "no"}；cardClick=${module.telemetry.trackCardClick ? "yes" : "no"}；actionSubmit=${module.telemetry.trackActionSubmit ? "yes" : "no"}；auditRequired=${module.telemetry.auditRequired ? "yes" : "no"}
- Event types: ${(module.telemetry.eventTypes ?? []).join(", ") || "未登記"}
- Editable by: ${module.governance.editableBy.join(", ") || "未登記"}
- Readonly for: ${module.governance.readonlyFor.join(", ") || "未登記"}
- Requires approval: ${module.governance.requiresApproval ? "yes" : "no"}
- Governance notes: ${module.governance.notes ?? "未登記"}

## Legacy

- Old names: ${(module.legacy?.oldNames ?? []).join(", ") || "無"}
- Old routes: ${(module.legacy?.oldRoutes ?? []).join(", ") || "無"}
- Migration notes: ${module.legacy?.migrationNotes ?? "無"}
`;

const indexPage = () => {
  const statusCounts = new Map<ModuleDefinition["status"], number>();
  const domainCounts = new Map<ModuleDefinition["domainType"], number>();
  const sourceCounts = new Map<ModuleDefinition["sourceOfTruth"], number>();
  for (const module of MODULE_REGISTRY) {
    increment(statusCounts, module.status);
    increment(domainCounts, module.domainType);
    increment(sourceCounts, module.sourceOfTruth);
  }

  const coverage = getModuleArchitectureCoverage();
  const groups = getModuleArchitectureGroups();
  const suspicious = getSuspiciousUnboundModules();

  const scoreItems = [
    ["Current architecture score", "80 / 100"],
    ["Registered modules", String(MODULE_REGISTRY.length)],
    ["Architecture grouped modules", `${coverage.groupedModules} / ${coverage.totalModules}`],
    ["Suspicious unbound modules", suspicious.length === 0 ? "0" : suspicious.map((module) => module.id).join(", ")],
    ["Generated date", generatedDate],
  ];

  const statusRows = Array.from(statusCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([status, count]) => [status, String(count)]);
  const domainRows = Array.from(domainCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([domain, count]) => [domain, String(count)]);
  const sourceRows = Array.from(sourceCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([source, count]) => [source, String(count)]);

  const groupSections = groups.map((group) => {
    const rows = group.modules.map((module) => [
      `[[modules/${module.id}|${module.id}]]`,
      module.label,
      module.status,
      module.roles.join(", "),
      module.entryMode,
      module.hasBff ? "yes" : "no",
    ]);
    return `## ${group.title}

${group.description}

${table(["Module", "Label", "Status", "Roles", "Entry", "BFF"], rows, "沒有模組")}`;
  });

  return `# 400QIAN 模組治理索引

這份資料是從 \`shared/modules\` registry 產生的 Obsidian-style 模組知識庫。它的用途是讓每個功能都能回到三個治理欄位：角色、RAGIC / 資料庫、功能 / 需求 / 用途。

快速入口：[[shared-surfaces|共用區塊]] / [[bff-reference-map|BFF Reference Map]] / [[bff-technical-spec|BFF 技術規範]] / [[400line-management-blueprint|400LINE 管理藍圖]] / [[400line-api-readiness|400LINE API Readiness]] / [[system-modules-disambiguation|System Modules Disambiguation]] / [[partial-implementation-audit|Partial Implementation Audit]] / [[cleanup-backlog|Cleanup Backlog]]

## Scorecard

${table(["Item", "Value"], scoreItems, "沒有評分資料")}

## Cleaning Progress

- Phase 1: 建立 \`docs/obsidian\` 與 module intake governance 欄位。
- Phase 1: 對齊 App runtime route 與 governance gate，移除獨立 \`/system/topology\` route drift。
- Phase 1: 補齊 type-check / smoke gate 的扣分項，並保留拆檔 backlog。
- Phase 1: 模組頁已補上功能邏輯與資料寫法 / 寫入規則。
- Phase 1: 模組頁已補上 UI/UX 邏輯、BFF 參照 / 修改關聯，並建立 [[bff-reference-map]]。
- Phase 1: 建立 [[bff-technical-spec]]，供人類與 LLM 修改 BFF / DTO / UI 時遵循。
- Phase 1: 建立 [[system-modules-disambiguation]] 與 [[partial-implementation-audit]]，處理模組命名 overlap 與 partial 過多問題。
- Next: 依 domain ownership 拆大檔，先從 employee home、system routes、storage、schema 的穩定邊界開始。

## Counts

### Status

${table(["Status", "Count"], statusRows, "沒有狀態統計")}

### Domain

${table(["Domain", "Count"], domainRows, "沒有 domain 統計")}

### Source Of Truth

${table(["Source", "Count"], sourceRows, "沒有資料源統計")}

${groupSections.join("\n\n")}
`;
};

const sharedSurfacesPage = () => {
  const providerCounts = new Map<string, number>();
  const tableOwners = new Map<string, string[]>();
  const apiOwners = new Map<string, string[]>();
  const bffOwners: string[][] = [];

  for (const module of MODULE_REGISTRY) {
    for (const integration of module.integrations) increment(providerCounts, integration.provider);
    for (const data of module.data) {
      const key = data.table ?? data.entity;
      if (!key) continue;
      tableOwners.set(key, [...(tableOwners.get(key) ?? []), module.id]);
    }
    for (const api of module.apis) {
      const key = `${api.method} ${api.path}`;
      apiOwners.set(key, [...(apiOwners.get(key) ?? []), module.id]);
    }
    if (module.bff.employeeSectionKey) bffOwners.push([module.id, "employee", module.bff.employeeSectionKey]);
    if (module.bff.supervisorSectionKey) bffOwners.push([module.id, "supervisor", module.bff.supervisorSectionKey]);
    if (module.bff.systemSectionKey) bffOwners.push([module.id, "system", module.bff.systemSectionKey]);
    for (const endpoint of module.bff.plannedEndpoints ?? []) bffOwners.push([module.id, "endpoint", endpoint]);
  }

  const providerRows = Array.from(providerCounts.entries()).sort((a, b) => b[1] - a[1]).map(([provider, count]) => [provider, String(count)]);
  const sharedTables = Array.from(tableOwners.entries())
    .filter(([, owners]) => owners.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, owners]) => [name, owners.map((owner) => `[[modules/${owner}|${owner}]]`).join(", ")]);
  const sharedApis = Array.from(apiOwners.entries())
    .filter(([, owners]) => owners.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, owners]) => [name, owners.map((owner) => `[[modules/${owner}|${owner}]]`).join(", ")]);

  return `# Shared Surfaces

[[00-index|模組總覽]] / [[bff-reference-map|BFF Reference Map]] / [[bff-technical-spec|BFF 技術規範]] / [[cleanup-backlog|清洗 backlog]]

## Stable Shared Blocks

- Module registry: \`shared/modules/registry.ts\`
- Workbench route manifest: \`shared/navigation/workbench-routes.ts\`
- Module descriptors and navigation DTOs: \`shared/modules/descriptors.ts\`
- Shared UI state components: \`client/src/design-system/components/EmptyState.tsx\`, \`LoadingState.tsx\`, \`ErrorState.tsx\`, \`DegradedState.tsx\`, \`FreshnessIndicator.tsx\`
- Shared visual units for DTO reuse: \`AnnouncementCard.tsx\`, \`TaskRow.tsx\`, \`DenseRow.tsx\`
- BFF route layer: \`server/modules/bff/*\`
- System governance UI: \`client/src/modules/system/governance/page.tsx\`
- System helper status BFF owner: \`server/modules/system/helper-status-routes.ts\`
- 400LINE management BFF owner: \`server/modules/system/linebot-management-routes.ts\`
- System operations BFF owner: \`server/modules/system/operations-routes.ts\`
- Authenticated BFF smoke template: \`scripts/authenticated-bff-smoke.ts\`
- LINE whitelist contract/UI/BFF: \`shared/system/line-whitelist-contract.ts\`, \`client/src/modules/system/line-whitelist/*\`, \`server/modules/system/line-whitelist-routes.ts\`, \`server/modules/system/caution-permissions-routes.ts\`, \`server/modules/system/line-bot-routes.ts\`, and \`server/modules/system/line-whitelist-service.ts\`
- Schema and persistence: \`shared/schema.ts\`, \`server/storage.ts\`

## Integration Provider Counts

${table(["Provider", "Registered Uses"], providerRows, "沒有外部整合")}

## Shared Tables / Entities

${table(["Table / Entity", "Module Owners"], sharedTables, "目前沒有多模組共用資料表")}

## Shared API Paths

${table(["API", "Module Owners"], sharedApis, "目前沒有多模組共用 API")}

## BFF Sections And Endpoints

${table(["Module", "Surface", "Binding"], bffOwners.map(([moduleId, surface, binding]) => [`[[modules/${moduleId}|${moduleId}]]`, surface, binding]), "沒有 BFF 綁定")}

## Extraction Candidates

- Route helper and redirect policy should stay centralized in \`shared/navigation/workbench-routes.ts\`.
- Status DTOs should stay under shared module/BFF contracts before page components consume them.
- Service health and watchdog DTOs should be read-only projections, not page-local fetch fan-out.
- Ragic candidate lookup should become one adapter contract before more whitelist-like modules are added.
- LINE Bot proxy calls should remain behind server endpoints; frontend should not call external hosts directly.
- Dashboard cards should be registry/BFF-driven so employee, supervisor, and system shells do not hardcode module lists.
`;
};

const bffReferenceMapPage = () => {
  const bffRowsByModule: string[][] = [];
  const endpointRows: string[][] = [];
  const routeRows: string[][] = [];

  for (const module of MODULE_REGISTRY) {
    const moduleLink = `[[modules/${module.id}|${module.id}]]`;
    const bindings = bffRows(module);
    if (bindings.length) {
      bffRowsByModule.push([
        moduleLink,
        module.label,
        bindings.map(([kind, value]) => `${kind}: \`${value}\``).join("<br>"),
        module.visibleRoles.join(", "),
        getSurfaceModel(module),
      ]);
    }

    for (const api of module.apis.filter((item) => item.kind === "bff")) {
      endpointRows.push([
        `\`${api.method} ${api.path}\``,
        moduleLink,
        api.status,
        bindings.map(([, value]) => `\`${value}\``).join("<br>") || "-",
        module.data.map((data) => `\`${data.table ?? data.entity}\``).join("<br>") || "-",
      ]);
    }

    for (const route of module.routes.filter((item) => item.kind !== "api")) {
      routeRows.push([
        `\`${route.path}\``,
        route.role ?? "-",
        moduleLink,
        route.status,
        bindings.map(([, value]) => `\`${value}\``).join("<br>") || "-",
      ]);
    }
  }

  return `# BFF Reference Map

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[bff-technical-spec|BFF 技術規範]] / [[cleanup-backlog|清洗 backlog]]

這張表是給修改 BFF / DTO / UI section 時反查影響範圍用。規則是：任何 UI 新欄位先回到 BFF contract；任何 BFF 新資料先回到 module registry；任何寫入都要看資料權威、query refresh、telemetry/audit。具體寫法見 [[bff-technical-spec]]。

## BFF Change Rules

- UI 不直接呼叫外部服務；外部資料先進 server adapter / BFF，再轉成 shared domain DTO。
- BFF section 必須能表達 ready / empty / degraded / unavailable；頁面只渲染狀態，不自行判斷外部服務細節。
- 新增欄位時同步更新 shared domain type、server mapper、page component、module page。
- 寫入 API 完成後要定義 query invalidation / projection refresh / audit event，不只回傳 success。
- 系統頁與白名單頁維持高資訊密度，避免把治理工具做成 landing page 或展示型版面。

## Module BFF Bindings

${table(["Module", "Label", "Binding", "Roles", "UI Surface"], bffRowsByModule, "沒有 BFF binding")}

## BFF Endpoints

${table(["Endpoint", "Module", "Status", "Section / Binding", "Data Touchpoints"], endpointRows, "沒有 BFF endpoint")}

## Route To BFF Reference

${table(["Route", "Role", "Module", "Status", "BFF Binding"], routeRows, "沒有 route")}
`;
};

const bffTechnicalSpecPage = () => `# BFF 技術規範

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[bff-reference-map|BFF Reference Map]] / [[cleanup-backlog|清洗 backlog]]

這份規範給人類與 LLM 共用。任何 BFF、DTO、UI section、模組 registry 的改寫都必須照這份順序做，避免把資料流重新散回 page-local fetch、legacy route 或未註冊端點。

## 0. Non-Negotiable Rules

- 任何新功能先回答三欄：角色、RAGIC / 資料庫、功能 / 需求 / 用途。
- UI 不直接呼叫外部服務；外部服務一律經 server adapter / BFF 正規化。
- BFF 是頁面 contract，不是資料庫 schema；前端只依 DTO 與 section status render。
- 寫入不可只回 \`success: true\`；必須定義 query invalidation、projection refresh、audit / telemetry。
- 新 route、新 API、新資料表、新 integration 都必須回填 \`shared/modules\` registry，並重跑 \`npm run docs:obsidian\`。
- 不把 secret、token、connection string、private payload 寫進 docs、fixture、console log 或 response body。

## 1. Layer Ownership

| Layer | Owner | Can Do | Must Not Do |
| --- | --- | --- | --- |
| UI Page / Component | \`client/src/modules/**\` | Render BFF DTO, handle interaction state, invalidate queries after writes | Direct external fetch, direct DB model assumption, secret handling |
| Shared DTO / Domain | \`shared/domain/**\`, \`shared/bff/**\` | Define stable frontend-facing contracts | Leak raw DB rows or external provider payloads |
| BFF Route | \`server/modules/bff/**\` or owning server module | Compose data for one role/page/workflow | Mix unrelated domains into one endpoint without registry owner |
| Adapter / Integration | \`server/integrations/**\`, owning integration module | Normalize external service failures and payloads | Let provider-specific shape reach UI directly |
| Storage / Repository | \`server/storage.ts\`, domain repository | Read/write Postgres with domain semantics | Be called from frontend or expose table rows as UI contract |
| Registry / Docs | \`shared/modules/**\`, \`docs/obsidian/**\` | Declare module ownership, routes, APIs, data, BFF, UX logic | Drift from actual mounted routes or endpoints |

## 2. Endpoint Design

- Use resource-oriented REST names: \`GET /api/bff/{role}/{surface}\`, \`POST /api/{domain}/{resource}\`, \`PATCH /api/{domain}/{resource}/:id\`.
- \`GET\` is read-only and idempotent. Do not mutate cache, audit state, or permissions from \`GET\` except read telemetry when explicitly registered.
- \`POST\` creates or performs a command with a new record / audit trail.
- \`PATCH\` updates a subset or status transition.
- \`DELETE\` is only allowed for reversible or truly disposable records. For whitelist / permission modules, prefer status disable or expiry over deletion.
- BFF endpoints should be role or surface scoped, not generic all-purpose aggregators.
- Legacy endpoints can remain, but they must be marked \`legacy\` in registry and routed through a canonical module.

## 3. BFF Section Envelope

All page sections should use the shared envelope shape from \`shared/bff/envelope.ts\`:

| Field | Meaning |
| --- | --- |
| \`status\` | \`ok\`, \`stale\`, \`unavailable\`, or \`degraded\` |
| \`data\` | The DTO payload or \`null\` when unavailable |
| \`meta.lastSyncAt\` | Last trusted source timestamp |
| \`meta.errorCode\` | Machine-readable fallback / failure code |
| \`meta.fallbackReason\` | Human-readable reason suitable for operator UI |

Status rules:

- \`ok\`: source is connected and payload is current.
- \`stale\`: cached or old projection is shown; UI should show a quiet stale marker.
- \`degraded\`: partial data is shown; UI should show which source is unavailable when useful.
- \`unavailable\`: no usable data; UI should render empty/error state without crashing.

## 4. DTO Shape Rules

- DTO names describe UI meaning, not table names: \`AnnouncementSummary\`, \`HomeCardDto\`, \`ModuleHealthDto\`.
- Optional fields should be optional only when UI can render without them.
- Dates crossing the BFF boundary should be ISO strings or already formatted labels, never raw \`Date\` objects.
- IDs must be stable across refresh. For merged sources, prefix IDs by source: \`line-\`, \`portal-\`, \`employee-\`.
- Mappers live next to the BFF/domain service that owns the contract.
- Do not pass raw Ragic, LINE, CWA, Gemini, OpenAI, Google Apps Script, or Smart Schedule payloads to UI.

## 4a. Cross-Section Visual Consistency

- 同一 DTO 在不同 section 使用時，視覺最小單元必須來自同一個 shared component。
- 公告卡片統一用 \`AnnouncementCard\`；任務列表列統一用 \`TaskRow\`；IT 狀態列統一用 \`DenseRow\`。
- Page layer 不得重新實作同一 entity 的 badge hierarchy、title/summary/body layout、primary/secondary action order。
- Registry \`bff.sharedComponents\` 必須列出此 section 使用的 shared visual unit；尚未導入者進 [[cleanup-backlog]]。
- Phase A 元件抽取時先抽 shared visual unit，再替換 employee / supervisor / system 頁面，不反向從頁面複製樣式。

## 5. Read Flow

1. Resolve role and active facility/session.
2. Read canonical local data from storage/repository.
3. Read external data through adapter / integration service.
4. Normalize each source into shared DTOs.
5. Merge, de-dupe, sort, and apply overlays in the BFF service.
6. Return \`BffSection<T>\` or page DTO with section envelopes.
7. Register the endpoint and section key in the module registry.
8. Re-generate \`docs/obsidian\`.

## 6. Write Flow

1. Validate request body with schema / explicit parser.
2. Authorize role and facility scope.
3. Execute domain command through owning server module.
4. Persist only through storage/repository or owning service.
5. Append audit / telemetry when the action changes permission, state, or external visibility.
6. Return updated DTO or minimal command result with affected IDs.
7. Invalidate frontend query / refresh BFF section.
8. Update registry and module page if new API, table, event, or behavior exists.

## 6a. Audit Envelope

任何改變 permission、狀態、外部可見性、通知送出、資料刪除/停用的寫入都必須寫 audit envelope。

| Field | Required | Meaning |
| --- | --- | --- |
| \`who.actorId\` | yes | Current session user id. |
| \`who.role\` | yes | Current active role. |
| \`who.facilityKey\` | when scoped | Active or target facility key. |
| \`when.occurredAt\` | yes | ISO timestamp generated server-side. |
| \`action\` | yes | Stable machine action, e.g. \`OPS_REFRESH_CACHE\`. |
| \`resource.type\` | yes | Domain resource name, e.g. \`system.operations\`. |
| \`resource.id\` | when available | Target id. |
| \`before\` | for update/delete | Minimal safe snapshot before change; no secrets. |
| \`after\` | for update/create | Minimal safe snapshot after change; no secrets. |
| \`reason\` | for operator commands | Human reason, min length defined by command schema. |
| \`result.status\` | yes | \`pending\`, \`success\`, \`partial\`, or \`failed\`. |

Current storage target is telemetry/audit repository or \`audit_logs\` equivalent. If a module cannot write audit yet, registry \`telemetry.auditRequired=true\` plus cleanup-backlog entry is mandatory.

## 7. Auth, Role, And Facility Scope

- Employee UI can only receive employee-safe DTO fields.
- Supervisor endpoints can include operational summaries, but not system-only secrets or raw integration payloads.
- System endpoints can show configured/missing status, never secret values.
- \`SYSTEM_ADMIN\` actions should be explicit in registry \`editableBy\` and audit-required when permission-affecting.
- Facility-scoped data must normalize \`facilityKey\` once at the BFF/service boundary.
- Every new authenticated BFF owner needs either a live \`smoke:auth-bff\` read-only case or a static unit guard explaining why live smoke is unsafe.
- Auth smoke minimum is anonymous \`401\`, wrong role \`403\`, owning role \`200\`; destructive POST endpoints stay static/unit-tested unless a safe fixture exists.

## 8. External Source Rules

| Provider | Required BFF Behavior |
| --- | --- |
| RAGIC | Map candidate identity fields explicitly: name, userId / lineUserId, phone, department, source table. |
| LINE_BOT_ASSISTANT | Proxy through server; expose access status and normalized message/whitelist DTOs only. |
| SMART_SCHEDULE_MANAGER | Treat as external schedule source; cache or mark unavailable when disconnected. |
| CWA | Cache weather and degrade quietly when key/API is missing. |
| Gmail / Google / AI providers | Never expose raw error body or token; map to operator-safe status. |
| POSTGRES / NEON | Storage/repository owns writes; BFF owns UI projection shape. |

## 9. UI/UX Contract For BFF Consumers

- Every BFF-backed UI section must render loading, ready, empty, degraded, unavailable, and disabled states.
- Buttons that trigger writes need loading and disabled states until the mutation settles.
- Error feedback appears near the affected control or section, not only as a global toast.
- Required states are not prose-only: registry \`bff.uiStates\` must enumerate the exact states and \`npm run check:ui-states\` must find source evidence.
- Freshness is not page-defined: registry \`bff.freshness\` declares \`realtime\`, \`5min\`, \`1hour\`, \`daily\`, or \`manual\`; UI should render \`FreshnessIndicator\` when last sync is visible.
- Empty / loading / error / degraded states should come from shared design-system components: \`EmptyState\`, \`LoadingState\`, \`ErrorState\`, \`DegradedState\`.
- Page title text should come from module registry display labels or route manifest; hardcoded corrupted titles are blocked by \`npm run check:title-binding\`.
- Visual density budgets: employee/lifeguard cards should generally be >= 96px tall touch-friendly cards; supervisor rows/panels should balance scan and action density; IT dense rows should generally stay <= 48px unless expanded.
- System/IT screens should be dense and scannable: status chips, tables, filters, and action controls over decorative cards.
- Employee/lifeguard screens should be mobile-first with clear touch targets and no hidden hover-only actions.
- Do not make BFF-backed operational tools into landing pages.

## 10. Registry Requirements

Every BFF-affecting change must update the owning module page source in \`shared/modules\`:

- \`routes\`: mounted UI route or legacy route.
- \`apis\`: BFF / CRUD / proxy / telemetry endpoint.
- \`data\`: table, entity, source, status.
- \`integrations\`: provider, purpose, status.
- \`bff\`: section key and planned endpoints.
- \`telemetry\`: page/action/card/audit event expectations.
- \`governance\`: owner role, editable roles, readonly roles, approval rule.

## 11. LLM Change Protocol

When an LLM modifies BFF or UI, it should follow this exact checklist:

1. Find the module page in \`docs/obsidian/modules\`.
2. Read [[bff-reference-map]] for endpoint and section ownership.
3. Confirm the three intake fields: role, RAGIC / database, purpose.
4. Patch shared DTO / mapper before patching UI.
5. Keep external calls server-side.
6. Update registry if route/API/data/integration/telemetry changes.
7. Run \`npm run docs:obsidian\`.
8. Run gates: \`npm run check:modules\`, \`npm run check:workbench-governance\`, \`npm run check:ui-states\`, \`npm run check:title-binding\`, \`npm run smoke:modules\`, \`npm run smoke:auth-bff\`, \`npm run type-check\`, \`npm run build\`.
9. Report remaining warnings in [[cleanup-backlog]] instead of hiding them.

## 12. Required Gates

| Gate | Purpose |
| --- | --- |
| \`npm run docs:obsidian\` | Regenerate module docs, BFF map, and this governance set. |
| \`npm run check:modules\` | Validate registry coverage and module status. |
| \`npm run check:workbench-governance\` | Catch route / registry / governance drift. |
| \`npm run check:ui-states\` | Verify registry uiStates/freshness and source evidence for adopted BFF sections. |
| \`npm run check:title-binding\` | Block corrupted title text and list hardcoded h1 candidates for cleanup. |
| \`npm run smoke:modules\` | Catch UI/BFF contract regressions. |
| \`npm run smoke:auth-bff\` | Catch authenticated BFF 401 / 403 / 200 regressions without touching production data. |
| \`npm run type-check\` | Catch DTO and TypeScript contract drift. |
| \`npm run build\` | Catch production bundling/runtime compile issues. |
`;

const systemModulesDisambiguationPage = () => {
  const rows = [
    ["system-control-center", "IT 首頁 / 快速入口", "只聚合 KPI 與入口 tile；不得承載深層操作流程。", "system-dashboard"],
    ["system-dashboard", "Legacy system overview", "保留相容入口；新功能不得加在此模組。", "system-control-center"],
    ["system-watchdog", "服務健康檢視", "呈現 module health、external integration、watchdog 狀態。", "helper-status / watchdog-events"],
    ["watchdog-events", "外部事件 ingestion source", "只代表事件資料來源；UI 統一由 system-watchdog 消費。", "system-watchdog"],
    ["linebot-management", "400LINE 集中入口", "集中看 400LINE 服務、群組/館別、白名單 snapshot、重要公告管線與 API readiness；read-only shell。", "system-watchdog / helper-status"],
    ["helper-status", "400LINE 服務監控舊頁", "只看 400LINE 連接服務、secret configured/missing、heartbeat/snapshot；後續收斂為 linebot-management 子頁。", "system-watchdog"],
    ["system-operations", "IT 人員協助 / soft intervention", "查人、reset session、refresh cache、resend notification；必須 audit。", "system-control-center"],
    ["system-insights", "行為數據洞察", "讀 telemetry 行為趨勢、completion rate、role/facility/time trend。", "analytics"],
    ["system-governance", "治理 / registry / audit raw hub", "模組 registry、function relations、audit raw、topology notes 的收斂頁。", "system-function-relations"],
    ["system-function-relations", "Legacy function relations tab source", "只能作為 governance tab 的舊資料來源；不得新增獨立 route。", "system-governance"],
    ["system-observability", "Legacy observability tab source", "只能作為 Watchdog/Governance 的舊入口來源。", "system-watchdog"],
    ["analytics", "Supervisor/admin legacy analytics", "主管營運報表與舊 admin analytics。", "portal-analytics / system-insights"],
    ["portal-analytics", "Portal usage analytics", "Portal event/facility usage reporting。", "analytics"],
    ["announcements", "員工可見公告 feed", "員工首頁/公告列表顯示 LINE group + local system announcements。", "announcement-review / announcement-groups"],
    ["announcement-groups", "場館 LINE 群組綁定", "管理 facility -> LINE group binding，不負責審核公告內容。", "announcements"],
    ["announcement-review", "LINE candidate 審核", "主管審核 LINE Bot 候選公告 approve/reject。", "announcements"],
    ["announcement-summary", "公告統計 / 週報", "看 summary/report，不負責公告 CRUD。", "announcements"],
    ["system-announcements", "本地系統公告 CRUD", "主管維護本地 notices，員工端消費。", "announcements"],
    ["lifeguard-log", "救生員日誌與填報", "第一線 lifeguard 作業輸入與日報。", "facilities"],
    ["facilities", "主管場館狀態", "主管觀察單館櫃台交辦與救生功能模組狀態，不做第一線填報。", "lifeguard-log"],
  ];

  return `# System Modules Disambiguation

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[cleanup-backlog|清洗 backlog]]

這頁專門處理 system / analytics / announcements / lifeguard 相關命名 overlap。未來新增 IT 模組前，先確認是否應該掛在下列表格的既有 owner。

${table(["Module", "Responsibility", "Boundary", "Do Not Confuse With"], rows, "沒有辨析資料")}

## Rules

- 新 IT page 預設先掛到 \`system-governance\` tab 或 \`system-watchdog\` tab，除非有獨立 BFF owner。
- 400CMS 監控看 \`system-control-center\` / \`system-watchdog\` / \`system-governance\`；400LINE 外部服務看 \`linebot-management\`。
- 服務健康看 \`system-watchdog\`；400LINE 服務細節先看 \`linebot-management\`，舊細節頁保留在 \`helper-status\`；事件 ingestion 看 \`watchdog-events\`。
- 公告顯示看 \`announcements\`；群組綁定看 \`announcement-groups\`；審核看 \`announcement-review\`；統計看 \`announcement-summary\`。
- 行為數據看 \`system-insights\`；主管營運報表保留在 \`analytics\`；portal usage 看 \`portal-analytics\`。
`;
};

const partialImplementationAuditPage = () => {
  const rows = MODULE_REGISTRY
    .filter((module) => module.status === "partial")
    .map((module) => [
      `[[modules/${module.id}|${module.id}]]`,
      module.visibleRoles.join(", "),
      partialCategory(module),
      partialGap(module),
    ]);

  return `# Partial Implementation Audit

[[00-index|模組總覽]] / [[cleanup-backlog|清洗 backlog]]

Partial 只能表示核心可用但有缺角；若長期不補，就要改成 legacy / deprecated / planned。這頁把 32 個 partial 分成「能上線」「上線後補」「砍掉重練 / sunset 候選」三類。

${table(["Module", "Roles", "Category", "Gap To Implemented"], rows, "沒有 partial 模組")}
`;
};

const cleanupBacklogPage = () => {
  const uiStateGaps = modulesMissingUiStateContract().map((module) => [
    `[[modules/${module.id}|${module.id}]]`,
    module.visibleRoles.join(", "),
    bffRows(module).map(([kind, value]) => `${kind}: \`${value}\``).join("<br>"),
    "補 `bff.uiStates`、`bff.freshness`、`bff.uiStateSourceFiles`；若同 DTO 跨 section，補 `bff.sharedComponents`。",
  ]);
  const partialRows = MODULE_REGISTRY
    .filter((module) => module.status === "partial")
    .map((module) => [
      `[[modules/${module.id}|${module.id}]]`,
      partialCategory(module),
      partialGap(module),
      module.governance.notes ?? "",
    ]);
  const redFlagRows = [
    ["portal-manage", "partial + no BFF", "Legacy entry still exists without BFF section contract; keep only as compatibility or add sunset date."],
    ["gmail-integration", "partial + no BFF + system visible", "System-visible integration must be read through BFF or explicitly background-only."],
    ["legacy-users", "legacy + no BFF", "Compatibility layer needs sunset rule or explicit background-only classification."],
    ["widget-layout-settings", "deprecated/legacy + no BFF", "Deprecated registry entry should keep sunset notes and must not gain new UI flows."],
  ];
  const titleRows = hardcodedTitleCandidates();

  return `# Cleanup Backlog

[[00-index|模組總覽]] / [[shared-surfaces|共用區塊]] / [[bff-reference-map|BFF Reference Map]] / [[bff-technical-spec|BFF 技術規範]]

這裡只記錄需要最後集中處理的功能與行為問題。本階段不混入產品行為精修。

## Fixed In This Pass

| Area | Evidence | Resolution |
| --- | --- | --- |
| TypeScript gate | \`npm run type-check\` previously failed in employee home section timestamps, announcement widget cache iteration, employee home enrichment nullable type, and registry provider typing. | Replaced page timestamp reads with \`section.meta.lastSyncAt\`, made cache invalidation iteration target-safe, normalized nullable source errors, and registered \`CWA\` as an integration provider. |
| Employee announcement smoke | \`npm run smoke:modules\` previously failed the employee BFF announcement merge assertion. | Employee home enrichment now merges LINE group announcements, employee resource announcements, portal/system announcements, and candidate important announcements before overlay, de-dupe, and sort. |
| Runtime topology drift | Governance previously found \`/system/topology\` mounted as an unregistered independent runtime route. | Removed the independent App route and routed the legacy path to \`/system/governance\`. |
| BFF technical governance | BFF rules previously lived only in scattered implementation/tests. | Added [[bff-technical-spec]] and linked it from module pages and [[bff-reference-map]]. |
| System BFF owner split | \`server/modules/system/routes.ts\` still owned helper status and operations endpoints after 400LINE extraction. | Split helper status into \`helper-status-routes.ts\`, operations into \`operations-routes.ts\`, and added \`npm run smoke:auth-bff\` for authenticated read-only BFF coverage. |
| UI state governance | Section 9 UI/UX rules were prose-only and not auditable. | Added registry \`bff.uiStates\` / \`bff.freshness\`, shared UI state components, \`npm run check:ui-states\`, and \`npm run check:title-binding\`. |

## Must Fix Before Structural Split

| Area | Evidence | Intended Fix |
| --- | --- | --- |
| Large shared persistence/schema files | \`server/storage.ts\` and \`shared/schema.ts\` are > 1.5k lines each. | Split by domain ownership after type-check baseline is stable. |

## High Priority Red Flags

${table(["Module", "Flag", "Required Decision"], redFlagRows, "目前沒有高優先紅旗")}

## BFF UI State Contract Gaps

These modules have BFF bindings but do not yet declare auditable \`uiStates\` and \`freshness\`. \`npm run check:ui-states\` reports this list without failing so the migration can proceed module by module.

${table(["Module", "Roles", "BFF Binding", "Required Fix"], uiStateGaps, "所有 BFF 模組都已登記 UI state contract")}

## Partial Module Readiness

${table(["Module", "Category", "Gap To Implemented", "Governance Notes"], partialRows, "沒有 partial 模組")}

## Title Binding Candidates

\`npm run check:title-binding\` blocks corrupted title text and lists hardcoded \`<h1>\` candidates. These need to be moved to module registry display names or explicitly marked as non-module pages.

${table(["File", "Current h1", "Required Fix"], titleRows, "沒有 hardcoded h1 候選")}

## Should Fix Soon

| Area | Evidence | Intended Fix |
| --- | --- | --- |
| Work-item retirement deploy | \`migrations/0014_retire_tasks_personal_note.sql\` drops the legacy \`tasks\` table and deletes \`employee_resources.category='sticky_note'\`; \`scripts/post-merge.sh\` applies it through \`scripts/apply-db-retirement-migrations.cjs\`. | On Replit deploy, verify postMerge sees \`NEON_DATABASE_URL\` or \`DATABASE_URL\`, then confirm \`tasks\` table is gone and no sticky-note rows remain. |
| Employee home file size | \`client/src/modules/employee/home/employee-home-page.tsx\` is > 2k lines and owns UI, DTO mapping, state, and fallback rendering. | Extract stable sections into domain files without changing layout behavior. |
| System route file size | \`server/modules/system/routes.ts\` still owns control center, watchdog, integration overview, insights, schedule snapshot, and internal webhook endpoints. | Continue with governance, watchdog, insights, schedule snapshot, and internal webhook route extraction by module. |
| Governance docs drift | Older governance docs still name removed observer modules such as \`system-topology\`. | Point those references to \`system-governance\` tabs or archive them. |
| Ragic candidate adapter | Whitelist candidate lookup and future modules need consistent Ragic field mapping. | Create a shared Ragic candidate adapter contract: name, lineUserId, phone, department, source table. |
| LINE 400 feature authorization | UI currently manages feature switches, but external 400LINE sync needs a single clear contract. | Document and validate the internal API payload before touching production secrets. |
| Build warnings | Production build still reports stale Browserslist data, a PostCSS \`from\` warning, and large JS chunk warning. | Separate maintenance pass: update browserslist DB, identify PostCSS plugin source, then code-split large route bundles. |

## Nice To Have

| Area | Evidence | Intended Fix |
| --- | --- | --- |
| Obsidian doc regeneration | \`npm run docs:obsidian\` now regenerates the module knowledge base. | Add it to release checklist after it stabilizes. |
| Route inventory depth | Current docs are registry-derived; raw Express/frontend route inventory is still separate. | Add route scanners that emit orphan route candidates into this backlog. |
| Module intake skill | Future modules must answer role, Ragic/database, and purpose. | Promote the three-field rule into Replit/Codex governance docs after first cleanup batch. |
`;
};

const linebotApiReadinessPage = () => `# 400LINE API Readiness

[[00-index|模組總覽]] / [[400line-management-blueprint|400LINE 管理藍圖]] / [[modules/linebot-management|linebot-management]]

這頁定義 400QIAN 對 400LINE API 的讀取狀態。前端不得直接呼叫 400LINE；一律經過 \`/api/bff/system/linebot-management/*\` 正規化。

## Status Contract

| Status | Meaning | UI Behavior |
| --- | --- | --- |
| \`ready\` | 回 JSON 且可被 BFF 正規化。 | 顯示資料與最後同步時間。 |
| \`degraded\` | API 可到但資料缺角、HTTP 非 2xx 或 fallback 使用中。 | 顯示降級原因，不阻塞其他 tabs。 |
| \`waiting_for_400line_api\` | 端點已規劃但目前回 HTML、缺 JSON、缺 token 或尚未修復。 | 顯示等待修復，不爆頁。 |
| \`error\` | 連線失敗或 BFF 無法解析。 | 顯示錯誤 state，保留其他可用區塊。 |

## Current Endpoint Map

| Endpoint | Owner | Current Use | Expected Status |
| --- | --- | --- | --- |
| \`GET /api/admin/announcements/health\` | 400LINE | 重要公告管線健康。 | \`ready\` if JSON |
| \`GET /api/facility-home/list\` | 400LINE | 群組 / 館別清單。 | \`ready\` if JSON |
| \`GET /api/internal/facility-home/:groupId/home\` | 400LINE | 單一館別首頁狀態。 | \`waiting_for_400line_api\` until stable sampling is wired |
| \`GET /api/admin/interview-users\` | 400LINE | 面試 / 慎用授權主控名單。 | \`ready\` if JSON |
| \`GET /api/internal/service-health\` | 400LINE | 服務健康總覽。 | \`waiting_for_400line_api\` until JSON/token contract is stable |
| \`GET /api/internal/service-health/snapshots\` | 400LINE | 服務健康歷史快照。 | \`waiting_for_400line_api\` until JSON/token contract is stable |
| \`GET /api/admin/service-status\` | 400LINE | Admin 服務監控。 | \`waiting_for_400line_api\` if current endpoint still returns HTML |
| \`GET /api/admin/whitelist\` | 400LINE | 公告 VIP 白名單。 | \`waiting_for_400line_api\` until final API shape is confirmed |
| \`GET /api/internal/announcement-whitelist\` | 400LINE | Internal 公告 VIP 白名單。 | \`waiting_for_400line_api\` until final API shape is confirmed |

## Rules

- BFF must redact secrets and reduce credential state to readiness only.
- Read-only shell endpoints can call 400LINE GET endpoints; write actions stay in dedicated whitelist flows.
- Broken 400LINE endpoints must return \`waiting_for_400line_api\`, not throw a page-level crash.
- New 400LINE endpoint intake must answer role, Ragic/data source, and purpose before registration.
`;

const linebotManagementBlueprintPage = () => `# 400LINE Management Blueprint

[[00-index|模組總覽]] / [[400line-api-readiness|400LINE API Readiness]] / [[modules/linebot-management|linebot-management]]

## Domain Split

| Domain | Scope | Source of Truth | Purpose |
| --- | --- | --- | --- |
| 400CMS | 400QIAN CMS, BFF, module registry, audit, telemetry, local UI health. | 400QIAN repo / CMS DB / module registry / telemetry. | 監控 CMS 本體是否健康、模組是否完整、IT 操作是否有紀錄。 |
| 400LINE | 400LINE / LINE Bot Assistant / LINE 官方帳號 / Ragic 授權資料 / 公告管線。 | 400LINE API / LINE Bot DB / Ragic H01/H02 / 400QIAN shadow snapshot. | 監控 LINE Bot 服務、白名單、群組/館別與重要公告資料流。 |

## Navigation

- 400CMS：控制中心、Watchdog、運維協助、行為洞察、治理面。
- 400LINE：400LINE 管理、服務監控、白名單。
- \`/system/lineXBS-status\` and \`/system/line-whitelist\` remain compatible routes and can become tab deep-links later.

## 400LINE Management Tabs

| Tab | Purpose | BFF |
| --- | --- | --- |
| 總覽 | 整體狀態、可用 API、等待修復 API、最後同步時間。 | \`GET /api/bff/system/linebot-management/overview\` |
| 服務監控 | LINE Messaging API、公告管線、Gemini/OpenAI、Ragic、CWA、Webhook、DB。 | \`GET /api/bff/system/linebot-management/services\` |
| 群組 / 館別 | \`/api/facility-home/list\` 與 groupId 狀態。 | \`GET /api/bff/system/linebot-management/facilities\` |
| 白名單 / 權限 | 面試、慎用、人員查詢、VIP 公告授權 snapshot 與 diff。 | \`GET /api/bff/system/linebot-management/whitelist-snapshot\` |
| 重要公告管線 | 5 層篩選機制、候選數、今日處理量、員工端進入規則。 | \`GET /api/bff/system/linebot-management/announcement-pipeline\` |
| API Readiness | 可用、回 HTML、等待 400LINE 修復的端點清單。 | Aggregated from all management BFF endpoints |

## Whitelist Rules

- 400LINE is the authority.
- 400QIAN keeps shadow/snapshot for diff: only in 400LINE, only in 400QIAN shadow, and status mismatch.
- Ragic lookup order: H01 first, H02 fallback.
- Existing authorized users are never deleted in CMS product behavior; disable or expiry revokes access.

## Announcement Entry Rule

Employee important group announcements may include high-confidence candidates when:

- \`priority = must_read | high\`
- \`confidence >= 0.85\`
- facility/group scope matches
- local displayable filter passes

Employee UI must label source as 已發布, 高信心候選, or 等待審核.
`;

const main = async () => {
  await mkdir(docsRoot, { recursive: true });
  await rm(modulesRoot, { recursive: true, force: true });
  await mkdir(modulesRoot, { recursive: true });

  await writeFile(join(docsRoot, "00-index.md"), indexPage(), "utf8");
  await writeFile(join(docsRoot, "shared-surfaces.md"), sharedSurfacesPage(), "utf8");
  await writeFile(join(docsRoot, "bff-reference-map.md"), bffReferenceMapPage(), "utf8");
  await writeFile(join(docsRoot, "bff-technical-spec.md"), bffTechnicalSpecPage(), "utf8");
  await writeFile(join(docsRoot, "400line-api-readiness.md"), linebotApiReadinessPage(), "utf8");
  await writeFile(join(docsRoot, "400line-management-blueprint.md"), linebotManagementBlueprintPage(), "utf8");
  await writeFile(join(docsRoot, "system-modules-disambiguation.md"), systemModulesDisambiguationPage(), "utf8");
  await writeFile(join(docsRoot, "partial-implementation-audit.md"), partialImplementationAuditPage(), "utf8");
  await writeFile(join(docsRoot, "cleanup-backlog.md"), cleanupBacklogPage(), "utf8");

  for (const module of MODULE_REGISTRY) {
    await writeFile(join(modulesRoot, `${module.id}.md`), modulePage(module), "utf8");
  }

  console.log(`Generated ${MODULE_REGISTRY.length} module pages under docs/obsidian`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
