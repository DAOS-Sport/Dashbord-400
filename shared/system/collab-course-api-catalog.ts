export type CollabCourseApiAuth = "public" | "coach-token" | "admin";

export type CollabCourseApiCatalogCategory =
  | "system-overview"
  | "public-catalog"
  | "schedule-query"
  | "coach-portal"
  | "admin-master-data"
  | "admin-schedule"
  | "admin-coaches"
  | "notifications-sync"
  | "it-governance";

export type CollabCourseApiCatalogEndpoint = {
  id: string;
  category: CollabCourseApiCatalogCategory;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  label: string;
  auth: CollabCourseApiAuth;
};

export const collabCourseApiCategoryLabels: Record<CollabCourseApiCatalogCategory, string> = {
  "system-overview": "系統總覽",
  "public-catalog": "公開資料",
  "schedule-query": "課表查詢 / 衝突",
  "coach-portal": "教練前台",
  "admin-master-data": "管理端：場館資料",
  "admin-schedule": "管理端：課表操作",
  "admin-coaches": "管理端：教練帳號",
  "notifications-sync": "推播 / Ragic 同步",
  "it-governance": "IT 治理 / 週推播",
};

export const collabCourseApiAuthLabels: Record<CollabCourseApiAuth, string> = {
  public: "公開",
  "coach-token": "教練 Token",
  admin: "管理員",
};

