export type HelperServiceCategory = "external_call" | "public_endpoint" | "environment" | "resilience";

export interface HelperExternalService {
  name: string;
  purpose: string;
  callMethod: string;
  credentialKeys: string[];
  notes?: string;
}

export interface HelperEndpoint {
  path: string;
  method: string;
  description: string;
  auth: string;
}

export interface HelperEnvGroup {
  title: string;
  variables: Array<{
    name: string;
    description: string;
    defaultValue?: string;
    required?: boolean;
  }>;
}

export interface HelperResilienceRule {
  service: string;
  strategy: string;
}

export const helperExternalServices: readonly HelperExternalService[] = [
  { name: "LINE Messaging API", purpose: "發送訊息、查詢用戶資訊、查詢群組資訊", callMethod: "@line/bot-sdk SDK", credentialKeys: ["CHANNEL_ACCESS_TOKEN", "CHANNEL_SECRET"], notes: "webhook 簽章驗證用 CHANNEL_SECRET" },
  { name: "OpenAI API", purpose: "任務萃取、勵志語、水質分析、AI 智能客服", callMethod: "openai SDK", credentialKeys: ["OPENAI_API_KEY"], notes: "模型 gpt-4o-mini；使用 chat completions" },
  { name: "Google Gemini REST API", purpose: "公告分類 5 層管線 Pass 2", callMethod: "fetch generativelanguage.googleapis.com", credentialKeys: ["GEMINI_API_KEY"], notes: "預設 gemini-2.5-flash-lite，可用 ANNOUNCEMENT_CLASSIFIER_MODEL 覆蓋" },
  { name: "中央氣象署開放資料平台", purpose: "風力預報、天氣資訊、UV 指數", callMethod: "fetch", credentialKeys: ["CWA_API_KEY"], notes: "opendata.cwa.gov.tw API" },
  { name: "Ragic", purpose: "員工資料查詢、慎用名單查詢", callMethod: "fetch", credentialKeys: ["RAGIC_API_KEY", "RAGIC_CAUTION_API_KEY", "RAGIC_DOMAIN", "RAGIC_DATABASE_ID", "RAGIC_USERNAME"], notes: "ap7.ragic.com" },
  { name: "體育署救生員查詢", purpose: "救生員證照資格查詢", callMethod: "Node.js https + cheerio", credentialKeys: [], notes: "公開查詢；目前以 rejectUnauthorized=false 處理 SSL 鏈問題" },
  { name: "Google Apps Script 客滿調查", purpose: "接收 SurveyCake 滿意度問卷資料", callMethod: "POST /api/survey-webhook", credentialKeys: ["SURVEY_WEBHOOK_TOKEN"], notes: "由 Apps Script onSheetChange trigger 推送" },
  { name: "外部儀表板 webhook", purpose: "推送服務健康快照", callMethod: "fetch POST", credentialKeys: ["DASHBOARD_WEBHOOK_URL", "DASHBOARD_WEBHOOK_SECRET"], notes: "空白停用；簽名 header X-Hub-Signature-256" },
];

export const helperEndpoints: readonly HelperEndpoint[] = [
  { path: "/webhook", method: "POST", description: "LINE 事件 webhook", auth: "LINE 簽章 CHANNEL_SECRET" },
  { path: "/api/survey-webhook", method: "POST", description: "Google Apps Script 問卷 webhook", auth: "SURVEY_WEBHOOK_TOKEN Bearer" },
  { path: "/health", method: "GET", description: "服務存活探針", auth: "無" },
  { path: "/api/admin/*", method: "GET/POST/PATCH/DELETE", description: "管理後台 API", auth: "ADMIN_TOKEN 或 ADMIN_USER/ADMIN_PASS" },
  { path: "/api/admin/announcements/health", method: "GET", description: "公告管線健康", auth: "Admin auth" },
  { path: "/api/admin/announcements/replay", method: "POST", description: "重播訊息管線", auth: "Admin auth" },
  { path: "/api/admin/whitelist/*", method: "GET/POST/PATCH/DELETE", description: "公告 VIP 白名單 CRUD", auth: "Admin auth" },
  { path: "/api/bff/system/line-whitelist", method: "GET/POST/PATCH", description: "400 LINE 功能白名單管理", auth: "System session" },
  { path: "/api/internal/line-whitelist/check", method: "GET", description: "LINE webhook 查詢功能授權", auth: "INTERNAL_API_TOKEN Bearer" },
  { path: "/api/admin/service-status", method: "GET", description: "服務健康即時查詢", auth: "Admin auth" },
  { path: "/api/admin/service-status/push", method: "POST", description: "手動推送健康快照到外部 webhook", auth: "Admin auth" },
  { path: "/api/facility-home/*", method: "GET", description: "館別值班首頁 API", auth: "無" },
  { path: "/api/internal/*", method: "GET", description: "工作台 BFF 內部 API", auth: "INTERNAL_API_TOKEN Bearer" },
];

