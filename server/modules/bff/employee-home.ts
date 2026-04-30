import type { EmployeeHomeDto, SupervisorDashboardDto, SystemOverviewDto } from "@shared/domain/workbench";
import { env } from "../../shared/config/env";
import { ok, stale, unavailable } from "../../shared/bff/section";

const syncTime = new Date().toISOString();

export const getEmployeeHomeMock = (): EmployeeHomeDto => ({
  facility: {
    key: "xinbei-high-school",
    name: "新北高中游泳池 & 運動中心",
    businessDate: "2026年4月23日 星期四",
    statusLabel: "營運中",
  },
  weather: ok({
    temperatureC: 22,
    label: "多雲時晴",
    humidity: 68,
  }, syncTime),
  tasks: ok([
    { id: "task-1", title: "設備巡檢抽查", status: "pending", priority: "high" },
    { id: "task-2", title: "設備巡檢紀錄", status: "pending", priority: "high" },
    { id: "task-3", title: "課程教室準備", status: "in_progress", priority: "normal" },
    { id: "task-4", title: "櫃台收據整理", status: "done", priority: "normal" },
    { id: "task-5", title: "環境清潔檢查", status: "done", priority: "normal" },
  ], syncTime),
  announcements: ok([
    {
      id: "ann-1",
      title: "會員系統維護通知",
      summary: "4/25 22:00 起進行會員系統維護，櫃台需先確認報名資料。",
      priority: "required",
      effectiveRange: "4/25 22:00 - 4/26 02:00",
    },
    {
      id: "ann-2",
      title: "兒童游泳夏令營開始報名",
      summary: "報名期間 4/20 - 5/20，現場需引導家長完成表單。",
      priority: "high",
      effectiveRange: "4/20 - 5/20",
    },
  ], syncTime),
  handover: ok([], syncTime),
  shortcuts: ok([
    { id: "handover", label: "交辦事項", href: "/employee/handover", tone: "green" },
    { id: "cash", label: "匯款確認", href: "#cash", tone: "amber" },
    { id: "events", label: "活動 / 檔期", href: "#events", tone: "violet" },
    { id: "feedback", label: "設備回報", href: "#feedback", tone: "rose" },
    { id: "shift", label: "班表入口", href: "#shift", tone: "blue" },
    { id: "docs", label: "常用文件", href: "#docs", tone: "cyan" },
  ], syncTime),
  shifts: stale([
    { id: "shift-1", label: "早班", timeRange: "08:00 - 16:00", status: "active" },
    { id: "shift-2", label: "晚班", timeRange: "16:00 - 22:00", status: "upcoming" },
  ], syncTime, "排班系統正式來源尚未重連，暫以測試 projection 顯示"),
  campaigns: ok([
    { id: "camp-1", title: "兒童游泳分會優惠", statusLabel: "報名進行中", effectiveRange: "4/20 - 5/20" },
    { id: "camp-2", title: "成人游泳課開課", statusLabel: "即將開課", effectiveRange: "5/05 開課" },
  ], syncTime),
  documents: ok([
    { id: "system-checkins-link", title: "點名 / 報到", updatedAt: "系統入口", url: "/employee/checkins", description: "員工點名與報到入口", subCategory: "點名/報到", source: "system_link" },
    { id: "doc-1", title: "場館 SOP 手冊", updatedAt: "2026/04/10" },
    { id: "doc-2", title: "緊急應變流程", updatedAt: "2026/03/15" },
    { id: "doc-3", title: "設備檢修記錄表", updatedAt: "2026/04/01" },
  ], syncTime),
  stickyNotes: ok([], syncTime),
  training: ok([], syncTime),
});

