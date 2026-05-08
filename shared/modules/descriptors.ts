import type { WorkbenchRole } from "../auth/me";
import { MODULE_REGISTRY } from "./registry";
import type {
  AppRole,
  HomeCardDto,
  ModuleDefinition,
  ModuleDescriptor,
  ModuleDescriptorDomain,
  ModuleHealthDto,
  ModuleImplementationStatus,
  ModuleStage,
  NavigationModuleDto,
} from "./types";

const workbenchRoles: WorkbenchRole[] = ["employee", "lifeguard", "supervisor", "system"];

const hasBffBinding = (module: ModuleDefinition) =>
  Boolean(
    module.bff.employeeSectionKey ||
    module.bff.supervisorSectionKey ||
    module.bff.systemSectionKey ||
    module.apis.some((api) => api.kind === "bff"),
  );

const stageFromStatus = (status: ModuleImplementationStatus, module: ModuleDefinition): ModuleStage => {
  if (status === "deprecated") return "disabled";
  if (status === "planned") return "planned";
  if (status === "implemented" && hasBffBinding(module)) return "production-ready";
  if (hasBffBinding(module)) return "bff-wired";
  if (module.apis.length > 0) return "api-wired";
  return "ui-only";
};

const domainFromModule = (module: ModuleDefinition): ModuleDescriptorDomain => {
  if (module.id.includes("announcement")) return "announcement";
  if (module.id === "handover") return "handover";
  if (module.id.includes("shift") || module.id.includes("schedule") || module.id.includes("booking")) return "schedule";
  if (module.id.includes("auth") || module.id.includes("user") || module.id.includes("facilities") || module.id.includes("hr")) return "people";
  if (module.id.includes("qna") || module.id.includes("knowledge") || module.id.includes("training")) return "knowledge";
  if (module.domainType === "system" || module.id.includes("telemetry") || module.id.includes("audit") || module.id.includes("health")) return "system";
  if (module.domainType === "integration" || module.id.includes("integration")) return "integration";
  if (module.id === "dashboard" || module.domainType === "derived") return "dashboard";
  return "operations";
};

const iconKeyFromModule = (module: ModuleDefinition) => {
  if (module.id.includes("announcement")) return "bell";
  if (module.id === "tasks") return "clipboard-check";
  if (module.id === "handover") return "message-square-text";
  if (module.id.includes("shift") || module.id.includes("schedule")) return "calendar-days";
  if (module.id.includes("quick")) return "link";
  if (module.id.includes("qna") || module.id.includes("knowledge")) return "book-open";
  if (module.id.includes("training")) return "graduation-cap";
  if (module.id.includes("note") || module.id.includes("document")) return "file-text";
  if (module.id.includes("health") || module.id.includes("watchdog")) return "gauge";
  if (module.id.includes("audit") || module.id.includes("raw")) return "shield-check";
  if (module.id.includes("search")) return "search";
  return "home";
};

const chineseKeywords: Record<string, string[]> = {
  dashboard: ["首頁", "儀表板"],
  announcements: ["公告", "群組公告", "重要公告"],
  tasks: ["任務", "今日任務", "交班事項"],
  handover: ["交接", "櫃台交接", "交辦事項"],
  "shift-reminder": ["班表", "今日班表", "排班"],
  "quick-links": ["快速操作", "入口", "捷徑"],
  "knowledge-base-qna": ["知識庫", "問答", "Q&A"],
  "employee-training": ["員工教材", "教學", "訓練", "影片"],
  "personal-note": ["個人工作記事", "便利貼"],
  anomalies: ["異常", "打卡異常"],
  "system-health": ["系統健康", "健康"],
  "raw-inspector": ["原始資料", "raw"],
};

const employeeNavigationOrder = [
  "employee-home",
  "handover",
  "activity-periods",
  "employee-resources",
  "employee-training",
  "personal-note",
  "knowledge-base-qna",
  "checkins",
];

const lifeguardNavigationOrder = [
  "lifeguard-home",
  "lifeguard-log",
  "shift-reminder",
  "announcements",
  "handover",
  "personal-note",
  "knowledge-base-qna",
  "employee-training",
];

