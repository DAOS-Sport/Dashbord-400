import { MODULE_REGISTRY } from "./registry";
import type { AppRole, ModuleDefinition, ModuleDomainType, ModuleImplementationStatus } from "./types";

export type ModuleArchitectureGroupId =
  | "entry-identity"
  | "employee-content"
  | "lifeguard-workflows"
  | "supervisor-operations"
  | "announcements"
  | "system-governance"
  | "integrations"
  | "portal-legacy";

export interface ModuleArchitectureItem {
  id: string;
  label: string;
  description: string;
  status: ModuleImplementationStatus;
  domainType: ModuleDomainType;
  roles: AppRole[];
  entryMode: "workbench" | "legacy-route" | "api-only" | "background";
  routeCount: number;
  apiCount: number;
  tableCount: number;
  hasBff: boolean;
  ownerRole?: AppRole;
  notes?: string;
}

export interface ModuleArchitectureGroup {
  id: ModuleArchitectureGroupId;
  title: string;
  description: string;
  modules: ModuleArchitectureItem[];
}

export interface ModuleArchitectureCoverage {
  totalModules: number;
  groupedModules: number;
  ungroupedModuleIds: string[];
  suspiciousUnboundModuleIds: string[];
}

export const moduleArchitectureGroupLabels: Record<ModuleArchitectureGroupId, { title: string; description: string }> = {
  "entry-identity": {
    title: "入口、身分與場館權限",
    description: "登入、角色、activeFacility、首頁 shell 與權限快照，是所有工作台的母系統。",
  },
  "employee-content": {
    title: "員工內容與日常工作",
    description: "員工首頁、活動、文件、教材、個人工作貼、場租查看與日常資料卡。",
  },
  "lifeguard-workflows": {
    title: "救生作業與稽核",
    description: "救生首頁、照片/GPS 作業、失物、水道事項、主管觀察與 IT 稽核。",
  },
  "supervisor-operations": {
    title: "主管營運模組",
    description: "主管端停車、櫃台日誌、水道租借、場地預約、任務、交接、異常與報表。",
  },
  announcements: {
    title: "公告、通知與知識",
    description: "系統公告、LINE 群組公告、公告審核、收件人、通知與問答知識庫。",
  },
  "system-governance": {
    title: "IT 治理與觀察面",
    description: "功能關係、拓撲摘要、健康檢查、稽核、Watchdog 與 BFF projections。",
  },
  integrations: {
    title: "外部整合",
    description: "LINE Bot、排班、Ragic、Gmail、同步工作與外部資料源接線。",
  },
  "portal-legacy": {
    title: "Legacy / 相容層",
    description: "舊 portal、舊使用者、舊版面設定與仍保留相容的檔案匯出上傳。",
  },
};

const hasBffBinding = (module: ModuleDefinition) =>
  Boolean(
    module.bff.employeeSectionKey ||
      module.bff.supervisorSectionKey ||
      module.bff.systemSectionKey ||
      module.bff.plannedEndpoints?.length ||
      module.apis.some((api) => api.kind === "bff"),
  );

const hasWorkbenchRoute = (module: ModuleDefinition) =>
  module.routes.some((route) => route.kind === "employee" || route.kind === "lifeguard" || route.kind === "supervisor" || route.kind === "system");

const hasLegacyRoute = (module: ModuleDefinition) =>
  module.routes.some((route) => route.kind === "legacy_admin" || route.kind === "legacy_portal");

export const getModuleEntryMode = (module: ModuleDefinition): ModuleArchitectureItem["entryMode"] => {
  if (hasWorkbenchRoute(module)) return "workbench";
  if (hasLegacyRoute(module)) return "legacy-route";
  if (module.apis.length > 0) return "api-only";
  return "background";
};