export const collabCourseApiCatalog: CollabCourseApiCatalogEndpoint[] = [
  { id: "auth-line-status", category: "system-overview", method: "GET", path: "/api/auth/line/status", label: "LINE 登入設定狀態", auth: "public" },
  { id: "deployment-test", category: "system-overview", method: "GET", path: "/api/deployment-test", label: "系統健康檢查", auth: "public" },
  { id: "venues", category: "public-catalog", method: "GET", path: "/api/venues", label: "場館清單", auth: "public" },
  { id: "venue-infos", category: "public-catalog", method: "GET", path: "/api/venue-infos", label: "場館說明 / 地圖 / 影片", auth: "public" },
  { id: "time-slots", category: "public-catalog", method: "GET", path: "/api/time-slots", label: "全域時段定義", auth: "public" },
  { id: "coaches", category: "public-catalog", method: "GET", path: "/api/coaches", label: "教練姓名清單", auth: "public" },
  { id: "approved-coaches", category: "public-catalog", method: "GET", path: "/api/approved-coaches", label: "已核准教練清單", auth: "public" },
  { id: "schedules-range", category: "schedule-query", method: "GET", path: "/api/schedules", label: "課表依日期範圍", auth: "public" },
  { id: "schedules-date", category: "schedule-query", method: "GET", path: "/api/schedules/:date", label: "特定日期所有課程", auth: "public" },
  { id: "schedules-vacant", category: "schedule-query", method: "GET", path: "/api/schedules/vacant", label: "未指派教練課程", auth: "public" },
  { id: "conflicts-date", category: "schedule-query", method: "GET", path: "/api/conflicts/:date", label: "排課衝突偵測", auth: "public" },
  { id: "statistics", category: "schedule-query", method: "GET", path: "/api/statistics", label: "教練堂數統計", auth: "public" },
  { id: "coach-me", category: "coach-portal", method: "GET", path: "/api/coach-portal/me/:identifier", label: "教練個人資料", auth: "coach-token" },
  { id: "coach-schedule", category: "coach-portal", method: "GET", path: "/api/coach-portal/my-schedule", label: "教練個人課表", auth: "coach-token" },
  { id: "coach-colleagues", category: "coach-portal", method: "GET", path: "/api/coach-portal/colleagues", label: "同場館同事", auth: "coach-token" },
  { id: "coach-availability-read", category: "coach-portal", method: "GET", path: "/api/coach-portal/availability", label: "個人可用時段", auth: "coach-token" },
  { id: "coach-availability-save", category: "coach-portal", method: "POST", path: "/api/coach-portal/availability", label: "儲存可用時段", auth: "coach-token" },
  { id: "coach-venue-preferences-read", category: "coach-portal", method: "GET", path: "/api/coach-portal/venue-preferences", label: "個人場館偏好", auth: "coach-token" },
  { id: "coach-venue-preferences-save", category: "coach-portal", method: "POST", path: "/api/coach-portal/venue-preferences", label: "儲存場館偏好", auth: "coach-token" },
  { id: "coach-register", category: "coach-portal", method: "POST", path: "/api/coach-portal/register", label: "申請新教練帳號", auth: "public" },
  { id: "admin-venues-create", category: "admin-master-data", method: "POST", path: "/api/admin/venues", label: "新增場館", auth: "admin" },
  { id: "admin-venues-delete", category: "admin-master-data", method: "DELETE", path: "/api/admin/venues/:id", label: "刪除場館", auth: "admin" },
  { id: "admin-venue-infos-update", category: "admin-master-data", method: "PUT", path: "/api/admin/venue-infos/:venueName", label: "更新場館詳細資訊", auth: "admin" },
  { id: "schedules-upsert", category: "admin-schedule", method: "POST", path: "/api/schedules", label: "新增或更新課程", auth: "public" },
  { id: "schedules-lock", category: "admin-schedule", method: "POST", path: "/api/schedules/lock", label: "鎖定課表", auth: "admin" },
  { id: "schedules-unlock", category: "admin-schedule", method: "POST", path: "/api/schedules/unlock", label: "解鎖課表", auth: "admin" },
  { id: "schedules-copy-week", category: "admin-schedule", method: "POST", path: "/api/schedules/copy-week", label: "複製整週課表", auth: "admin" },
  { id: "schedules-assign-coach", category: "admin-schedule", method: "PUT", path: "/api/schedules/:id/assign-coach", label: "指派教練", auth: "admin" },
  { id: "schedules-delete", category: "admin-schedule", method: "DELETE", path: "/api/schedules/:id", label: "刪除課程", auth: "admin" },
  { id: "admin-coach-users", category: "admin-coaches", method: "GET", path: "/api/admin/coach-users", label: "教練帳號清單", auth: "admin" },
  { id: "admin-coach-user-status", category: "admin-coaches", method: "PUT", path: "/api/admin/coach-users/:id/status", label: "核准或退回教練", auth: "admin" },
  { id: "admin-coach-fillrate", category: "admin-coaches", method: "GET", path: "/api/admin/coach-fillrate", label: "教練填寫率儀表板", auth: "admin" },
  { id: "admin-verify-password", category: "admin-coaches", method: "POST", path: "/api/admin/verify-password", label: "驗證管理密碼", auth: "admin" },
  { id: "admin-send-weekly", category: "notifications-sync", method: "POST", path: "/api/admin/send-weekly-notifications", label: "觸發週推播", auth: "admin" },
  { id: "admin-notify-daily", category: "notifications-sync", method: "POST", path: "/api/admin/notify-daily", label: "觸發明日提醒", auth: "admin" },
  { id: "admin-notify-logs", category: "notifications-sync", method: "GET", path: "/api/admin/notify-logs", label: "推播歷史紀錄", auth: "admin" },
  { id: "admin-ragic-status", category: "notifications-sync", method: "GET", path: "/api/admin/ragic-status", label: "Ragic 同步狀態", auth: "admin" },
  { id: "admin-ragic-sync", category: "notifications-sync", method: "POST", path: "/api/admin/ragic-sync", label: "手動觸發 Ragic 同步", auth: "admin" },
  { id: "admin-it-governance", category: "it-governance", method: "GET", path: "/api/admin/it-governance", label: "IT 治理總覽", auth: "admin" },
  { id: "weekly-push-enqueue", category: "it-governance", method: "POST", path: "/api/admin/weekly-push/enqueue", label: "排入週推播工作", auth: "admin" },
  { id: "weekly-push-runs", category: "it-governance", method: "GET", path: "/api/admin/weekly-push/runs", label: "推播執行紀錄", auth: "admin" },
  { id: "weekly-push-run-detail", category: "it-governance", method: "GET", path: "/api/admin/weekly-push/runs/:runId", label: "單次執行詳情", auth: "admin" },
  { id: "weekly-push-run-report", category: "it-governance", method: "GET", path: "/api/admin/weekly-push/runs/:runId/report", label: "下載推播報告", auth: "admin" },
  { id: "weekly-push-retry-failed", category: "it-governance", method: "POST", path: "/api/admin/weekly-push/runs/:runId/retry-failed", label: "重試失敗收件人", auth: "admin" },
];