const supervisorNavigationOrder = [
  "supervisor-dashboard",
  "facilities",
  "tasks",
  "announcements",
  "handover",
  "employee-training",
  "anomalies",
  "analytics",
];

const systemNavigationOrder = [
  "system-dashboard",
  "system-health",
  "system-observability",
  "integration-sync-jobs",
  "telemetry-audit",
  "raw-inspector",
  "employee-training",
];

const employeeHomeOrder = [
  "employee-home",
  "handover",
  "activity-periods",
  "employee-resources",
  "employee-training",
  "personal-note",
  "knowledge-base-qna",
  "shift-reminder",
  "booking-snapshot",
  "notification-center",
  "weather-widget",
  "registration-courses",
  "checkins",
  "search",
];

const lifeguardHomeOrder = [
  "lifeguard-home",
  "lifeguard-log",
  "shift-reminder",
  "announcements",
  "handover",
  "personal-note",
  "knowledge-base-qna",
  "employee-training",
  "search",
];

const supervisorHomeOrder = [
  "supervisor-dashboard",
  "facilities",
  "tasks",
  "announcements",
  "handover",
  "employee-training",
  "anomalies",
  "analytics",
  "booking-snapshot",
  "notification-center",
  "search",
];

const systemHomeOrder = [
  "system-dashboard",
  "system-health",
  "system-observability",
  "integration-sync-jobs",
  "telemetry-audit",
  "raw-inspector",
  "employee-training",
  "watchdog-events",
  "booking-snapshot",
  "notification-center",
  "search",
];

const roleNavigationOrder: Record<WorkbenchRole, string[]> = {
  employee: employeeNavigationOrder,
  lifeguard: lifeguardNavigationOrder,
  supervisor: supervisorNavigationOrder,
  system: systemNavigationOrder,
};

const roleHomeOrder: Record<WorkbenchRole, string[]> = {
  employee: employeeHomeOrder,
  lifeguard: lifeguardHomeOrder,
  supervisor: supervisorHomeOrder,
  system: systemHomeOrder,
};

const employeeNavigationOverrides: Record<string, Partial<ModuleDescriptor>> = {
  "employee-home": { shortName: "首頁", routePath: "/employee", iconKey: "home", menuOrder: 1, navVisible: true },
  handover: { name: "櫃台交接", shortName: "櫃台交接", routePath: "/employee/handover", iconKey: "message-square-text", menuOrder: 2, navVisible: true },
  "activity-periods": { shortName: "活動檔期/課程快訊", routePath: "/employee/activity-periods", iconKey: "calendar-days", menuOrder: 3, navVisible: true },
  "employee-resources": { shortName: "常用文件", routePath: "/employee/documents", iconKey: "file-text", menuOrder: 4, navVisible: true },
  "employee-training": { name: "員工教材", shortName: "員工教材", routePath: "/employee/training", iconKey: "graduation-cap", menuOrder: 5, navVisible: true, requiredPermissions: ["employee:resources:read"] },
  "personal-note": { shortName: "個人工作記事", routePath: "/employee/personal-note", iconKey: "file-text", menuOrder: 6, navVisible: true },
  "knowledge-base-qna": { shortName: "相關問題詢問", routePath: "/employee/qna", iconKey: "book-open", menuOrder: 7, navVisible: true, requiredPermissions: ["employee:qna:read"] },
  checkins: { shortName: "點名/報到", routePath: "/employee/checkins", iconKey: "shield-check", menuOrder: 8, cardOrder: 13, navVisible: true, cardVisible: true },
};

