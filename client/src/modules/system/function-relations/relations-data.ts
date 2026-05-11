import type { LucideIcon } from "lucide-react";
import { Bell, Building2, Car, ClipboardCheck, Database, FileText, GraduationCap, LifeBuoy, Link2, ShieldCheck, Waves } from "lucide-react";
import {
  getModuleArchitectureCoverage,
  getModuleArchitectureGroups,
  moduleStatusLabels,
  type ModuleArchitectureGroup,
  type ModuleArchitectureItem,
} from "@shared/modules";

export interface RelationMetric {
  label: string;
  value: string;
  helper: string;
}

export interface TableRelationChild {
  table: string;
  relation: string;
  feature: string;
  status: "active" | "partial" | "planned";
}

export interface TableRelationGroup {
  id: string;
  title: string;
  parent: string;
  description: string;
  Icon: LucideIcon;
  children: TableRelationChild[];
}

export interface FeatureFlow {
  id: string;
  title: string;
  owner: string;
  route: string;
  summary: string;
  steps: string[];
  tables: string[];
  audit: string[];
}

export interface RouteRelation {
  role: "employee" | "lifeguard" | "supervisor" | "system";
  title: string;
  route: string;
  modules: string[];
  source: string;
}

export type { ModuleArchitectureGroup, ModuleArchitectureItem };

export const architectureModuleGroups = getModuleArchitectureGroups();
export const architectureCoverage = getModuleArchitectureCoverage();
export { moduleStatusLabels };

export const relationMetrics: RelationMetric[] = [
  { label: "角色入口", value: "4", helper: "employee / lifeguard / supervisor / system" },
  { label: "Registry 模組", value: String(architectureCoverage.totalModules), helper: `${architectureCoverage.groupedModules} 個已歸入母系統` },
  { label: "核心資料域", value: "8", helper: "人員、場館、公告、日誌、救生、停車、場租、治理" },
  { label: "待分類警示", value: String(architectureCoverage.ungroupedModuleIds.length + architectureCoverage.suspiciousUnboundModuleIds.length), helper: "孤兒模組 / 可疑無 BFF" },
];