export const getSupervisorDashboardMock = (): SupervisorDashboardDto => ({
  facility: {
    key: "xinbei-high-school",
    name: "新北高中游泳池 & 運動中心",
    businessDate: "2026/04/23",
    statusLabel: "台中館",
  },
  staffing: ok({ active: 12, total: 15, onShift: 12, absent: 3 }, syncTime),
  pendingAnomalies: ok([
    { id: "a-1", employeeName: "林小菁", issue: "遲到打卡", waitingMinutes: 15, priority: "high" },
    { id: "a-2", employeeName: "王大明", issue: "早退", waitingMinutes: 35, priority: "medium" },
    { id: "a-3", employeeName: "陳小華", issue: "未打卡", waitingMinutes: 0, priority: "medium" },
  ], syncTime),
  incompleteTasks: ok([
    { id: "t-1", title: "更新設備巡檢紀錄", status: "pending", priority: "high" },
    { id: "t-2", title: "活動場地佈置確認", status: "in_progress", priority: "high" },
    { id: "t-3", title: "救生員證照到期提醒", status: "pending", priority: "normal" },
    { id: "t-4", title: "櫃台交接資料確認", status: "done", priority: "normal" },
  ], syncTime),
  announcementAcks: ok({ unconfirmed: 7, totalRequired: 18 }, syncTime),
  handoverOverview: ok({ open: 32, confirmed: 18 }, syncTime),
  shifts: ok([
    { id: "s-1", label: "早班", timeRange: "08:00 - 16:00", status: "active" },
    { id: "s-2", label: "晚班", timeRange: "16:00 - 22:00", status: "upcoming" },
  ], syncTime),
  campaigns: ok([
    { id: "camp-1", title: "兒童游泳分會優惠", statusLabel: "夏令營泳訓課程", effectiveRange: "4/20 - 5/20" },
  ], syncTime),
});

export const getSystemOverviewMock = (): SystemOverviewDto => ({
  checkedAt: new Date().toISOString(),
  healthScore: ok({ score: 98.2, statusLabel: "健康" }, syncTime),
  metrics: ok([
    { label: "系統健康狀態", value: "98.2%", status: "ok", helper: "整體健康度" },
    { label: "API 成功率", value: "99.6%", status: "ok", helper: "過去 24 小時" },
    { label: "資料庫狀態", value: "正常", status: "ok", helper: "連線數 32" },
    { label: "告警服務狀態", value: "2 項異常", status: "critical", helper: "查看詳情" },
    { label: "今日活躍使用者", value: "248 人", status: "ok", helper: "較昨日 +12%" },
  ], syncTime),
  incidents: ok([
    { id: "i-1", title: "排班系統 API 連線失敗", time: "09:21", severity: "critical" },
    { id: "i-2", title: "Email 服務延遲偏高", time: "08:47", severity: "warning" },
    { id: "i-3", title: "Webhook 重試次數過多", time: "08:12", severity: "warning" },
  ], syncTime),
  integrationFailures: ok([
    { id: "f-1", title: "Ragic auth adapter 未接正式來源", time: "mock", severity: "info" },
    { id: "f-2", title: "Booking adapter 等待 Replit 重連", time: "mock", severity: "info" },
  ], syncTime),
  auditSummary: ok({ todayEvents: 248, rawInspectorQueries: 0 }, syncTime),
});

const integrationHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Internal-Token"] = token;
    headers["X-API-Key"] = token;
  }
  return headers;
};

const smartScheduleOverviewUrl = () => {
  const path = env.smartScheduleApiToken ? "/api/internal/admin/overview" : "/api/admin/overview";
  return new URL(path, env.smartScheduleBaseUrl).toString();
};