export const getModuleArchitectureGroupId = (module: ModuleDefinition): ModuleArchitectureGroupId => {
  if (module.id.startsWith("portal-") || module.id === "widget-layout-settings" || module.id === "file-upload-export") {
    return "portal-legacy";
  }

  if (
    module.id === "auth" ||
    module.id === "dashboard" ||
    module.id.endsWith("-dashboard") ||
    module.id.endsWith("-home") ||
    module.id === "facilities" ||
    module.id === "session-governance" ||
    module.id === "user-role-snapshots" ||
    module.id === "legacy-users"
  ) {
    return "entry-identity";
  }

  if (module.domainType === "integration" || module.id.includes("integration") || module.id.endsWith("-sync-jobs")) {
    return "integrations";
  }

  if (
    module.id.includes("announcement") ||
    module.id.includes("notification") ||
    module.id.includes("qna") ||
    module.id.includes("knowledge")
  ) {
    return "announcements";
  }

  if (
    module.id.startsWith("system-") ||
    module.id.includes("telemetry") ||
    module.id.includes("raw") ||
    module.id.includes("watchdog") ||
    module.id === "bff-projections" ||
    module.id === "helper-status" ||
    module.id === "line-whitelist" ||
    module.id === "hr-audit"
  ) {
    return "system-governance";
  }

  if (module.id.startsWith("lifeguard") || module.id === "supervisor-lifeguard-overview") {
    return "lifeguard-workflows";
  }

  if (
    module.id.startsWith("parking") ||
    module.id === "counter-log" ||
    module.id === "lane-rentals" ||
    module.id === "courts" ||
    module.id === "tasks" ||
    module.id === "handover" ||
    module.id === "anomalies" ||
    module.id === "analytics" ||
    module.id === "operations"
  ) {
    return "supervisor-operations";
  }

  return "employee-content";
};

const isAcceptedWithoutBff = (module: ModuleDefinition) =>
  module.visibility.includes("background_only") ||
  module.status === "legacy" ||
  module.status === "deprecated" ||
  module.status === "external" ||
  module.domainType === "legacy" ||
  module.domainType === "integration";

export const getSuspiciousUnboundModules = () =>
  MODULE_REGISTRY.filter((module) => !hasBffBinding(module) && !isAcceptedWithoutBff(module));

const toArchitectureItem = (module: ModuleDefinition): ModuleArchitectureItem => ({
  id: module.id,
  label: module.label,
  description: module.description,
  status: module.status,
  domainType: module.domainType,
  roles: module.visibleRoles,
  entryMode: getModuleEntryMode(module),
  routeCount: module.routes.length,
  apiCount: module.apis.length,
  tableCount: module.data.filter((item) => Boolean(item.table)).length,
  hasBff: hasBffBinding(module),
  ownerRole: module.governance.ownerRole,
  notes: module.governance.notes,
});

export const getModuleArchitectureGroups = (): ModuleArchitectureGroup[] => {
  const groups = new Map<ModuleArchitectureGroupId, ModuleArchitectureItem[]>();
  for (const id of Object.keys(moduleArchitectureGroupLabels) as ModuleArchitectureGroupId[]) {
    groups.set(id, []);
  }

  for (const module of MODULE_REGISTRY) {
    groups.get(getModuleArchitectureGroupId(module))?.push(toArchitectureItem(module));
  }

  return (Object.keys(moduleArchitectureGroupLabels) as ModuleArchitectureGroupId[]).map((id) => ({
    id,
    title: moduleArchitectureGroupLabels[id].title,
    description: moduleArchitectureGroupLabels[id].description,
    modules: (groups.get(id) ?? []).sort((a, b) => a.id.localeCompare(b.id)),
  }));
};

export const getModuleArchitectureCoverage = (): ModuleArchitectureCoverage => {
  const groups = getModuleArchitectureGroups();
  const groupedIds = new Set(groups.flatMap((group) => group.modules.map((module) => module.id)));

  return {
    totalModules: MODULE_REGISTRY.length,
    groupedModules: groupedIds.size,
    ungroupedModuleIds: MODULE_REGISTRY.filter((module) => !groupedIds.has(module.id)).map((module) => module.id),
    suspiciousUnboundModuleIds: getSuspiciousUnboundModules().map((module) => module.id),
  };
};

export const moduleStatusLabels: Record<ModuleImplementationStatus, string> = {
  implemented: "已接線",
  partial: "部分接線",
  planned: "預留",
  legacy: "相容層",
  external: "外部",
  mock: "Mock",
  deprecated: "停用相容",
};
