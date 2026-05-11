import type { WorkbenchRole } from "../auth/me";
import { getPrimaryRoute } from "../navigation/workbench-routes";
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
  "personal-note": ["個人工作貼", "個人提醒", "工作貼"],
  "counter-log": ["櫃台日誌", "櫃台工作", "每日固定事項"],
  "lane-rentals": ["水道租借", "松山", "水道事項"],
  courts: ["場地預約", "新北高中", "三重商工"],
  parking: ["停車場", "租約", "會員車輛"],
  "parking-vehicles": ["停車場車輛", "車牌", "車主"],
  "parking-plans": ["停車場方案", "月租", "季租", "年租"],
  "parking-contracts": ["停車場租約", "合約", "簽約"],
  "parking-payments": ["停車場付款", "付款審核", "轉帳"],
  "parking-event-days": ["停車場活動日", "活動日", "提前通知"],
  anomalies: ["異常", "打卡異常"],
  "system-health": ["系統健康", "健康"],
  "system-control-center": ["系統控制中心", "IT 控制中心", "控制中心"],
  "system-watchdog": ["Watchdog", "系統健康", "告警", "整合狀態"],
  "system-operations": ["運維協助", "IT 協助", "重發通知", "session"],
  "system-insights": ["行為洞察", "使用率", "流程完成率"],
  "system-governance": ["治理面", "模組登記書", "拓撲", "audit", "raw inspector"],
  "system-function-relations": ["當前功能關係", "功能關係", "資料表關係", "母表子表", "架構圖"],
  "system-topology": ["模組拓撲圖", "拓撲", "topology"],
  "raw-inspector": ["原始資料", "raw"],
  "lifeguard-water-quality": ["水質檢測", "水質", "照片"],
  "lifeguard-coach-dive": ["教練下水", "教練下水", "拍照"],
  "lifeguard-cleanup": ["下班打掃", "收班", "打掃照片"],
  "lifeguard-lane-issues": ["水道事項", "水道", "租借"],
  "lifeguard-lost-and-found": ["失物招領登記", "失物", "拾獲物"],
  "lifeguard-lane-rentals": ["水道租借狀態", "水道租借", "唯讀"],
};

const employeeNavigationOrder = [
  "employee-home",
  "handover",
  "activity-periods",
  "employee-resources",
  "employee-training",
  "personal-note",
  "lifeguard-lost-and-found",
  "courts",
  "knowledge-base-qna",
];