export const tableRelationGroups: TableRelationGroup[] = [
  {
    id: "identity-facility",
    title: "人員、場館與權限",
    parent: "users + facilities",
    description: "所有工作台都先由登入身分、角色快照與 activeFacility 決定可見資料範圍。",
    Icon: Building2,
    children: [
      { table: "sessions_index", relation: "userId / activeRole / activeFacility", feature: "登入狀態與切換角色", status: "active" },
      { table: "user_role_snapshots", relation: "userId -> grantedRoles / grantedFacilities", feature: "權限矩陣快照", status: "active" },
      { table: "auth_audit_logs", relation: "actorId -> auth action", feature: "登入與權限操作稽核", status: "active" },
      { table: "module_facility_overrides", relation: "facilityKey + moduleId", feature: "場館層級模組開關", status: "partial" },
      { table: "notification_recipients", relation: "facilityKey -> email recipient", feature: "通知收件人", status: "partial" },
    ],
  },
  {
    id: "employee-home",
    title: "員工首頁與內容資料",
    parent: "facilities + activeFacility",
    description: "員工首頁 BFF 依目前場館組合交辦、班表、公告、文件、個人工作貼與場租查看。",
    Icon: FileText,
    children: [
      { table: "operational_handovers", relation: "facilityKey -> targetDate / targetShiftLabel", feature: "交辦事項", status: "active" },
      { table: "tasks", relation: "facilityKey -> createdBy / assignedTo", feature: "今日任務", status: "active" },
      { table: "employee_resources", relation: "facilityKey + category", feature: "活動檔期、常用文件、個人工作貼、本地公告", status: "active" },
      { table: "system_announcements", relation: "facilityKey / facilityKeys", feature: "主管公告管理", status: "active" },
      { table: "announcement_acknowledgements", relation: "announcementId + userId", feature: "公告已讀回寫", status: "partial" },
      { table: "announcement_overlays", relation: "announcementId -> hidden / pinnedUntil", feature: "公告遮罩、釘選與備註", status: "active" },
      { table: "widget_layout_settings", relation: "facilityKey + role + layoutKey", feature: "首頁版型設定", status: "partial" },
      { table: "knowledge_base_qna", relation: "facilityKey -> category / tags", feature: "相關問題詢問", status: "active" },
    ],
  },
  {
    id: "announcement-groups",
    title: "群組重要公告",
    parent: "facility_announcement_groups",
    description: "主管綁定場館與 LINE groupId，員工首頁依 activeFacility 拉取群組文字公告。",
    Icon: Bell,
    children: [
      { table: "facility_announcement_groups", relation: "facilityKey + lineGroupId unique", feature: "場館 LINE 群組綁定", status: "active" },
      { table: "employee_resources(category=announcement)", relation: "facilityKey -> local content", feature: "員工本地公告內容", status: "active" },
      { table: "announcement_overlays", relation: "line/system/local announcement id", feature: "隱藏、釘選、備註 overlay", status: "active" },
      { table: "audit_logs", relation: "resource=announcement-groups", feature: "主管 CRUD 與測試拉訊息稽核", status: "active" },
    ],
  },
  {
    id: "work-logs",
    title: "救生 / 櫃台日誌",
    parent: "daily_task_templates + assigned / recurring templates",
    description: "主管建立模板與指派，救生或櫃台填寫完成紀錄，最後產生日報送審與審核紀錄。",
    Icon: ClipboardCheck,
    children: [
      { table: "daily_task_templates", relation: "facilityKey + moduleType + shiftType", feature: "每日固定事項模板", status: "active" },
      { table: "lifeguard_assigned_tasks", relation: "facilityKey + assignedToShift", feature: "主管交辦任務", status: "active" },
      { table: "recurring_task_templates", relation: "facilityKey + recurrenceType", feature: "週期循環任務", status: "active" },
      { table: "work_log_task_completions", relation: "facilityKey + workDate + shiftType + taskRefId", feature: "任務完成紀錄", status: "active" },
      { table: "water_quality_records", relation: "scheduleId / facilityKey / workDate", feature: "水質表單紀錄", status: "active" },
      { table: "daily_report_submissions", relation: "facilityKey + workDate + shiftType", feature: "日報送審", status: "active" },
      { table: "work_log_review_actions", relation: "submissionId -> approve / return", feature: "主管審核軌跡", status: "active" },
    ],
  },
  {
    id: "lifeguard-operations",
    title: "救生拍照與失物流程",
    parent: "facilities + lifeguard user + photo_upload",
    description: "救生模組用 GPS、浮水印照片與 Object Storage 建立可稽核作業紀錄。",
    Icon: LifeBuoy,
    children: [
      { table: "lifeguard_water_quality_logs", relation: "facilityKey + createdBy + GPS", feature: "水質檢測照片回傳", status: "active" },
      { table: "lifeguard_coach_dive_logs", relation: "facilityKey + coachName + GPS", feature: "教練下水拍照記錄", status: "active" },
      { table: "lifeguard_cleanup_logs", relation: "facilityKey + createdBy + GPS", feature: "下班打掃照片", status: "active" },
      { table: "lifeguard_lost_and_found", relation: "facilityKey + claimStatus", feature: "失物招領、認領、廢棄", status: "active" },
      { table: "lifeguard_handover_notes", relation: "facilityKey + workDate + shift", feature: "水道事項與交接補充", status: "partial" },
      { table: "audit_logs", relation: "action=LIFEGUARD_*", feature: "照片上傳與狀態變更稽核", status: "active" },
    ],
  },
  {
    id: "parking",
    title: "停車場會員與租約",
    parent: "parking_vehicles + parking_plans",
    description: "車輛和方案是母資料，租約綁車輛與方案，付款審核後才更新租約與車牌效期。",
    Icon: Car,
    children: [
      { table: "parking_vehicles", relation: "licensePlate unique", feature: "車牌、車主、身份類型與效期", status: "active" },
      { table: "parking_plans", relation: "planKey unique", feature: "月租、季租、年租、會員、泳隊等方案", status: "active" },
      { table: "parking_contracts", relation: "vehicleId + planId", feature: "租約狀態、簽名、PDF、行照駕照", status: "active" },
      { table: "parking_payments", relation: "contractId -> payment review", feature: "轉帳回報與付款審核", status: "active" },
      { table: "parking_event_days", relation: "eventDate -> restrictions", feature: "活動日停車限制與通知", status: "active" },
    ],
  },
  {
    id: "courts-lanes",
    title: "水道租借與場地預約",
    parent: "facilities / court schools",
    description: "水道租借以場館與日期查詢；場地預約以 school/date/court 建立日週月與搜尋視圖。",
    Icon: Waves,
    children: [
      { table: "lane_rentals", relation: "facilityKey + bookingDate + laneCode", feature: "水道時段矩陣", status: "active" },
      { table: "court_reservations", relation: "school + date + court + time", feature: "新北高中 / 三重商工場租", status: "active" },
      { table: "court_sync_logs", relation: "school + sync scope", feature: "Google Calendar 匯入同步紀錄", status: "partial" },
      { table: "court_sync_errors", relation: "school + eventId / reason", feature: "匯入錯誤與排查", status: "partial" },
      { table: "source_snapshots", relation: "source + externalId", feature: "外部 payload 原始快照", status: "partial" },
    ],
  },
  {
    id: "system-governance",
    title: "系統治理、模組與稽核",
    parent: "MODULE_REGISTRY + module_settings",
    description: "module registry 是導覽、首頁卡、健康檢查與拓撲的 canonical source，audit_logs 負責追蹤高風險動作。",
    Icon: ShieldCheck,
    children: [
      { table: "module_settings", relation: "moduleId primary key", feature: "模組啟用與排序", status: "partial" },
      { table: "module_role_permissions", relation: "moduleId + role", feature: "角色可看 / 可管控", status: "partial" },
      { table: "audit_logs", relation: "actorId + role + action + resource", feature: "IT 稽核查詢", status: "active" },
      { table: "portal_events", relation: "facilityKey + eventType", feature: "Portal / 員工行為事件", status: "active" },
      { table: "watchdog_events", relation: "serviceName + observedAt", feature: "告警中心與 Watchdog", status: "partial" },
      { table: "system_overview_projection", relation: "projection snapshot", feature: "系統總覽 BFF projection", status: "partial" },
    ],
  },
];