const roleDescriptorOverrides: Record<WorkbenchRole, Record<string, Partial<ModuleDescriptor>>> = {
  employee: employeeNavigationOverrides,
  lifeguard: {
    "lifeguard-home": { shortName: "救生首頁", routePath: "/lifeguard", iconKey: "home", menuOrder: 1, cardOrder: 1, navVisible: true, cardVisible: true },
    "lifeguard-log": { shortName: "救生員日誌", routePath: "/lifeguard/log", iconKey: "lifebuoy", menuOrder: 2, cardOrder: 2, navVisible: true, cardVisible: true },
    "shift-reminder": { shortName: "今日班表", routePath: "/employee/shift", iconKey: "calendar-days", menuOrder: 3, cardOrder: 3, navVisible: true, cardVisible: true },
    announcements: { shortName: "群組公告", routePath: "/employee/announcements", iconKey: "bell", menuOrder: 4, cardOrder: 4, navVisible: true, cardVisible: true },
    handover: { shortName: "櫃台交接", routePath: "/employee/handover", iconKey: "message-square-text", menuOrder: 5, cardOrder: 5, navVisible: true, cardVisible: true },
    "personal-note": { shortName: "個人工作記事", routePath: "/employee/personal-note", iconKey: "file-text", menuOrder: 6, cardOrder: 6, navVisible: true, cardVisible: true },
    "knowledge-base-qna": { shortName: "相關問題詢問", routePath: "/employee/qna", iconKey: "book-open", menuOrder: 7, cardOrder: 7, navVisible: true, cardVisible: true },
    "employee-training": { shortName: "員工教材", routePath: "/employee/training", iconKey: "graduation-cap", menuOrder: 8, cardOrder: 8, navVisible: true, cardVisible: true },
    search: { shortName: "快速搜尋", routePath: "/lifeguard", iconKey: "search", menuOrder: 20, cardOrder: 20, navVisible: false, cardVisible: true },
  },
  supervisor: {
    "supervisor-dashboard": { shortName: "營運總覽", routePath: "/supervisor", iconKey: "home", menuOrder: 1, cardOrder: 1, navVisible: true, cardVisible: true },
    facilities: { shortName: "場館", routePath: "/supervisor/facilities", iconKey: "building", menuOrder: 2, cardOrder: 2, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/supervisor/dashboard", telemetryEvents: ["PAGE_VIEW", "CARD_CLICK"] },
    tasks: { shortName: "任務管理", routePath: "/supervisor/tasks", iconKey: "clipboard-check", menuOrder: 3, cardOrder: 3, navVisible: true, cardVisible: true },
    announcements: { shortName: "公告管理", routePath: "/supervisor/announcements", iconKey: "bell", menuOrder: 4, cardOrder: 4, navVisible: true, cardVisible: true },
    handover: { shortName: "櫃台交接", routePath: "/supervisor/handover", iconKey: "message-square-text", menuOrder: 5, cardOrder: 5, navVisible: true, cardVisible: true },
    "employee-training": { shortName: "員工教材", routePath: "/supervisor/training", iconKey: "graduation-cap", menuOrder: 6, cardOrder: 6, navVisible: true, cardVisible: true },
    anomalies: { shortName: "異常審核", routePath: "/supervisor/anomalies", iconKey: "shield-check", menuOrder: 7, cardOrder: 7, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/supervisor/dashboard", telemetryEvents: ["PAGE_VIEW", "ACTION_SUBMIT"] },
    analytics: { shortName: "報表", routePath: "/supervisor/reports", iconKey: "gauge", menuOrder: 8, cardOrder: 8, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "REPORT_EXPORT"] },
  },
  system: {
    "system-dashboard": { shortName: "系統總覽", routePath: "/system", iconKey: "gauge", menuOrder: 1, cardOrder: 1, navVisible: true, cardVisible: true },
    "system-health": { shortName: "系統健康", routePath: "/system/health", iconKey: "gauge", menuOrder: 2, cardOrder: 2, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "MODULE_HEALTH_VIEW"] },
    "system-observability": { shortName: "告警中心", routePath: "/system/alerts", iconKey: "bell", menuOrder: 3, cardOrder: 3, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "CLIENT_ERROR_VIEW"] },
    "integration-sync-jobs": { shortName: "整合狀態", routePath: "/system/integrations", iconKey: "link", menuOrder: 4, cardOrder: 4, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/system/integration-overview", telemetryEvents: ["PAGE_VIEW", "INTEGRATION_STATUS_VIEW"] },
    "telemetry-audit": { shortName: "Audit / Telemetry", routePath: "/system/audit", iconKey: "shield-check", menuOrder: 5, cardOrder: 5, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "AUDIT_LOG_VIEW"] },
    "raw-inspector": { shortName: "Raw Inspector", routePath: "/system/raw-inspector", iconKey: "shield-check", menuOrder: 6, cardOrder: 6, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "RAW_INSPECTOR_QUERY"] },
    "employee-training": { shortName: "教材觀看紀錄", routePath: "/system/training-views", iconKey: "graduation-cap", menuOrder: 7, cardOrder: 7, navVisible: true, cardVisible: true },
    "watchdog-events": { shortName: "Watchdog", routePath: "/system/alerts", iconKey: "gauge", menuOrder: 8, cardOrder: 8, navVisible: false, cardVisible: true, telemetryEvents: ["WATCHDOG_EVENT_VIEW"] },
  },
};