const lifeguardNavigationOrder = [
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

const supervisorNavigationOrder = [
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

const systemNavigationOrder = [
  "system-control-center",
  "system-watchdog",
  "system-operations",
  "system-insights",
  "system-governance",
];

const employeeHomeOrder = [
  "employee-home",
  "handover",
  "activity-periods",
  "employee-resources",
  "employee-training",
  "personal-note",
  "lifeguard-lost-and-found",
  "courts",
  "knowledge-base-qna",
  "shift-reminder",
  "booking-snapshot",
  "notification-center",
  "weather-widget",
  "registration-courses",
  "search",
];

const lifeguardHomeOrder = [
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
  "search",
];

const supervisorHomeOrder = [
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
  "booking-snapshot",
  "notification-center",
  "search",
];

const systemHomeOrder = [
  "system-control-center",
  "system-watchdog",
  "system-operations",
  "system-insights",
  "system-governance",
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
  "employee-home": { shortName: "首頁", routePath: getPrimaryRoute("employee-home", "employee"), iconKey: "home", menuOrder: 1, navVisible: true },
  handover: { name: "櫃台交接", shortName: "櫃台交接", routePath: getPrimaryRoute("handover", "employee"), iconKey: "message-square-text", menuOrder: 2, navVisible: true },
  "activity-periods": { shortName: "活動檔期/課程快訊", routePath: getPrimaryRoute("activity-periods", "employee"), iconKey: "calendar-days", menuOrder: 3, navVisible: true },
  "employee-resources": { shortName: "常用文件", routePath: getPrimaryRoute("employee-resources", "employee"), iconKey: "file-text", menuOrder: 4, navVisible: true },
  "employee-training": { name: "員工教材", shortName: "員工教材", routePath: getPrimaryRoute("employee-training", "employee"), iconKey: "graduation-cap", menuOrder: 5, navVisible: true, requiredPermissions: ["employee:resources:read"] },
  "personal-note": { shortName: "個人工作貼", routePath: getPrimaryRoute("personal-note", "employee"), iconKey: "file-text", menuOrder: 6, navVisible: true },
  "lifeguard-lost-and-found": { shortName: "失物招領", routePath: "/employee/lost-and-found", iconKey: "package-search", menuOrder: 7, cardOrder: 7, navVisible: true, cardVisible: true },
  courts: { shortName: "場地預約", routePath: getPrimaryRoute("courts", "employee"), iconKey: "calendar-days", menuOrder: 8, cardOrder: 8, navVisible: true, cardVisible: true, requiredPermissions: ["employee:booking:read"] },
  "knowledge-base-qna": { shortName: "相關問題詢問", routePath: getPrimaryRoute("knowledge-base-qna", "employee"), iconKey: "book-open", menuOrder: 9, navVisible: true, requiredPermissions: ["employee:qna:read"] },
  checkins: { shortName: "點名/報到", routePath: "/employee/checkins", iconKey: "shield-check", menuOrder: 9, cardOrder: 14, navVisible: false, cardVisible: false },
  parking: { navVisible: false, cardVisible: false },
  "counter-log": { navVisible: false, cardVisible: false },
  "lane-rentals": { navVisible: false, cardVisible: false },
};

const roleDescriptorOverrides: Record<WorkbenchRole, Record<string, Partial<ModuleDescriptor>>> = {
  employee: employeeNavigationOverrides,
  lifeguard: {
    "lifeguard-home": { shortName: "救生首頁", routePath: "/lifeguard", iconKey: "home", menuOrder: 1, cardOrder: 1, navVisible: true, cardVisible: true },
    "lifeguard-water-quality": { shortName: "水質檢測", routePath: "/lifeguard/water-quality", iconKey: "droplets", menuOrder: 2, cardOrder: 2, navVisible: true, cardVisible: true },
    "lifeguard-coach-dive": { shortName: "教練下水", routePath: "/lifeguard/coach-dive", iconKey: "camera", menuOrder: 3, cardOrder: 3, navVisible: true, cardVisible: true },
    "lifeguard-cleanup": { shortName: "下班打掃", routePath: "/lifeguard/cleanup", iconKey: "clipboard-list", menuOrder: 4, cardOrder: 4, navVisible: true, cardVisible: true },
    "lifeguard-lane-issues": { shortName: "水道事項", routePath: "/lifeguard/lane-issues", iconKey: "waves", menuOrder: 5, cardOrder: 5, navVisible: true, cardVisible: true },
    "lifeguard-lost-and-found": { shortName: "失物招領登記", routePath: "/lifeguard/lost-and-found", iconKey: "package-search", menuOrder: 6, cardOrder: 6, navVisible: true, cardVisible: true },
    "lifeguard-lane-rentals": { shortName: "水道租借狀態", routePath: "/lifeguard/lane-rentals", iconKey: "calendar-days", menuOrder: 7, cardOrder: 7, navVisible: true, cardVisible: true },
    "lifeguard-log": { shortName: "救生員日誌", routePath: "/lifeguard/log", iconKey: "lifebuoy", menuOrder: 8, cardOrder: 8, navVisible: true, cardVisible: true },
    announcements: { shortName: "群組公告", routePath: "/employee/announcements", iconKey: "bell", menuOrder: 9, cardOrder: 9, navVisible: true, cardVisible: true },
    "employee-training": { shortName: "員工教材", routePath: "/employee/training", iconKey: "graduation-cap", menuOrder: 10, cardOrder: 10, navVisible: true, cardVisible: true },
    "knowledge-base-qna": { shortName: "相關問題詢問", routePath: "/employee/qna", iconKey: "book-open", menuOrder: 11, cardOrder: 11, navVisible: true, cardVisible: true },
    search: { shortName: "快速搜尋", routePath: "/lifeguard", iconKey: "search", menuOrder: 20, cardOrder: 20, navVisible: false, cardVisible: true },
  },
  supervisor: {
    "supervisor-dashboard": { shortName: "營運總覽", routePath: getPrimaryRoute("supervisor-dashboard", "supervisor"), iconKey: "home", menuOrder: 1, cardOrder: 1, navVisible: true, cardVisible: true },
    facilities: { shortName: "場館", routePath: getPrimaryRoute("facilities", "supervisor"), iconKey: "building", menuOrder: 2, cardOrder: 2, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/supervisor/dashboard", telemetryEvents: ["PAGE_VIEW", "CARD_CLICK"] },
    parking: { shortName: "停車場", routePath: getPrimaryRoute("parking", "supervisor"), iconKey: "car", menuOrder: 3, cardOrder: 3, navVisible: true, cardVisible: true },
    "counter-log": { shortName: "櫃台日誌", routePath: getPrimaryRoute("counter-log", "supervisor"), iconKey: "clipboard-list", menuOrder: 4, cardOrder: 4, navVisible: true, cardVisible: true },
    "lane-rentals": { shortName: "水道租借", routePath: getPrimaryRoute("lane-rentals", "supervisor"), iconKey: "waves", menuOrder: 5, cardOrder: 5, navVisible: true, cardVisible: true },
    courts: { shortName: "場地預約", routePath: getPrimaryRoute("courts", "supervisor"), iconKey: "calendar-days", menuOrder: 6, cardOrder: 6, navVisible: true, cardVisible: true },
    tasks: { shortName: "任務管理", routePath: getPrimaryRoute("tasks", "supervisor"), iconKey: "clipboard-check", menuOrder: 7, cardOrder: 7, navVisible: true, cardVisible: true },
    announcements: { shortName: "公告管理", routePath: getPrimaryRoute("announcements", "supervisor"), iconKey: "bell", menuOrder: 8, cardOrder: 8, navVisible: true, cardVisible: true },
    "announcement-groups": { shortName: "公告群組綁定", routePath: getPrimaryRoute("announcement-groups", "supervisor"), iconKey: "message-square-warning", menuOrder: 9, cardOrder: 9, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "ACTION_SUBMIT"] },
    "supervisor-lifeguard-overview": { shortName: "救生紀錄總覽", routePath: "/supervisor/lifeguard-overview", iconKey: "lifebuoy", menuOrder: 10, cardOrder: 10, navVisible: true, cardVisible: true },
    handover: { shortName: "櫃台交接", routePath: getPrimaryRoute("handover", "supervisor"), iconKey: "message-square-text", menuOrder: 11, cardOrder: 11, navVisible: true, cardVisible: true },
    "employee-training": { shortName: "員工教材", routePath: getPrimaryRoute("employee-training", "supervisor"), iconKey: "graduation-cap", menuOrder: 12, cardOrder: 12, navVisible: true, cardVisible: true },
    anomalies: { shortName: "異常審核", routePath: getPrimaryRoute("anomalies", "supervisor"), iconKey: "shield-check", menuOrder: 13, cardOrder: 13, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/supervisor/dashboard", telemetryEvents: ["PAGE_VIEW", "ACTION_SUBMIT"] },
    analytics: { shortName: "報表", routePath: getPrimaryRoute("analytics", "supervisor"), iconKey: "gauge", menuOrder: 14, cardOrder: 14, navVisible: true, cardVisible: true, telemetryEvents: ["PAGE_VIEW", "REPORT_EXPORT"] },
  },
  system: {
    "system-control-center": { shortName: "控制中心", routePath: "/system", iconKey: "gauge", menuOrder: 1, cardOrder: 1, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/system/control-center", telemetryEvents: ["PAGE_VIEW", "SYSTEM_CONTROL_CENTER_VIEW"] },
    "system-watchdog": { shortName: "Watchdog", routePath: "/system/watchdog", iconKey: "shield-check", menuOrder: 2, cardOrder: 2, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/system/control-center", telemetryEvents: ["PAGE_VIEW", "MODULE_HEALTH_VIEW", "WATCHDOG_EVENT_VIEW", "INTEGRATION_STATUS_VIEW"] },
    "system-operations": { shortName: "運維協助", routePath: "/system/operations", iconKey: "link", menuOrder: 3, cardOrder: 3, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/system/operations/recent-assists", telemetryEvents: ["PAGE_VIEW", "OPS_RESET_SESSION", "OPS_REFRESH_CACHE", "OPS_RESEND_NOTIFICATION"] },
    "system-insights": { shortName: "行為洞察", routePath: "/system/insights", iconKey: "gauge", menuOrder: 4, cardOrder: 4, navVisible: true, cardVisible: true, bffEndpoint: "/api/bff/system/insights/overview", telemetryEvents: ["PAGE_VIEW", "INSIGHTS_VIEW", "INSIGHTS_DRILL_DOWN"] },
    "system-governance": { shortName: "治理面", routePath: "/system/governance", iconKey: "network", menuOrder: 5, cardOrder: 5, navVisible: true, cardVisible: true, bffEndpoint: "/api/modules/registry", telemetryEvents: ["PAGE_VIEW", "ARCHITECTURE_RELATION_VIEW", "TOPOLOGY_VIEW", "AUDIT_LOG_VIEW", "RAW_INSPECTOR_QUERY"] },
    "system-dashboard": { shortName: "系統總覽", routePath: "/system", iconKey: "gauge", menuOrder: 50, cardOrder: 50, navVisible: false, cardVisible: false },
    "system-function-relations": { shortName: "當前功能關係", routePath: "/system/function-relations", iconKey: "link", menuOrder: 51, cardOrder: 51, navVisible: false, cardVisible: false, telemetryEvents: ["PAGE_VIEW", "ARCHITECTURE_RELATION_VIEW"] },
    "system-topology": { shortName: "模組拓撲圖", routePath: "/system/topology", iconKey: "link", menuOrder: 52, cardOrder: 52, navVisible: false, cardVisible: false, telemetryEvents: ["PAGE_VIEW", "TOPOLOGY_VIEW"] },
    "system-health": { shortName: "系統健康", routePath: "/system/health", iconKey: "gauge", menuOrder: 53, cardOrder: 53, navVisible: false, cardVisible: false, telemetryEvents: ["PAGE_VIEW", "MODULE_HEALTH_VIEW"] },
    "system-observability": { shortName: "告警中心", routePath: "/system/alerts", iconKey: "bell", menuOrder: 54, cardOrder: 54, navVisible: false, cardVisible: false, telemetryEvents: ["PAGE_VIEW", "CLIENT_ERROR_VIEW"] },
    "integration-sync-jobs": { shortName: "整合狀態", routePath: "/system/integrations", iconKey: "link", menuOrder: 55, cardOrder: 55, navVisible: false, cardVisible: false, bffEndpoint: "/api/bff/system/integration-overview", telemetryEvents: ["PAGE_VIEW", "INTEGRATION_STATUS_VIEW"] },
    "telemetry-audit": { shortName: "Audit / Telemetry", routePath: "/system/audit", iconKey: "shield-check", menuOrder: 56, cardOrder: 56, navVisible: false, cardVisible: false, telemetryEvents: ["PAGE_VIEW", "AUDIT_LOG_VIEW"] },
    "system-lifeguard-audit": { shortName: "救生稽核", routePath: "/system/lifeguard-audit", iconKey: "lifebuoy", menuOrder: 57, cardOrder: 57, navVisible: false, cardVisible: false },
    "raw-inspector": { shortName: "Raw Inspector", routePath: "/system/raw-inspector", iconKey: "shield-check", menuOrder: 58, cardOrder: 58, navVisible: false, cardVisible: false, telemetryEvents: ["PAGE_VIEW", "RAW_INSPECTOR_QUERY"] },
    "employee-training": { shortName: "教材觀看紀錄", routePath: "/system/training-views", iconKey: "graduation-cap", menuOrder: 59, cardOrder: 59, navVisible: false, cardVisible: false },
    "watchdog-events": { shortName: "Watchdog Events", routePath: "/system/watchdog", iconKey: "gauge", menuOrder: 60, cardOrder: 60, navVisible: false, cardVisible: false, telemetryEvents: ["WATCHDOG_EVENT_VIEW"] },
    parking: { navVisible: false, cardVisible: false },
    "counter-log": { navVisible: false, cardVisible: false },
    "lane-rentals": { navVisible: false, cardVisible: false },
    courts: { navVisible: false, cardVisible: false },
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
    menuOrder: Math.min(module.priority.employee ?? 99, module.priority.lifeguard ?? 99, module.priority.supervisor ?? 99, module.priority.system ?? 99),
    cardOrder: module.homepageWidget ? Math.min(module.priority.employee ?? 99, module.priority.lifeguard ?? 99, module.priority.supervisor ?? 99, module.priority.system ?? 99) : undefined,
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
    name: "點名 / 報到",
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
    searchKeywords: ["點名", "報到", "attendance", "checkin"],
    telemetryEvents: ["CARD_CLICK", "ACTION_SUBMIT"],
    emptyStateText: "目前沒有點名報到資料。",
    notConnectedText: "點名報到已註冊，但正式資料來源尚未接線。",
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
