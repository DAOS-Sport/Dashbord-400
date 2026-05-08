// Module topology — pure data definition driving the /system/topology page.
// Add new modules here to surface them on the diagram without touching UI code.

export type TopologyGroup = "external" | "admin" | "portal" | "infra";

export interface TopologyNodeDef {
  id: string;
  label: string;
  englishKey: string;
  group: TopologyGroup;
  description: string;
  path?: string;
  icon?: string;
}

export interface TopologyEdgeDef {
  source: string;
  target: string;
  label?: string;
}

export const topologyGroups: Record<TopologyGroup, { label: string; color: string; bg: string; border: string }> = {
  external: { label: "對外應用",       color: "#0d2a50", bg: "#dbeafe", border: "#3b82f6" },
  admin:    { label: "後台管理",       color: "#7c2d12", bg: "#fed7aa", border: "#ea580c" },
  portal:   { label: "員工入口",       color: "#14532d", bg: "#bbf7d0", border: "#16a34a" },
  infra:    { label: "系統基礎設施",   color: "#3f3f46", bg: "#e4e4e7", border: "#71717a" },
};

export const topologyNodes: TopologyNodeDef[] = [
  // 後台管理 admin
  { id: "dashboard",         label: "營運戰情總覽",      englishKey: "dashboard",          group: "admin",  description: "全館總覽與營運 KPI 儀表板", path: "/supervisor" },
  { id: "operations",        label: "跨館資源監控",      englishKey: "operations",         group: "admin",  description: "場館人力、資源、營運狀態", path: "/supervisor" },
  { id: "analytics",         label: "決策與數據洞察",    englishKey: "analytics",          group: "admin",  description: "進階分析與報表", path: "/supervisor/reports" },
  { id: "hr-audit",          label: "HR 與權限稽核",     englishKey: "hr-audit",           group: "admin",  description: "員工人事與權限變更稽核", path: "/hr-audit" },
  { id: "system-health",     label: "微服務健康監控",    englishKey: "system-health",      group: "admin",  description: "整合服務的健康指標", path: "/system-health" },
  { id: "anomaly-reports",   label: "打卡異常管理",      englishKey: "anomaly-reports",    group: "admin",  description: "異常打卡審核與處理", path: "/supervisor/anomalies" },
  { id: "announcements",     label: "公告審核中心",      englishKey: "announcements",      group: "admin",  description: "LINE 群公告分類與審核", path: "/supervisor/announcements" },
  { id: "announcement-groups", label: "公告群組綁定",     englishKey: "announcement-groups", group: "admin",  description: "場館與 LINE 群組綁定，供員工首頁讀取群組公告", path: "/supervisor/announcement-groups" },
  { id: "work-logs",         label: "救生員日誌",        englishKey: "work-logs",          group: "admin",  description: "每日固定/交辦/水質日誌", path: "/admin/work-logs/submissions" },
  { id: "counter-log",       label: "櫃台日誌",          englishKey: "counter-log",        group: "admin",  description: "櫃台日常作業記錄與審核", path: "/supervisor/counter-log/submissions" },
  { id: "lane-rentals",      label: "水道租借 (松山)",   englishKey: "lane-rentals",       group: "admin",  description: "松山館水道時段預訂管理（僅松山開放）", path: "/supervisor/lane-rentals" },
  { id: "parking",           label: "停車場戰情總覽",    englishKey: "parking",            group: "admin",  description: "停車場會員與租約全局指標", path: "/supervisor/parking" },
  { id: "parking-vehicles",  label: "停車場車輛管理",    englishKey: "parking-vehicles",   group: "admin",  description: "車牌、車主、分類與狀態維護", path: "/supervisor/parking/vehicles" },
  { id: "parking-plans",     label: "停車場方案",        englishKey: "parking-plans",      group: "admin",  description: "月租/季租/年租/會員/特約方案", path: "/supervisor/parking/plans" },
  { id: "parking-contracts", label: "停車場租約",        englishKey: "parking-contracts",  group: "admin",  description: "合約建立、簽約、終止、退款", path: "/supervisor/parking/contracts" },
  { id: "parking-payments",  label: "停車場付款審核",    englishKey: "parking-payments",   group: "admin",  description: "客戶回報付款的後台核准/拒絕", path: "/supervisor/parking/payments" },
  { id: "parking-event-days", label: "停車場活動日",      englishKey: "parking-event-days", group: "admin",  description: "活動日限制與提前通知內容", path: "/supervisor/parking/event-days" },
  { id: "courts",            label: "場地預約",          englishKey: "courts",             group: "admin",  description: "新北高中與三重商工場地預約 + Google Calendar 同步", path: "/supervisor/courts/xinbei" },
  { id: "topology",          label: "模組拓撲圖",        englishKey: "topology",           group: "admin",  description: "系統全景模組關係圖", path: "/system/topology" },

  // 員工入口 portal
  { id: "portal",            label: "員工入口",          englishKey: "portal",             group: "portal", description: "場館員工 LINE 內嵌入口", path: "/portal" },
  { id: "portal-handover",   label: "交班交接",          englishKey: "portal-handover",    group: "portal", description: "員工自助交班記錄", path: "/portal" },
  { id: "portal-shift",      label: "員工班表",          englishKey: "portal-shift",       group: "portal", description: "今日值班與打卡", path: "/portal" },

  // 對外應用 external
  { id: "linebot",           label: "LINE Bot",          englishKey: "linebot",            group: "external", description: "對外 LINE 訊息進入點", path: "/system/integrations" },

  // 系統基礎設施 infra
  { id: "postgres",          label: "PostgreSQL",        englishKey: "postgres",           group: "infra",  description: "業務資料持久化", path: "/system/health" },
  { id: "google-calendar",   label: "Google Calendar",   englishKey: "google-calendar",    group: "infra",  description: "場地預約來源（外部行事曆）", path: "/system/health" },
  { id: "ragic",             label: "Ragic",             englishKey: "ragic",              group: "infra",  description: "員工/排程/公告外部資料庫", path: "/system/integrations" },
  { id: "linebot-api",       label: "LINE Messaging API", englishKey: "linebot-api",       group: "infra",  description: "LINE 官方訊息收發", path: "/system/integrations" },
  { id: "line-bot-messages-api", label: "LINE Bot Messages API", englishKey: "line-bot-messages-api", group: "infra", description: "LINE Bot Assistant 管理訊息查詢 API", path: "/system/integrations" },
  { id: "schedule-api",      label: "Smart Schedule API", englishKey: "schedule-api",      group: "infra",  description: "智能排班服務", path: "/system/integrations" },
  { id: "gmail",             label: "Gmail",             englishKey: "gmail",              group: "infra",  description: "通知信件寄送", path: "/system/integrations" },
];