const routeForRole = (module: ModuleDefinition, role: WorkbenchRole) =>
  module.routes.find((route) => route.role === role && route.kind === role)?.path
  ?? module.routes.find((route) => route.role === role)?.path
  ?? module.routes.find((route) => route.kind !== "api")?.path;

const routeForDescriptorRole = (moduleId: string, role: WorkbenchRole, fallback?: string) => {
  const module = MODULE_REGISTRY.find((item) => item.id === moduleId);
  return module ? routeForRole(module, role) ?? fallback : fallback;
};

const permissionSatisfied = (requiredPermissions: string[], permissionsSnapshot?: string[]) => {
  if (requiredPermissions.length === 0) return true;
  if (!permissionsSnapshot || permissionsSnapshot.length === 0) return true;
  if (requiredPermissions.some((permission) => permissionsSnapshot.includes(permission))) return true;
  const requiredRoles = new Set(requiredPermissions.map((permission) => permission.split(":")[0]).filter(Boolean));
  return Array.from(requiredRoles).some((role) =>
    permissionsSnapshot.some((permission) => permission.startsWith(`${role}:`)),
  );
};

const rolePermissionForModule = (role: WorkbenchRole, module: ModuleDescriptor) => {
  const roleSpecific = module.requiredPermissions.filter((permission) => permission.startsWith(`${role}:`));
  return roleSpecific.length ? roleSpecific : [`${role}:${module.id}:view`];
};

const telemetryEventsFromModule = (module: ModuleDefinition) => {
  const events = [...(module.telemetry.eventTypes ?? [])];
  if (module.telemetry.trackPageView) events.push("PAGE_VIEW");
  if (module.telemetry.trackCardClick) events.push("CARD_CLICK");
  if (module.telemetry.trackActionSubmit) events.push("ACTION_SUBMIT");
  if (module.telemetry.auditRequired) events.push("AUDIT_REQUIRED");
  return Array.from(new Set(events));
};

const bffEndpointForRole = (module: ModuleDefinition, role: WorkbenchRole) => {
  if (role === "employee" && module.bff.employeeSectionKey) return "/api/bff/employee/home";
  if (role === "lifeguard" && module.bff.employeeSectionKey) return "/api/bff/lifeguard/home";
  if (role === "supervisor" && module.bff.supervisorSectionKey) return "/api/bff/supervisor/dashboard";
  if (role === "system" && module.bff.systemSectionKey) return "/api/bff/system/dashboard";
  return module.apis.find((api) => api.kind === "bff")?.path ?? module.bff.plannedEndpoints?.[0];
};

const apiPrefixFromModule = (module: ModuleDefinition) => {
  const apiPath = module.apis.find((api) => api.kind === "crud" || api.kind === "bff" || api.kind === "auth")?.path;
  if (!apiPath) return undefined;
  return apiPath.split("/:")[0];
};