export const featureFlows: FeatureFlow[] = [
  {
    id: "employee-home-flow",
    title: "員工首頁資料流",
    owner: "employee",
    route: "/employee",
    summary: "登入後依 activeFacility 取首頁 BFF，再把交辦、班表、公告、文件、場租、個人工作貼組成固定格線。",
    steps: ["Auth session", "activeFacility", "employee home BFF", "home cards", "page / drawer / detail routes"],
    tables: ["sessions_index", "operational_handovers", "tasks", "employee_resources", "system_announcements", "court_reservations"],
    audit: ["portal_events", "audit_logs"],
  },
  {
    id: "announcement-flow",
    title: "群組重要公告流",
    owner: "supervisor / employee",
    route: "/supervisor/announcement-groups -> /employee",
    summary: "主管維護 LINE 群組綁定；員工首頁依場館拉群組訊息，再與本地公告、系統公告合併排序。",
    steps: ["facility group binding", "LINE Bot messages API", "transform summary", "overlay / acknowledgement", "employee announcement panel"],
    tables: ["facility_announcement_groups", "employee_resources", "system_announcements", "announcement_overlays", "announcement_acknowledgements"],
    audit: ["ANNOUNCEMENT_GROUP_*", "ANNOUNCEMENT_PREVIEW_*"],
  },
  {
    id: "lifeguard-photo-flow",
    title: "救生照片與 GPS 稽核流",
    owner: "lifeguard / system",
    route: "/lifeguard/* -> /system/lifeguard-audit",
    summary: "救生員先拿 GPS，再拍照疊浮水印，上傳 Object Storage，最後寫入各 lifeguard_* table 與 audit log。",
    steps: ["GPS permission", "camera capture", "canvas watermark", "photo-upload BFF", "Object Storage + geocoding", "lifeguard table", "audit"],
    tables: ["lifeguard_water_quality_logs", "lifeguard_coach_dive_logs", "lifeguard_cleanup_logs", "lifeguard_lost_and_found", "audit_logs"],
    audit: ["LIFEGUARD_PHOTO_UPLOADED", "LIFEGUARD_*_CREATED"],
  },
  {
    id: "worklog-review-flow",
    title: "日誌模板到主管審核流",
    owner: "supervisor / lifeguard / counter",
    route: "/supervisor/counter-log/submissions",
    summary: "主管維護模板與指派，現場完成紀錄後送審，主管審核動作回寫 review actions。",
    steps: ["templates", "today task projection", "task completions", "daily report submission", "approve / return"],
    tables: ["daily_task_templates", "lifeguard_assigned_tasks", "recurring_task_templates", "work_log_task_completions", "daily_report_submissions", "work_log_review_actions"],
    audit: ["WORK_LOG_REVIEW_*"],
  },
  {
    id: "parking-flow",
    title: "停車場租約流",
    owner: "supervisor / counter",
    route: "/supervisor/parking",
    summary: "先建立車輛與方案，再建立租約；簽約與付款回報完成後由主管審核才更新效期。",
    steps: ["vehicle", "plan", "contract", "e-sign PDF", "payment report", "payment review", "expiry update"],
    tables: ["parking_vehicles", "parking_plans", "parking_contracts", "parking_payments", "parking_event_days"],
    audit: ["PARKING_*"],
  },
  {
    id: "courts-flow",
    title: "場地預約流",
    owner: "employee / supervisor / system",
    route: "/employee/courts/xinbei -> /supervisor/courts/xinbei",
    summary: "員工與主管共用場租視圖；手動、批次或 Google 同步都進 court_reservations，錯誤寫入 sync errors。",
    steps: ["school switch", "day/week/month/search views", "manual or batch edit", "sync logs", "audit"],
    tables: ["court_reservations", "court_sync_logs", "court_sync_errors", "audit_logs"],
    audit: ["COURT_RESERVATION_*", "COURT_SYNC_*"],
  },
  {
    id: "system-observer-flow",
    title: "IT 觀察與治理流",
    owner: "system",
    route: "/system",
    summary: "IT 端從 registry、health、audit、raw inspector 觀察模組接線，不直接接手業務資料所有權。",
    steps: ["module registry", "workbench routes", "module health", "audit logs", "raw inspector", "function relations"],
    tables: ["module_settings", "module_role_permissions", "audit_logs", "watchdog_events", "source_snapshots"],
    audit: ["PAGE_VIEW", "RAW_INSPECTOR_QUERY", "AUDIT_LOG_VIEW"],
  },
];