export const topologyEdges: TopologyEdgeDef[] = [
  // admin -> infra
  { source: "dashboard",       target: "postgres",     label: "讀取" },
  { source: "operations",      target: "postgres",     label: "讀取" },
  { source: "analytics",       target: "postgres",     label: "讀取" },
  { source: "hr-audit",        target: "ragic",        label: "員工資料" },
  { source: "hr-audit",        target: "postgres",     label: "稽核" },
  { source: "system-health",   target: "linebot-api",  label: "健康檢查" },
  { source: "system-health",   target: "schedule-api", label: "健康檢查" },
  { source: "system-health",   target: "ragic",        label: "健康檢查" },
  { source: "anomaly-reports", target: "postgres",     label: "存取" },
  { source: "announcements",   target: "linebot",      label: "分類" },
  { source: "announcements",   target: "postgres",     label: "存取" },
  { source: "announcement-groups", target: "postgres", label: "綁定" },
  { source: "announcement-groups", target: "line-bot-messages-api", label: "測試拉訊息" },
  { source: "work-logs",       target: "postgres",     label: "讀寫" },
  { source: "counter-log",     target: "postgres",     label: "讀寫" },
  { source: "lane-rentals",    target: "postgres",     label: "讀寫" },
  { source: "parking",           target: "postgres",   label: "彙整" },
  { source: "parking-vehicles",  target: "postgres",   label: "讀寫" },
  { source: "parking-plans",     target: "postgres",   label: "讀寫" },
  { source: "parking-contracts", target: "postgres",   label: "讀寫" },
  { source: "parking-payments",  target: "postgres",   label: "讀寫" },
  { source: "parking-event-days", target: "postgres",  label: "讀寫" },
  { source: "parking-payments",  target: "parking-contracts", label: "核准延約" },
  { source: "parking-contracts", target: "parking-vehicles",  label: "綁定車輛" },
  { source: "parking-contracts", target: "parking-plans",     label: "套用方案" },
  { source: "courts",            target: "postgres",          label: "讀寫" },
  { source: "courts",            target: "google-calendar",   label: "同步" },

  // external -> admin / infra
  { source: "linebot",         target: "linebot-api",  label: "Webhook" },
  { source: "linebot",         target: "ragic",        label: "查員工" },

  // portal -> infra / admin
  { source: "portal",          target: "ragic",        label: "員工驗證" },
  { source: "portal",          target: "postgres",     label: "讀寫" },
  { source: "portal",          target: "announcement-groups", label: "群組公告" },
  { source: "portal",          target: "line-bot-messages-api", label: "讀取公告" },
  { source: "portal-handover", target: "postgres",     label: "讀寫" },
  { source: "portal-shift",    target: "schedule-api", label: "班表" },
  { source: "portal",          target: "lane-rentals", label: "讀取今日表" },

  // 通知
  { source: "anomaly-reports", target: "gmail",        label: "通知" },
  { source: "announcements",   target: "gmail",        label: "通知" },
];