const descriptorFromModule = (module: ModuleDefinition): ModuleDescriptor => {
  const roles = module.visibleRoles.filter((role): role is WorkbenchRole => workbenchRoles.includes(role as WorkbenchRole));
  if (module.visibleRoles.includes("employee") && lifeguardHomeOrder.includes(module.id) && !roles.includes("lifeguard")) {
    roles.push("lifeguard");
  }
  const primaryRole = roles[0] ?? "employee";
  const routePath = routeForRole(module, primaryRole);
  return {
    id: module.id,
    name: module.label,
    shortName: module.label,
    description: module.description,
    domain: domainFromModule(module),
    stage: stageFromStatus(module.status, module),
    roles,
    defaultEnabled: module.status !== "deprecated",
    navVisible: module.visibility.some((item) => item === "detail_page" || item === "admin_page") && Boolean(routePath),
    cardVisible: module.homepageWidget,
    routePath,
    bffEndpoint: bffEndpointForRole(module, primaryRole),
    apiPrefix: apiPrefixFromModule(module),
    iconKey: iconKeyFromModule(module),
    menuOrder: Math.min(module.priority.employee ?? 99, module.priority.supervisor ?? 99, module.priority.system ?? 99),
    cardOrder: module.homepageWidget ? Math.min(module.priority.employee ?? 99, module.priority.supervisor ?? 99, module.priority.system ?? 99) : undefined,
    requiredPermissions: module.routes.flatMap((route) => route.role ? [`${route.role}:${module.id}:view`] : []),
    dependencies: module.integrations.map((item) => item.provider),
    searchKeywords: [module.id, module.label, module.description, ...(chineseKeywords[module.id] ?? []), ...(module.legacy?.oldNames ?? []), ...(module.legacy?.oldRoutes ?? [])],
    telemetryEvents: telemetryEventsFromModule(module),
    emptyStateText: `${module.label} 目前沒有資料。`,
    notConnectedText: `${module.label} 已註冊，但資料來源尚未接線。`,
  };
};