const fetchJson = async <T>(url: string, token?: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: integrationHeaders(token),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Non-JSON response");
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const getSupervisorDashboardFromSources = async (): Promise<SupervisorDashboardDto> => {
  const now = new Date().toISOString();
  const [announcementSummary, scheduleOverview] = await Promise.allSettled([
    fetchJson<Record<string, unknown>>(new URL("/api/announcement-dashboard/summary", env.lineBotBaseUrl).toString()),
    fetchJson<Record<string, unknown>>(smartScheduleOverviewUrl(), env.smartScheduleApiToken),
  ]);

  const announcementData = announcementSummary.status === "fulfilled" ? announcementSummary.value : null;
  const scheduleData = scheduleOverview.status === "fulfilled" ? scheduleOverview.value : null;
  const employees = scheduleData?.employees && typeof scheduleData.employees === "object"
    ? scheduleData.employees as Record<string, unknown>
    : {};
  const shiftsToday = scheduleData?.shiftsToday && typeof scheduleData.shiftsToday === "object"
    ? scheduleData.shiftsToday as Record<string, unknown>
    : {};
  const pendingReviewCount = Number(announcementData?.pendingReviewCount ?? 0);
  const activeUsers = Number(scheduleData?.activeUsers ?? scheduleData?.todayActiveUsers ?? employees.totalActive ?? 0);
  const totalUsers = Number(scheduleData?.totalUsers ?? employees.totalAll ?? activeUsers ?? 0);
  const onShift = Number(scheduleData?.onShift ?? shiftsToday.total ?? activeUsers ?? 0);

  return {
    facility: {
      key: "xinbei_pool",
      name: "駿斯營運管理",
      businessDate: new Date().toLocaleDateString("zh-TW"),
      statusLabel: "即時資料",
    },
    staffing: scheduleData
      ? ok({ active: activeUsers || 0, total: totalUsers || 0, onShift: onShift || 0, absent: Math.max((totalUsers || 0) - (activeUsers || 0), 0) }, now)
      : unavailable("Smart Schedule overview unavailable"),
    pendingAnomalies: ok([], now),
    incompleteTasks: ok([], now),
    announcementAcks: announcementData
      ? ok({ unconfirmed: pendingReviewCount, totalRequired: Number(announcementData.totalMessagesToday ?? pendingReviewCount) }, now)
      : unavailable("LINE Bot announcement summary unavailable"),
    handoverOverview: ok({ open: 0, confirmed: 0 }, now),
    shifts: ok([], now),
    campaigns: ok([], now),
  };
};

export const getSystemOverviewFromSources = async (): Promise<SystemOverviewDto> => {
  const now = new Date().toISOString();
  const checks = await Promise.allSettled([
    fetchJson<Record<string, unknown>>(new URL("/api/announcement-dashboard/summary", env.lineBotBaseUrl).toString()),
    fetchJson<Record<string, unknown>>(smartScheduleOverviewUrl(), env.smartScheduleApiToken),
  ]);
  const healthyCount = checks.filter((check) => check.status === "fulfilled").length;
  const score = Math.round((healthyCount / checks.length) * 1000) / 10;
  const failures = checks
    .map((check, index) => ({ check, label: index === 0 ? "LINE Bot Assistant" : "Smart Schedule Manager" }))
    .filter(({ check }) => check.status === "rejected")
    .map(({ check, label }, index) => ({
      id: `integration-${index}`,
      title: `${label} 連線失敗`,
      time: now.slice(11, 16),
      severity: "warning" as const,
    }));

  return {
    checkedAt: now,
    healthScore: ok({ score, statusLabel: score === 100 ? "健康" : "部分異常" }, now),
    metrics: ok([
      { label: "外部 API 健康度", value: `${score}%`, status: score === 100 ? "ok" : "warning", helper: "LINE Bot / Smart Schedule" },
      { label: "LINE Bot Assistant", value: checks[0].status === "fulfilled" ? "正常" : "異常", status: checks[0].status === "fulfilled" ? "ok" : "critical", helper: env.lineBotBaseUrl },
      { label: "Smart Schedule", value: checks[1].status === "fulfilled" ? "正常" : "異常", status: checks[1].status === "fulfilled" ? "ok" : "critical", helper: env.smartScheduleBaseUrl },
      { label: "資料庫模式", value: env.databaseProfile, status: env.databaseProfile === "mock" ? "warning" : "ok", helper: "DATABASE_PROFILE" },
      { label: "資料來源模式", value: env.dataSourceMode, status: env.dataSourceMode === "mock" ? "warning" : "ok", helper: "DATA_SOURCE_MODE" },
    ], now),
    incidents: ok(failures, now),
    integrationFailures: ok(failures, now),
    auditSummary: ok({ todayEvents: 0, rawInspectorQueries: 0 }, now),
  };
};