export const routeRelations: RouteRelation[] = [
  {
    role: "employee",
    title: "員工端",
    route: "/employee",
    modules: ["交辦事項", "今日家教預約 placeholder", "群組重要公告", "今日班表", "活動檔期", "常用文件", "場租查看", "個人工作貼"],
    source: "Employee home BFF + activeFacility",
  },
  {
    role: "lifeguard",
    title: "救生端",
    route: "/lifeguard",
    modules: ["水質檢測", "教練下水", "下班打掃", "水道事項", "失物招領", "水道租借狀態", "救生員日誌"],
    source: "Lifeguard operation modules + work-log bridge",
  },
  {
    role: "supervisor",
    title: "主管端",
    route: "/supervisor",
    modules: ["場館", "停車場", "櫃台日誌", "水道租借", "場地預約", "公告群組綁定", "救生紀錄總覽"],
    source: "Supervisor workbench route manifest",
  },
  {
    role: "system",
    title: "IT / 系統端",
    route: "/system",
    modules: ["系統總覽", "當前功能關係", "系統健康", "告警中心", "整合狀態", "Audit / Telemetry", "救生稽核", "Raw Inspector"],
    source: "Module registry + health + audit projections",
  },
];

export const statusLabels: Record<TableRelationChild["status"], string> = {
  active: "已接線",
  partial: "部分接線",
  planned: "預留",
};

export const roleToneClass: Record<RouteRelation["role"], string> = {
  employee: "bg-[#eaf8ef] text-[#007166]",
  lifeguard: "bg-[#eef5ff] text-[#2f6fe8]",
  supervisor: "bg-[#fff6e7] text-[#c06413]",
  system: "bg-[#f1efff] text-[#5d48c8]",
};