const extraDescriptors: ModuleDescriptor[] = [
  {
    id: "employee-home",
    name: "員工首頁",
    description: "Employee role home composition generated from BFF home cards.",
    domain: "dashboard",
    stage: "production-ready",
    roles: ["employee"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/employee",
    bffEndpoint: "/api/bff/employee/home",
    iconKey: "home",
    menuOrder: 1,
    cardOrder: 1,
    requiredPermissions: ["employee:home:read"],
    dependencies: ["dashboard", "tasks", "handover", "announcements", "shift-reminder", "quick-links"],
    searchKeywords: ["首頁", "員工", "今日任務", "交辦事項", "employee home"],
    telemetryEvents: ["PAGE_VIEW", "CARD_CLICK"],
    emptyStateText: "員工首頁目前沒有可顯示卡片。",
    notConnectedText: "員工首頁已註冊，但 BFF 尚未接線。",
  },
  {
    id: "supervisor-dashboard",
    name: "主管儀表板",
    description: "Supervisor dashboard BFF projection.",
    domain: "dashboard",
    stage: "bff-wired",
    roles: ["supervisor"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/supervisor",
    bffEndpoint: "/api/bff/supervisor/dashboard",
    iconKey: "home",
    menuOrder: 1,
    cardOrder: 1,
    requiredPermissions: ["supervisor:dashboard:read"],
    dependencies: ["tasks", "handover", "announcements", "anomalies"],
    searchKeywords: ["主管", "dashboard", "staffing"],
    telemetryEvents: ["PAGE_VIEW", "CARD_CLICK"],
    emptyStateText: "主管儀表板目前沒有摘要資料。",
    notConnectedText: "主管儀表板已註冊，但 BFF 尚未接線。",
  },
  {
    id: "system-dashboard",
    name: "系統儀表板",
    description: "System dashboard and observability overview.",
    domain: "system",
    stage: "bff-wired",
    roles: ["system"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/system",
    bffEndpoint: "/api/bff/system/dashboard",
    iconKey: "gauge",
    menuOrder: 1,
    cardOrder: 1,
    requiredPermissions: ["system:overview:read"],
    dependencies: ["system-health", "telemetry-audit", "watchdog-events"],
    searchKeywords: ["系統", "health", "observability"],
    telemetryEvents: ["PAGE_VIEW", "MODULE_HEALTH_VIEW"],
    emptyStateText: "系統儀表板目前沒有健康摘要。",
    notConnectedText: "系統儀表板已註冊，但 BFF 尚未接線。",
  },
  {
    id: "lifeguard-home",
    name: "救生首頁",
    description: "Lifeguard role home composition generated from employee-grade BFF cards and lifeguard log entry state.",
    domain: "dashboard",
    stage: "bff-wired",
    roles: ["lifeguard"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/lifeguard",
    bffEndpoint: "/api/bff/lifeguard/home",
    iconKey: "home",
    menuOrder: 1,
    cardOrder: 1,
    requiredPermissions: ["lifeguard:home:read"],
    dependencies: ["shift-reminder", "announcements", "handover"],
    searchKeywords: ["救生", "救生員", "首頁", "lifeguard home"],
    telemetryEvents: ["PAGE_VIEW", "CARD_CLICK"],
    emptyStateText: "救生首頁目前沒有可顯示卡片。",
    notConnectedText: "救生首頁已註冊，但 BFF 尚未接線。",
  },
  {
    id: "lifeguard-log",
    name: "救生員日誌",
    description: "Lifeguard-owned daily log, water quality, handover, and submission workflow.",
    domain: "operations",
    stage: "bff-wired",
    roles: ["lifeguard"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/lifeguard/log",
    bffEndpoint: "/api/bff/lifeguard/home",
    apiPrefix: "/api/work-logs",
    iconKey: "lifebuoy",
    menuOrder: 2,
    cardOrder: 2,
    requiredPermissions: ["lifeguard:log:read"],
    dependencies: ["shift-reminder", "handover"],
    searchKeywords: ["救生員日誌", "水質", "交接", "日報", "lifeguard log"],
    telemetryEvents: ["PAGE_VIEW", "LIFEGUARD_LOG_CREATED", "LIFEGUARD_LOG_UPDATED"],
    emptyStateText: "今日尚未建立救生員日誌。",
    notConnectedText: "救生員日誌已註冊，但資料來源尚未接線。",
  },
  {
    id: "search",
    name: "快速搜尋",
    description: "Global module and workbench search BFF.",
    domain: "knowledge",
    stage: "bff-wired",
    roles: ["employee", "lifeguard", "supervisor", "system"],
    defaultEnabled: true,
    navVisible: false,
    cardVisible: true,
    bffEndpoint: "/api/search/global",
    iconKey: "search",
    menuOrder: 30,
    cardOrder: 10,
    requiredPermissions: ["workbench:search"],
    dependencies: ["MODULE_REGISTRY"],
    searchKeywords: ["搜尋", "search", "module"],
    telemetryEvents: ["SEARCH_SUBMIT"],
    emptyStateText: "沒有符合搜尋條件的結果。",
    notConnectedText: "搜尋已註冊，但全文資料來源尚未接線。",
  },
  {
    id: "weather-widget",
    name: "天氣卡片",
    description: "Employee home weather card; source is intentionally not connected yet.",
    domain: "integration",
    stage: "planned",
    roles: ["employee"],
    defaultEnabled: true,
    navVisible: false,
    cardVisible: true,
    bffEndpoint: "/api/bff/employee/home",
    iconKey: "cloud-sun",
    menuOrder: 40,
    cardOrder: 60,
    requiredPermissions: ["employee:home:read"],
    dependencies: [],
    searchKeywords: ["天氣", "weather"],
    telemetryEvents: ["CARD_CLICK"],
    emptyStateText: "目前沒有天氣資料。",
    notConnectedText: "天氣卡片已註冊，但資料來源尚未接線。",
  },
  {
    id: "checkins",
    name: "點名 / 打卡",
    description: "Attendance and check-in entry module placeholder.",
    domain: "attendance",
    stage: "planned",
    roles: ["employee"],
    defaultEnabled: true,
    navVisible: false,
    cardVisible: false,
    routePath: "/employee/checkins",
    iconKey: "shield-check",
    menuOrder: 70,
    cardOrder: 70,
    requiredPermissions: ["employee:checkin:read"],
    dependencies: ["anomalies"],
    searchKeywords: ["點名", "打卡", "attendance", "checkin"],
    telemetryEvents: ["CARD_CLICK", "ACTION_SUBMIT"],
    emptyStateText: "目前沒有打卡資料。",
    notConnectedText: "點名打卡已註冊，但正式資料來源尚未接線。",
  },
  {
    id: "activity-periods",
    name: "活動檔期 / 課程快訊",
    description: "Activity period surface backed by employee resources and announcement candidates.",
    domain: "operations",
    stage: "bff-wired",
    roles: ["employee", "supervisor"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/employee/activity-periods",
    bffEndpoint: "/api/bff/employee/home",
    apiPrefix: "/api/portal/employee-resources",
    iconKey: "calendar-days",
    menuOrder: 22,
    cardOrder: 22,
    requiredPermissions: ["employee:resources:read"],
    dependencies: ["employee-resources", "campaigns-events"],
    searchKeywords: ["活動", "檔期", "課程快訊", "campaign"],
    telemetryEvents: ["CARD_CLICK"],
    emptyStateText: "目前沒有活動檔期。",
    notConnectedText: "活動檔期已註冊，但 BFF 尚未完整收斂。",
  },
  {
    id: "registration-courses",
    name: "報名 / 課程",
    description: "Registration and course entry; booking provider is not connected yet.",
    domain: "schedule",
    stage: "planned",
    roles: ["employee"],
    defaultEnabled: true,
    navVisible: true,
    cardVisible: true,
    routePath: "/employee/more",
    iconKey: "book-open",
    menuOrder: 23,
    cardOrder: 23,
    requiredPermissions: ["employee:booking:read"],
    dependencies: ["booking-snapshot"],
    searchKeywords: ["報名", "課程", "booking", "course"],
    telemetryEvents: ["CARD_CLICK"],
    emptyStateText: "目前沒有報名課程資料。",
    notConnectedText: "報名課程已註冊，但 booking provider 尚未接線。",
  },
];

export const getModuleDescriptors = (): ModuleDescriptor[] => {
  const base = MODULE_REGISTRY.map(descriptorFromModule);
  const existingIds = new Set(base.map((item) => item.id));
  return [...base, ...extraDescriptors.filter((item) => !existingIds.has(item.id))];
};

export const getModuleDescriptorById = (moduleId: string) =>
  getModuleDescriptors().find((item) => item.id === moduleId);

export const getModuleDescriptorsByRole = (role: WorkbenchRole): ModuleDescriptor[] =>
  getModuleDescriptors()
    .filter((module) => module.roles.includes(role))
    .map((module) => {
      const roleRoutePath = routeForDescriptorRole(module.id, role, module.routePath);
      const overrides = roleDescriptorOverrides[role][module.id] ?? {};
      const adjusted = { ...module, routePath: roleRoutePath, ...overrides };
      return {
        ...adjusted,
        requiredPermissions: rolePermissionForModule(role, adjusted),
      };
    })
    .sort((a, b) => a.menuOrder - b.menuOrder || a.name.localeCompare(b.name, "zh-TW"));

export const getNavigationModules = (role: WorkbenchRole, permissionsSnapshot?: string[]): NavigationModuleDto[] =>
  getModuleDescriptorsByRole(role)
    .filter((module) => roleNavigationOrder[role].includes(module.id))
    .filter((module) => module.navVisible && module.routePath)
    .filter((module) => permissionSatisfied(module.requiredPermissions, permissionsSnapshot))
    .map((module) => ({
      id: module.id,
      name: module.shortName ?? module.name,
      routePath: module.routePath!,
      iconKey: module.iconKey ?? "home",
      enabled: module.defaultEnabled && module.stage !== "disabled",
      stage: module.stage,
      menuOrder: module.menuOrder,
    }))
    .sort((a, b) => roleNavigationOrder[role].indexOf(a.id) - roleNavigationOrder[role].indexOf(b.id));

export const getHomeLayoutCards = (role: WorkbenchRole, permissionsSnapshot?: string[]): HomeCardDto[] =>
  getModuleDescriptorsByRole(role)
    .filter((module) => roleHomeOrder[role].includes(module.id))
    .filter((module) => permissionSatisfied(module.requiredPermissions, permissionsSnapshot))
    .filter((module) => module.stage !== "disabled")
    .map((module) => ({
      moduleId: module.id,
      title: module.shortName ?? module.name,
      subtitle: module.description,
      status: (
        module.stage === "production-ready"
          ? "empty"
          : module.stage === "bff-wired"
            ? "incomplete"
            : "not_connected"
      ) as HomeCardDto["status"],
      routePath: module.routePath,
      order: module.cardOrder ?? module.menuOrder,
      payload: null,
      sourceStatus: {
        source: module.bffEndpoint ?? module.apiPrefix ?? "MODULE_REGISTRY",
        connected: module.stage === "production-ready" || module.stage === "bff-wired",
        errorMessage: module.stage === "bff-wired"
          ? `${module.name} 已接上 BFF，但尚未達到 production-ready。`
          : module.stage === "production-ready"
            ? undefined
            : module.notConnectedText,
      },
    }))
    .sort((a, b) => roleHomeOrder[role].indexOf(a.moduleId) - roleHomeOrder[role].indexOf(b.moduleId));

export const getModuleHealth = (role?: WorkbenchRole, permissionsSnapshot?: string[]): ModuleHealthDto[] => {
  const descriptors = role ? getModuleDescriptorsByRole(role) : getModuleDescriptors();
  const checkedAt = new Date().toISOString();
  return descriptors.map((module) => {
    const routeOk = !module.navVisible || Boolean(module.routePath);
    const bffOk = !module.cardVisible || Boolean(module.bffEndpoint);
    const permissionOk = permissionSatisfied(module.requiredPermissions, permissionsSnapshot);
    const telemetryOk = module.telemetryEvents.length > 0;
    const issues = [
      routeOk ? "" : "navVisible module has no routePath",
      bffOk ? "" : "cardVisible module has no BFF endpoint",
      permissionOk ? "" : "module permission is missing or not granted",
      telemetryOk ? "" : "module has no telemetry event descriptor",
      module.stage === "planned" ? module.notConnectedText : "",
      module.stage === "ui-only" ? `${module.name} 仍停留在 ui-only。` : "",
      module.stage === "api-wired" ? `${module.name} 已有 API，但尚未接入首頁/BFF。` : "",
      module.stage === "bff-wired" ? "" : "",
    ].filter(Boolean);
    const hasOnlyTelemetryIssue = issues.length === 1 && !telemetryOk;
    return {
      moduleId: module.id,
      status: module.stage === "production-ready" || module.stage === "bff-wired"
        ? issues.length ? (hasOnlyTelemetryIssue ? "telemetry_pending" : "degraded") : "ready"
        : module.stage === "disabled" || module.stage === "planned" || module.stage === "ui-only" || module.stage === "api-wired"
          ? "not_connected"
          : "degraded",
      routeOk,
      bffOk,
      permissionOk,
      telemetryOk,
      lastCheckedAt: checkedAt,
      issues,
    };
  });
};

export const canViewModule = (
  user: { activeRole: WorkbenchRole; grantedFacilities?: string[]; permissionsSnapshot?: string[] },
  moduleId: string,
  facilityKey?: string,
) => {
  const descriptor = getModuleDescriptorById(moduleId);
  if (!descriptor) return false;
  if (!descriptor.roles.includes(user.activeRole)) return false;
  if (facilityKey && user.grantedFacilities?.length && !user.grantedFacilities.includes(facilityKey)) return false;
  if (!permissionSatisfied(descriptor.requiredPermissions, user.permissionsSnapshot)) return false;
  return descriptor.defaultEnabled && descriptor.stage !== "disabled";
};

export const canManageModule = (
  user: { activeRole: WorkbenchRole; grantedFacilities?: string[]; permissionsSnapshot?: string[] },
  moduleId: string,
  facilityKey?: string,
) => {
  if (!canViewModule(user, moduleId, facilityKey)) return false;
  if (user.activeRole === "system") return true;
  const descriptor = getModuleDescriptorById(moduleId);
  return user.activeRole === "supervisor" && !descriptor?.id.includes("system") && descriptor?.domain !== "system";
};

export const canAccessRoute = (
  user: { activeRole: WorkbenchRole; grantedFacilities?: string[]; permissionsSnapshot?: string[] },
  routePath: string,
  facilityKey?: string,
) =>
  getModuleDescriptors().some((module) => module.routePath === routePath && canViewModule(user, module.id, facilityKey));