export const helperEnvGroups: readonly HelperEnvGroup[] = [
  {
    title: "必要",
    variables: [
      { name: "DATABASE_URL", description: "PostgreSQL 連線字串", required: true },
      { name: "CHANNEL_ACCESS_TOKEN", description: "LINE Bot 存取金鑰", required: true },
      { name: "CHANNEL_SECRET", description: "LINE webhook 簽章驗證密鑰", required: true },
    ],
  },
  {
    title: "核心功能",
    variables: [
      { name: "OPENAI_API_KEY", description: "OpenAI API 金鑰" },
      { name: "GEMINI_API_KEY", description: "Google Gemini API 金鑰" },
      { name: "CWA_API_KEY", description: "中央氣象署開放資料平台金鑰" },
      { name: "RAGIC_API_KEY", description: "Ragic 員工查詢 API 金鑰" },
      { name: "RAGIC_CAUTION_API_KEY", description: "Ragic 慎用名單 API 金鑰" },
      { name: "RAGIC_DOMAIN", description: "Ragic 網域" },
      { name: "RAGIC_DATABASE_ID", description: "Ragic 資料庫 ID" },
      { name: "RAGIC_USERNAME", description: "Ragic 帳號" },
    ],
  },
  {
    title: "認證",
    variables: [
      { name: "ADMIN_TOKEN", description: "管理後台 Bearer token" },
      { name: "ADMIN_USER", description: "管理後台 Basic auth 帳號" },
      { name: "ADMIN_PASS", description: "管理後台 Basic auth 密碼" },
      { name: "INTERNAL_API_TOKEN", description: "工作台 BFF Bearer token" },
      { name: "SURVEY_WEBHOOK_TOKEN", description: "問卷 webhook 驗證 token" },
    ],
  },
  {
    title: "行為調整",
    variables: [
      { name: "SUPERVISOR_USER_IDS", description: "主管 LINE User ID fallback" },
      { name: "ANNOUNCEMENT_CLASSIFIER_MODEL", description: "Gemini 模型切換", defaultValue: "gemini-2.5-flash-lite" },
      { name: "ANNOUNCEMENT_STRICT_STRONG_KEYWORDS", description: "強關鍵字嚴格模式", defaultValue: "false" },
      { name: "ANNOUNCEMENT_STRICT_NORMAL_PHRASES", description: "一般公告短語模式", defaultValue: "false" },
      { name: "ANNOUNCEMENT_AI_MIN_CONFIDENCE", description: "AI 信心門檻", defaultValue: "0.55" },
      { name: "TZ", description: "時區", defaultValue: "Asia/Taipei" },
    ],
  },
  {
    title: "服務監聽",
    variables: [
      { name: "DASHBOARD_WEBHOOK_URL", description: "外部儀表板推送 URL" },
      { name: "DASHBOARD_WEBHOOK_SECRET", description: "webhook HMAC-SHA256 金鑰" },
      { name: "DASHBOARD_HEARTBEAT_INTERVAL_MS", description: "心跳推送間隔", defaultValue: "300000" },
    ],
  },
];

export const helperResilienceRules: readonly HelperResilienceRule[] = [
  { service: "LINE API", strategy: "失敗記錄到 outgoing_messages，status=failed，不影響 webhook 處理" },
  { service: "OpenAI API", strategy: "try/catch；失敗回傳空結果或略過 AI 功能；429 時主動切換 Gemini" },
  { service: "Gemini API", strategy: "AbortController 8 秒 timeout；失敗 log + pipeline stats 記錄" },
  { service: "CWA API", strategy: "fetch timeout 10 秒；失敗時回傳氣象資料暫時無法取得" },
  { service: "Ragic", strategy: "Promise.all 並行查詢，各自獨立 try/catch；失敗顯示錯誤訊息" },
  { service: "體育署救生員", strategy: "try/catch；SSL rejectUnauthorized=false；超時 fallback" },
  { service: "公告白名單 DB", strategy: "DB 查詢失敗時 fallback 到 announcementConfig.ts 的 VIP_USERS" },
  { service: "400 LINE 功能白名單", strategy: "CMS 不刪除授權紀錄；使用 status、featureAccess 與期限判斷是否允許功能" },
  { service: "Dashboard Webhook", strategy: "fetch timeout 8 秒；失敗寫入 service_health_snapshots，不影響主流程" },
];
