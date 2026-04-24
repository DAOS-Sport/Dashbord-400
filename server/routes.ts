import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { corsMiddleware } from "./app/http/cors";
import { registerNewArchitectureRoutes } from "./app/http/register-routes";
import { env } from "./shared/config/env";
import type { OperationalHandover } from "@shared/schema";
import { findFacilityLineGroup, findScheduleRegionKey } from "@shared/domain/facilities";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "anomaly-reports");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);

const readScheduleText = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value.trim() : fallback);

const readScheduleNestedText = (value: unknown, keys: string[], fallback = "") => {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  for (const key of keys) {
    const text = readScheduleText(row[key]);
    if (text) return text;
  }
  return fallback;
};

const inferShiftLabelFromStart = (startsAt: string) => {
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) return "";
  const hour = parsed.getHours();
  if (hour >= 16) return "晚班";
  if (hour >= 12) return "中班";
  return "早班";
};

const resolveOperationalHandoverAssignee = async (input: {
  facilityKey: string;
  targetDate: string;
  targetShiftLabel: string;
}): Promise<{ assigneeEmployeeNumber: string | null; assigneeName: string | null; scheduleRawId?: string; matchedBy?: string; confidence?: number }> => {
  if (!env.smartScheduleBaseUrl || !env.smartScheduleApiToken) return { assigneeEmployeeNumber: null, assigneeName: null };
  const url = new URL("/api/internal/export/snapshot", env.smartScheduleBaseUrl);
  url.searchParams.set("facilityKey", findScheduleRegionKey(input.facilityKey));
  url.searchParams.set("from", input.targetDate);
  url.searchParams.set("to", input.targetDate);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${env.smartScheduleApiToken}`,
    "X-Internal-Token": env.smartScheduleApiToken,
    "X-API-Key": env.smartScheduleApiToken,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return { assigneeEmployeeNumber: null, assigneeName: null };
    const payload = await response.json() as Record<string, unknown>;
    const facility = findFacilityLineGroup(input.facilityKey);
    const rows = Array.isArray(payload.schedules) ? payload.schedules : [];
    const matched = rows
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      .find((row) => {
        const venue = row.venue && typeof row.venue === "object" ? row.venue as Record<string, unknown> : {};
        const shift = row.shift && typeof row.shift === "object" ? row.shift as Record<string, unknown> : {};
        const assignment = row.assignment && typeof row.assignment === "object" ? row.assignment as Record<string, unknown> : {};
        const venueNames = [
          readScheduleText(venue.name),
          readScheduleText(venue.shortName),
          ...((Array.isArray(venue.aliases) ? venue.aliases : []) as unknown[]).map((item) => readScheduleText(item)),
        ].filter(Boolean);
        const start = readScheduleText(shift.startAt);
        const period = readScheduleText(shift.period, inferShiftLabelFromStart(start));
        const label = `${readScheduleText(shift.label)} ${readScheduleText(shift.name)} ${period}`;
        const sameFacility = !facility || venueNames.length === 0 || venueNames.some((name) => [facility.shortName, facility.fullName, ...facility.ragicDepartmentAliases].some((alias) => name.includes(alias) || alias.includes(name)));
        const active = ["", "scheduled", "changed", "completed"].includes(readScheduleText(assignment.status));
        return active && sameFacility && (
          label.includes(input.targetShiftLabel) ||
          (input.targetShiftLabel.includes("早") && period === "early") ||
          (input.targetShiftLabel.includes("中") && period === "mid") ||
          (input.targetShiftLabel.includes("晚") && period === "late")
        );
      });
    if (!matched) return { assigneeEmployeeNumber: null, assigneeName: null };
    const employee = matched.employee && typeof matched.employee === "object" ? matched.employee as Record<string, unknown> : {};
    return {
      assigneeEmployeeNumber: readScheduleText(employee.employeeNumber) || null,
      assigneeName: readScheduleText(employee.name) || null,
      scheduleRawId: readScheduleText(matched.rawId),
      matchedBy: "date+facility+period",
      confidence: 0.9,
    };
  } catch {
    return { assigneeEmployeeNumber: null, assigneeName: null };
  } finally {
    clearTimeout(timeout);
  }
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `anomaly-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype) && !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("僅允許上傳圖片檔案 (jpg, png, gif, webp, heic)"));
    }
    cb(null, true);
  },
});

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function formatReportText(data: any): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  let text = `!!!打卡異常報告!!!\n報告時間：${timeStr}\n`;
  text += `異常類型：${data.context || "未指定"}\n`;

  if (data.employee) {
    text += `\n【員工資訊】\n`;
    text += `姓名：${data.employee.name || "未知"}\n`;
    text += `員工編號：${data.employee.employeeCode || "未知"}\n`;
    text += `職位：${data.employee.role || "未知"}\n`;
  }

  if (data.clockResult) {
    text += `\n【打卡紀錄】\n`;
    text += `狀態：${data.clockResult.status || "未知"}\n`;
    text += `類型：${data.clockResult.clockType === "in" ? "上班打卡" : data.clockResult.clockType === "out" ? "下班打卡" : data.clockResult.clockType || "未知"}\n`;
    text += `日期：${data.clockResult.date || "未知"}\n`;
    text += `時間：${data.clockResult.time || "未知"}\n`;
    text += `場館：${data.clockResult.venueName || "未知"}\n`;
    text += `距離：${data.clockResult.distance ?? "未知"}m\n`;
    text += `允許半徑：${data.clockResult.radius ?? "未知"}m\n`;
    text += `失敗原因：${data.clockResult.failReason || "無"}\n`;
  }

  if (data.errorMsg) {
    text += `\n錯誤訊息：${data.errorMsg}\n`;
  }

  if (data.userNote) {
    text += `\n用戶備註：${data.userNote}\n`;
  }

  return text;
}

async function getRecipientEmails(type: "newReport" | "resolution"): Promise<string[]> {
  const recipients = await storage.getAllRecipients();
  const filtered = recipients
    .filter((r) => r.enabled && (type === "newReport" ? r.notifyNewReport : r.notifyResolution))
    .map((r) => r.email);
  if (filtered.length > 0) return filtered;
  const fallback = process.env.GMAIL_USER;
  if (fallback) {
    console.log("[Gmail] 無設定收件者，使用發件信箱作為預設收件者:", fallback);
    return [fallback];
  }
  return [];
}

async function sendAnomalyEmail(reportText: string, data: any) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[Gmail] 未設定 GMAIL 帳號密碼，跳過寄信");
    return;
  }

  const toEmails = await getRecipientEmails("newReport");
  if (toEmails.length === 0) {
    console.log("[Gmail] 無啟用的新異常通知收件者，跳過寄信");
    return;
  }

  const employeeName = data.employee?.name || "未知員工";
  const employeeCode = data.employee?.employeeCode || "—";
  const role = data.employee?.role || "—";
  const venueName = data.clockResult?.venueName || "未知場館";
  const clockTime = data.clockResult?.time || "—";
  const clockDate = data.clockResult?.date || "—";
  const failReason = data.clockResult?.failReason || data.errorMsg || "未知原因";

  const subject = `🚨 員工打卡異常 — ${employeeName}（${venueName}）`;

  const text = `員工打卡異常\n\n姓名：${employeeName}\n員工編號：${employeeCode}\n職位：${role}\n場館：${venueName}\n時間：${clockDate} ${clockTime}\n原因：${failReason}\n\n詳細請至 https://group-dashboard.replit.app 查看`;

  try {
    await transporter.sendMail({
      from: `"DAOS 異常監控系統" <${process.env.GMAIL_USER}>`,
      to: toEmails.join(", "),
      subject,
      text,
    });
    console.log("[Gmail] 異常報告郵件已發送至:", toEmails.join(", "));
  } catch (err: any) {
    console.error("[Gmail] 寄信失敗:", err.message);
  }
}

async function sendResolutionEmail(report: any, resolution: string, resolvedNote: string | null) {
  const transporter = createTransporter();
  if (!transporter) return;

  const toEmails = await getRecipientEmails("resolution");
  if (toEmails.length === 0) return;

  const employeeName = report.employeeName || "未知員工";
  const venueName = report.venueName || "未知場館";
  const statusText = resolution === "resolved" ? "✅ 已處理" : "🔄 改為待解決";
  const subject = `${statusText} — ${employeeName}（${venueName}）打卡異常 #${report.id}`;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  let text = `打卡異常處理通知\n`;
  text += `處理時間：${timeStr}\n`;
  text += `狀態變更：${statusText}\n\n`;
  text += `【異常報告 #${report.id}】\n`;
  text += `員工姓名：${employeeName}\n`;
  text += `員工編號：${report.employeeCode || "—"}\n`;
  text += `場館：${venueName}\n`;
  text += `異常類型：${report.context || "—"}\n`;
  text += `打卡時間：${report.clockTime || "—"}\n`;
  text += `失敗原因：${report.failReason || "—"}\n`;
  if (resolvedNote) text += `\n處理備註：${resolvedNote}\n`;

  try {
    await transporter.sendMail({
      from: `"DAOS 異常監控系統" <${process.env.GMAIL_USER}>`,
      to: toEmails.join(", "),
      subject,
      text,
    });
    console.log("[Gmail] 處理狀態通知已發送至:", toEmails.join(", "));
  } catch (err: any) {
    console.error("[Gmail] 寄信失敗:", err.message);
  }
}

async function sendBatchResolutionEmail(reports: any[], resolution: string, resolvedNote: string | null) {
  const transporter = createTransporter();
  if (!transporter) return;

  const toEmails = await getRecipientEmails("resolution");
  if (toEmails.length === 0) return;

  const statusText = resolution === "resolved" ? "✅ 批量已處理" : "🔄 批量改為待解決";
  const subject = `${statusText} — 共 ${reports.length} 筆打卡異常`;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  let text = `打卡異常批量處理通知\n`;
  text += `處理時間：${timeStr}\n`;
  text += `狀態變更：${statusText}\n`;
  text += `處理數量：${reports.length} 筆\n`;
  if (resolvedNote) text += `處理備註：${resolvedNote}\n`;
  text += `\n${"─".repeat(40)}\n`;

  reports.forEach((r) => {
    text += `\n【#${r.id}】${r.employeeName || "未知員工"} — ${r.venueName || "未知場館"}\n`;
    text += `  異常類型：${r.context || "—"}\n`;
    text += `  打卡時間：${r.clockTime || "—"}\n`;
    text += `  失敗原因：${r.failReason || "—"}\n`;
  });

  try {
    await transporter.sendMail({
      from: `"DAOS 異常監控系統" <${process.env.GMAIL_USER}>`,
      to: toEmails.join(", "),
      subject,
      text,
    });
    console.log("[Gmail] 批量處理通知已發送至:", toEmails.join(", "));
  } catch (err: any) {
    console.error("[Gmail] 寄信失敗:", err.message);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(corsMiddleware);

  registerNewArchitectureRoutes(httpServer, app);

  app.use("/uploads", (await import("express")).default.static(path.join(process.cwd(), "uploads")));

  app.post("/api/anomaly-report", upload.fields([
    { name: "images", maxCount: 5 },
    { name: "image", maxCount: 5 },
    { name: "files", maxCount: 5 },
    { name: "file", maxCount: 5 },
    { name: "photo", maxCount: 5 },
    { name: "photos", maxCount: 5 },
  ]), async (req, res) => {
    try {
      console.log("[anomaly-report] Content-Type:", req.headers["content-type"]);
      console.log("[anomaly-report] Body keys:", Object.keys(req.body || {}));
      console.log("[anomaly-report] Body:", JSON.stringify(req.body, null, 2));
      console.log("[anomaly-report] Files:", req.files ? Object.keys(req.files) : "none");

      let data: any;
      if (req.is("multipart/form-data")) {
        const raw = req.body?.data || req.body?.json || req.body?.payload;
        if (raw && typeof raw === "string") {
          data = JSON.parse(raw);
        } else {
          data = req.body || {};
        }
      } else {
        data = req.body || {};
      }

      if (!data.context) {
        return res.status(400).json({ message: "缺少必填欄位: context" });
      }

      const filesMap = (req.files as Record<string, Express.Multer.File[]>) || {};
      const allFiles: Express.Multer.File[] = Object.values(filesMap).flat();
      console.log("[anomaly-report] Total files received:", allFiles.length, allFiles.map(f => f.fieldname + ":" + f.originalname));
      const imageUrls = allFiles.map((f) => `/uploads/anomaly-reports/${f.filename}`);

      const reportText = formatReportText(data);

      const clockResult = data.clockResult || {};
      const employee = data.employee || {};

      const report = await storage.createAnomalyReport({
        employeeId: employee.id ?? null,
        employeeName: employee.name ?? null,
        employeeCode: employee.employeeCode ?? null,
        role: employee.role ?? null,
        lineUserId: employee.lineUserId ?? null,
        context: data.context,
        clockStatus: clockResult.status ?? null,
        clockType: clockResult.clockType ?? null,
        clockTime: clockResult.date && clockResult.time ? `${clockResult.date} ${clockResult.time}` : null,
        venueName: clockResult.venueName ?? null,
        distance: clockResult.distance != null ? `${clockResult.distance}m` : null,
        failReason: clockResult.failReason ?? null,
        errorMsg: data.errorMsg ?? data.error_msg ?? null,
        userNote: data.userNote ?? data.user_note ?? data.note ?? data.remark ?? data.message ?? data.description ?? null,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        reportText,
      });

      sendAnomalyEmail(reportText, data).catch(() => {});

      res.status(200).json({
        id: report.id,
        reportText: report.reportText,
        createdAt: report.createdAt,
        imageUrls: report.imageUrls || [],
        lineUrl: "https://lin.ee/TupPc0V",
      });
    } catch (err: any) {
      console.error("[anomaly-report] Error:", err);
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  const EXTERNAL_API = "https://smart-schedule-manager.replit.app";

  async function fetchExternalReports(): Promise<any[]> {
    try {
      const resp = await fetch(`${EXTERNAL_API}/api/anomaly-reports`);
      if (!resp.ok) return [];
      const data = await resp.json() as any[];
      return data.map((r: any) => ({
        ...r,
        id: `ext-${r.id}`,
        source: "external",
        imageUrls: r.imageUrls?.map((url: string) =>
          url.startsWith("http") ? url : `${EXTERNAL_API}${url}`
        ) || null,
      }));
    } catch (err) {
      console.error("[external-api] Failed to fetch:", (err as Error).message);
      return [];
    }
  }

  app.get("/api/anomaly-reports", async (_req, res) => {
    try {
      const [localReports, externalReports] = await Promise.all([
        storage.getAllAnomalyReports(),
        fetchExternalReports(),
      ]);
      const local = localReports.map((r) => ({ ...r, source: "local" }));
      const merged = [...local, ...externalReports].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json(merged);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.get("/api/anomaly-reports/:id", async (req, res) => {
    try {
      const rawId = req.params.id;
      if (rawId.startsWith("ext-")) {
        const extId = rawId.replace("ext-", "");
        const resp = await fetch(`${EXTERNAL_API}/api/anomaly-reports/${extId}`);
        if (!resp.ok) return res.status(404).json({ message: "找不到此異常報告" });
        const data = await resp.json() as any;
        data.id = `ext-${data.id}`;
        data.source = "external";
        if (data.imageUrls) {
          data.imageUrls = data.imageUrls.map((url: string) =>
            url.startsWith("http") ? url : `${EXTERNAL_API}${url}`
          );
        }
        return res.json(data);
      }
      const id = parseInt(rawId, 10);
      if (isNaN(id)) return res.status(400).json({ message: "無效的 ID" });
      const report = await storage.getAnomalyReportById(id);
      if (!report) return res.status(404).json({ message: "找不到此異常報告" });
      res.json({ ...report, source: "local" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.patch("/api/anomaly-reports/:id/resolution", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "無效的 ID" });

      const { resolution, resolvedNote } = req.body || {};
      if (!resolution || !["pending", "resolved"].includes(resolution)) {
        return res.status(400).json({ message: "resolution 必須為 'pending' 或 'resolved'" });
      }

      const updated = await storage.updateAnomalyReportResolution(id, resolution, resolvedNote ?? null);
      if (!updated) return res.status(404).json({ message: "找不到此異常報告" });

      sendResolutionEmail(updated, resolution, resolvedNote ?? null).catch(() => {});

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.patch("/api/anomaly-reports/batch/resolution", async (req, res) => {
    try {
      const { ids, resolution, resolvedNote } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids 必須為非空陣列" });
      }
      if (!resolution || !["pending", "resolved"].includes(resolution)) {
        return res.status(400).json({ message: "resolution 必須為 'pending' 或 'resolved'" });
      }
      const count = await storage.batchUpdateResolution(ids, resolution, resolvedNote ?? null);

      const reports = await Promise.all(ids.map((id: number) => storage.getAnomalyReportById(id)));
      const validReports = reports.filter(Boolean);
      if (validReports.length > 0) {
        sendBatchResolutionEmail(validReports, resolution, resolvedNote ?? null).catch(() => {});
      }

      res.json({ updated: count });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.delete("/api/anomaly-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "無效 ID" });
      const deleted = await storage.deleteAnomalyReport(id);
      if (!deleted) return res.status(404).json({ message: "找不到此異常報告" });
      res.json({ success: true, deletedId: id });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.post("/api/test-email", async (_req, res) => {
    try {
      const transporter = createTransporter();
      if (!transporter) {
        return res.status(500).json({ success: false, message: "未設定 GMAIL_USER 或 GMAIL_APP_PASSWORD 環境變數" });
      }

      const toEmails = await getRecipientEmails("newReport");
      if (toEmails.length === 0) {
        return res.status(400).json({ success: false, message: "無收件者（也沒有 GMAIL_USER 可做預設）" });
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timeStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const subject = `✅ DAOS 郵件通知測試 — ${timeStr}`;
      const text = `這是一封測試郵件，用於確認 DAOS 異常監控系統的郵件通知功能正常運作。\n\n發送時間：${timeStr}\n發件信箱：${process.env.GMAIL_USER}\n收件者：${toEmails.join(", ")}\n\n如果你收到這封信，代表郵件通知功能正常！`;

      await transporter.sendMail({
        from: `"DAOS 異常監控系統" <${process.env.GMAIL_USER}>`,
        to: toEmails.join(", "),
        subject,
        text,
      });

      console.log("[Gmail] 測試郵件已發送至:", toEmails.join(", "));
      res.json({ success: true, message: `測試郵件已發送至: ${toEmails.join(", ")}` });
    } catch (err: any) {
      console.error("[Gmail] 測試郵件發送失敗:", err.message);
      res.status(500).json({ success: false, message: `寄信失敗: ${err.message}` });
    }
  });

  app.get("/api/notification-recipients", async (_req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      res.json(recipients);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.post("/api/notification-recipients", async (req, res) => {
    try {
      const { email, label, enabled, notifyNewReport, notifyResolution } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ message: "請提供有效的 email" });
      }
      const recipient = await storage.createRecipient({
        email,
        label: label || null,
        enabled: enabled !== false,
        notifyNewReport: notifyNewReport !== false,
        notifyResolution: notifyResolution !== false,
      });
      res.status(201).json(recipient);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.patch("/api/notification-recipients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "無效的 ID" });
      const allowedFields = ["email", "label", "enabled", "notifyNewReport", "notifyResolution"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) sanitized[key] = req.body[key];
      }
      if (sanitized.email !== undefined && (typeof sanitized.email !== "string" || !sanitized.email.includes("@"))) {
        return res.status(400).json({ message: "請提供有效的 email" });
      }
      const updated = await storage.updateRecipient(id, sanitized);
      if (!updated) return res.status(404).json({ message: "找不到此收件者" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  app.delete("/api/notification-recipients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "無效的 ID" });
      const deleted = await storage.deleteRecipient(id);
      if (!deleted) return res.status(404).json({ message: "找不到此收件者" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "伺服器內部錯誤" });
    }
  });

  // Ragic 員工資料表 (xinsheng/ragicforms4/13)
  // where 查詢用 numeric FID，response 用中文 caption key
  // FID 對照：
  //   3000935 = 員工編號 (主鍵)
  //   3001424 = 手機（主表唯一手機欄位）
  //   3000933 = 姓名
  //   3000937 = 部門 (回傳 string[])
  //   3000939 = 職稱
  //   3000945 = 在職狀態
  const RAGIC_QUERY_FID = {
    employeeNumber: "3000935",
  } as const;
  const RAGIC_KEY = {
    employeeNumber: "員工編號",
    name: "姓名",
    mobile: "手機",
    department: "部門",
    title: "職稱",
    status: "在職狀態",
  } as const;

  function normalizePhone(p: string | undefined): string {
    return String(p || "").trim().replace(/[-\s()]/g, "");
  }

  // ---- Ragic employee lookup with 5-min cache (used by login + supervisor authz) ----
  type EmployeeProfile = { employeeNumber: string; name: string; title: string; department?: string; status: string; mobile: string; isSupervisor: boolean };
  const employeeCache = new Map<string, { value: EmployeeProfile | null; expiresAt: number }>();
  const EMPLOYEE_CACHE_TTL_MS = 5 * 60 * 1000;

  async function lookupEmployee(employeeNumber: string): Promise<EmployeeProfile | null> {
    const key = employeeNumber.trim();
    if (!key) return null;
    const cached = employeeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const ragicApiKey = process.env.RAGIC_API_KEY;
    const ragicHost = process.env.RAGIC_HOST || "ap7.ragic.com";
    const ragicAccountPath = process.env.RAGIC_ACCOUNT_PATH || "xinsheng";
    const ragicSheetPath = process.env.RAGIC_EMPLOYEE_SHEET || "/ragicforms4/13";
    if (!ragicApiKey) return null;

    const url = `https://${ragicHost}/${ragicAccountPath}${ragicSheetPath}?api&where=${RAGIC_QUERY_FID.employeeNumber},eq,${encodeURIComponent(key)}`;
    try {
      const upstream = await fetch(url, {
        headers: { Authorization: `Basic ${ragicApiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) return null;
      const data = (await upstream.json()) as Record<string, Record<string, string>>;
      const entries = Object.values(data || {});
      if (entries.length === 0) {
        employeeCache.set(key, { value: null, expiresAt: Date.now() + EMPLOYEE_CACHE_TTL_MS });
        return null;
      }
      const e = entries[0] as Record<string, unknown>;
      const department = e[RAGIC_KEY.department];
      const departmentStr = Array.isArray(department) ? department.join(", ") : (department as string | undefined);
      const title = String(e[RAGIC_KEY.title] || "");
      const profile: EmployeeProfile = {
        employeeNumber: String(e[RAGIC_KEY.employeeNumber] || key),
        name: String(e[RAGIC_KEY.name] || key),
        title,
        department: departmentStr || undefined,
        status: String(e[RAGIC_KEY.status] || "").trim(),
        mobile: normalizePhone(e[RAGIC_KEY.mobile] as string | undefined),
        isSupervisor: /主管|經理|組長|店長|館長|總監|協理|副理|副總/.test(title),
      };
      employeeCache.set(key, { value: profile, expiresAt: Date.now() + EMPLOYEE_CACHE_TTL_MS });
      return profile;
    } catch (err) {
      console.error("[lookupEmployee] error:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  async function resolveCaller(req: import("express").Request): Promise<EmployeeProfile | null> {
    if (req.workbenchSession) {
      return {
        employeeNumber: req.workbenchSession.userId,
        name: req.workbenchSession.displayName,
        title: req.workbenchSession.grantedRoles.includes("system") ? "系統管理員" : req.workbenchSession.grantedRoles.includes("supervisor") ? "主管" : "員工",
        status: "在職",
        mobile: "",
        isSupervisor: req.workbenchSession.grantedRoles.includes("supervisor") || req.workbenchSession.grantedRoles.includes("system"),
      };
    }
    const empNum = (req.headers["x-employee-number"] as string) || "";
    if (!empNum) return null;
    return await lookupEmployee(empNum);
  }

  function requireSupervisor(): import("express").RequestHandler {
    return async (req, res, next) => {
      const caller = await resolveCaller(req);
      if (!caller) return res.status(401).json({ message: "未授權：請重新登入" });
      if (caller.status && caller.status !== "在職") return res.status(403).json({ message: "員工已離職" });
      if (!caller.isSupervisor) return res.status(403).json({ message: "需主管權限" });
      (req as unknown as { caller: EmployeeProfile }).caller = caller;
      next();
    };
  }

  function requireEmployee(): import("express").RequestHandler {
    return async (req, res, next) => {
      const caller = await resolveCaller(req);
      if (!caller) return res.status(401).json({ message: "未授權：請重新登入" });
      if (caller.status && caller.status !== "在職") return res.status(403).json({ message: "員工已離職" });
      (req as unknown as { caller: EmployeeProfile }).caller = caller;
      next();
    };
  }

  app.post("/api/auth/ragic-login", async (req, res) => {
    try {
      const { employeeNumber, phone } = (req.body || {}) as { employeeNumber?: string; phone?: string };
      if (!employeeNumber || !phone) {
        return res.status(400).json({ message: "請提供員工編號和手機號碼" });
      }

      const ragicApiKey = process.env.RAGIC_API_KEY;
      const ragicHost = process.env.RAGIC_HOST || "ap7.ragic.com";
      const ragicAccountPath = process.env.RAGIC_ACCOUNT_PATH || "xinsheng";
      const ragicSheetPath = process.env.RAGIC_EMPLOYEE_SHEET || "/ragicforms4/13";

      if (!ragicApiKey) {
        console.log("[ragic-login] RAGIC_API_KEY not set");
        return res.status(503).json({
          message: "Ragic API 尚未設定，請聯繫管理員設定 RAGIC_API_KEY",
        });
      }

      // Force fresh lookup (skip cache) for login
      employeeCache.delete(employeeNumber.trim());
      const profile = await lookupEmployee(employeeNumber.trim());
      if (!profile) {
        return res.status(401).json({ message: "查無此員工編號或無法連線 Ragic" });
      }

      const inputPhone = normalizePhone(phone);
      if (!profile.mobile || inputPhone !== profile.mobile) {
        return res.status(401).json({ message: "手機號碼不正確" });
      }

      if (profile.status && profile.status !== "在職") {
        return res.status(403).json({ message: `員工狀態為「${profile.status}」，無法登入` });
      }

      res.json({
        employeeNumber: profile.employeeNumber,
        name: profile.name,
        role: profile.title || undefined,
        department: profile.department,
        status: profile.status || undefined,
        isSupervisor: profile.isSupervisor,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "登入驗證失敗";
      console.error("[ragic-login] Error:", message);
      res.status(500).json({ message });
    }
  });

  app.post("/api/hr-audit", async (req, res) => {
    res.status(503).json({
      message: "稽核 API 尚未接入，待體育署 API 與 Ragic 慎用名單介接完成後即可使用",
    });
  });

  const LINE_BOT_BASE = env.lineBotBaseUrl;
  const SMART_SCHEDULE_BASE = env.smartScheduleBaseUrl;

  function proxyHeaders(upstreamUrl: string, jsonBody = false) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (jsonBody) headers["Content-Type"] = "application/json";
    const token = upstreamUrl.startsWith(LINE_BOT_BASE)
      ? env.lineBotInternalToken
      : upstreamUrl.startsWith(SMART_SCHEDULE_BASE)
        ? env.smartScheduleApiToken
        : undefined;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Internal-Token"] = token;
      headers["X-API-Key"] = token;
    }
    return headers;
  }

  function lineBotFacilityUrl(groupId: string, path: string) {
    const prefix = env.lineBotInternalToken ? "/api/internal/facility-home" : "/api/facility-home";
    return `${LINE_BOT_BASE}${prefix}/${encodeURIComponent(groupId)}${path}`;
  }

  async function proxyGet(upstreamUrl: string, res: any, label: string) {
    try {
      const upstream = await fetch(upstreamUrl, {
        headers: proxyHeaders(upstreamUrl),
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ message: `${label} 回傳 HTTP ${upstream.status}` });
      }
      const ct = upstream.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return res.status(502).json({ message: `${label} 未回傳 JSON` });
      }
      const data = await upstream.json();
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ message: err.message || `無法連線至${label}` });
    }
  }

  async function proxyPost(upstreamUrl: string, body: any, res: any, label: string) {
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: proxyHeaders(upstreamUrl, true),
        body: JSON.stringify(body || {}),
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        const errBody = await upstream.text().catch(() => "");
        return res.status(upstream.status).json({ message: errBody || `${label} 回傳 HTTP ${upstream.status}` });
      }
      const ct = upstream.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return res.status(502).json({ message: `${label} 未回傳 JSON` });
      }
      const data = await upstream.json();
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ message: err.message || `無法連線至${label}` });
    }
  }

  app.get("/api/announcement-dashboard/summary", (req, res) =>
    proxyGet(`${LINE_BOT_BASE}/api/announcement-dashboard/summary`, res, "公告摘要")
  );

  app.get("/api/announcement-candidates", (req, res) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    proxyGet(`${LINE_BOT_BASE}/api/announcement-candidates${qsStr ? "?" + qsStr : ""}`, res, "公告候選列表");
  });

  app.get("/api/announcement-candidates/:id", (req, res) =>
    proxyGet(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}`, res, "公告詳情")
  );

  app.post("/api/announcement-candidates/:id/approve", (req, res) =>
    proxyPost(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}/approve`, req.body, res, "核准公告")
  );

  app.post("/api/announcement-candidates/:id/reject", (req, res) =>
    proxyPost(`${LINE_BOT_BASE}/api/announcement-candidates/${req.params.id}/reject`, req.body, res, "退回公告")
  );

  app.get("/api/announcement-reports/weekly", (req, res) =>
    proxyGet(`${LINE_BOT_BASE}/api/announcement-reports/weekly`, res, "週報")
  );

  // ===== Portal facility-home proxies =====
  app.get("/api/facility-home/:groupId/home", (req, res) =>
    proxyGet(lineBotFacilityUrl(req.params.groupId, "/home"), res, "場館首頁資料")
  );

  app.get("/api/facility-home/:groupId/announcements", (req, res) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    proxyGet(
      `${lineBotFacilityUrl(req.params.groupId, "/announcements")}${qsStr ? "?" + qsStr : ""}`,
      res,
      "場館公告列表",
    );
  });

  app.get("/api/facility-home/:groupId/announcements/:id", (req, res) =>
    proxyGet(
      lineBotFacilityUrl(req.params.groupId, `/announcements/${encodeURIComponent(req.params.id)}`),
      res,
      "場館公告詳情",
    )
  );

  app.get("/api/facility-home/:groupId/today-shift", (req, res) =>
    proxyGet(lineBotFacilityUrl(req.params.groupId, "/today-shift"), res, "今日班表")
  );

  app.get("/api/facility-home/:groupId/handover", (req, res) =>
    proxyGet(lineBotFacilityUrl(req.params.groupId, "/handover"), res, "櫃台交接")
  );

  app.post("/api/facility-home/:groupId/announcements/:id/ack", (req, res) =>
    proxyPost(
      lineBotFacilityUrl(req.params.groupId, `/announcements/${encodeURIComponent(req.params.id)}/ack`),
      req.body,
      res,
      "回報已讀",
    )
  );

  const EXPORT_DIR = path.join(process.cwd(), "exports");
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  app.get("/api/announcement-candidates/export/all", async (_req, res) => {
    try {
      const PAGE_SIZE = 100;
      let allItems: any[] = [];
      let page = 1;
      let totalFromApi = 0;

      while (true) {
        const upstream = await fetch(
          `${LINE_BOT_BASE}/api/announcement-candidates?pageSize=${PAGE_SIZE}&page=${page}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
        );
        if (!upstream.ok) {
          return res.status(upstream.status).json({ message: `上游回傳 HTTP ${upstream.status} (page ${page})` });
        }
        const raw: any = await upstream.json();
        const items: any[] = raw.items || raw.candidates || [];
        totalFromApi = raw.total || totalFromApi;
        allItems = allItems.concat(items);

        if (items.length < PAGE_SIZE || allItems.length >= totalFromApi) break;
        page++;
        if (page > 50) break;
      }

      const mapCandidate = (c: any) => ({
        id: c.id,
        status: c.status,
        candidateType: c.candidateType,
        title: c.title,
        summary: c.summary,
        originalText: c.originalText,
        confidence: c.confidence,
        reasoningTags: c.reasoningTags,
        recommendedAction: c.recommendedAction,
        recommendedReply: c.recommendedReply,
        badExample: c.badExample,
        appliesToRoles: c.appliesToRoles,
        scopeType: c.scopeType,
        facilityName: c.facilityName,
        groupId: c.groupId,
        displayName: c.displayName,
        userId: c.userId,
        isFromSupervisor: c.isFromSupervisor,
        startAt: c.startAt,
        endAt: c.endAt,
        detectedAt: c.detectedAt,
        sourceMessageId: c.sourceMessageId,
        extractedJson: c.extractedJson,
      });

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedAtTaipei: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
        totalFromApi,
        totalExported: allItems.length,
        pagesfetched: page,
        candidates: allItems.map(mapCandidate),
      };

      const filePath = path.join(EXPORT_DIR, "announcement-candidates-export.json");
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), "utf-8");

      res.json({
        success: true,
        message: `已匯出全部 ${allItems.length}/${totalFromApi} 筆公告候選資料`,
        filePath: "/exports/announcement-candidates-export.json",
        exportedAt: exportData.exportedAt,
        totalFromApi,
        totalExported: allItems.length,
        pagesFetched: page,
      });
    } catch (err: any) {
      res.status(502).json({ message: err.message || "匯出失敗" });
    }
  });

  app.get("/exports/:filename", (req, res) => {
    const filePath = path.join(EXPORT_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "檔案不存在" });
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/api/admin/overview", (_req, res) =>
    proxyGet(
      `${SMART_SCHEDULE_BASE}${env.smartScheduleApiToken ? "/api/internal/admin/overview" : "/api/admin/overview"}`,
      res,
      "排班系統總覽",
    )
  );

  app.get("/api/admin/interview-users", (_req, res) =>
    proxyGet(`${SMART_SCHEDULE_BASE}/api/admin/interview-users`, res, "面試授權用戶")
  );

  // -------- Portal: Handover (員工 KEY) --------
  app.get("/api/portal/handovers", async (req, res) => {
    try {
      const facilityKey = String(req.query.facilityKey || "");
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const items = await storage.listHandovers(facilityKey, limit);
      res.json({ items });
    } catch (err) {
      const m = err instanceof Error ? err.message : "查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/handovers", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertHandoverEntrySchema } = await import("@shared/schema");
      // Force author identity from authenticated caller (do not trust body)
      const parsed = insertHandoverEntrySchema.safeParse({
        ...(req.body || {}),
        authorEmployeeNumber: caller.employeeNumber,
        authorName: caller.name,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const created = await storage.createHandover(parsed.data);
      // 也順便記一筆 portal event
      await storage.recordPortalEvent({
        employeeNumber: parsed.data.authorEmployeeNumber || null,
        employeeName: parsed.data.authorName || null,
        facilityKey: parsed.data.facilityKey,
        eventType: "handover_create",
        target: String(created.id),
        targetLabel: parsed.data.content.slice(0, 50),
        metadata: null,
      });
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/handovers/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const entry = await storage.getHandoverById(id);
      if (!entry) return res.status(404).json({ message: "找不到資料" });
      if (!caller.isSupervisor && entry.authorEmployeeNumber !== caller.employeeNumber) {
        return res.status(403).json({ message: "僅作者或主管可刪除" });
      }
      const ok = await storage.deleteHandover(id);
      if (!ok) return res.status(404).json({ message: "找不到資料" });
      res.json({ ok: true });
    } catch (err) {
      const m = err instanceof Error ? err.message : "刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  const operationalHandoverCreateBodySchema = z.object({
    facilityKey: z.string().min(1),
    title: z.string().min(1).max(120),
    content: z.string().min(1).max(2000),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetShiftLabel: z.string().min(1),
    visibleFrom: z.string().datetime().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    assigneeEmployeeNumber: z.string().optional().nullable(),
    assigneeName: z.string().optional().nullable(),
    linkedActionType: z.string().optional().nullable(),
    linkedActionUrl: z.string().url().optional().nullable(),
  });

  const operationalHandoverPatchBodySchema = z.object({
    title: z.string().min(1).max(120).optional(),
    content: z.string().min(1).max(2000).optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    status: z.enum(["pending", "claimed", "in_progress", "reported", "done", "cancelled"]).optional(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetShiftLabel: z.string().min(1).optional(),
    visibleFrom: z.string().datetime().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    assigneeEmployeeNumber: z.string().optional().nullable(),
    assigneeName: z.string().optional().nullable(),
    linkedActionType: z.string().optional().nullable(),
    linkedActionUrl: z.string().url().optional().nullable(),
  });

  const operationalHandoverReportBodySchema = z.object({
    status: z.enum(["claimed", "in_progress", "reported", "done"]).default("reported"),
    reportNote: z.string().max(2000).optional().nullable(),
  });

  const toDateOrNull = (value: string | null | undefined) => value ? new Date(value) : null;

  const canAccessFacility = (req: import("express").Request, facilityKey: string) =>
    !req.workbenchSession || req.workbenchSession.grantedFacilities.includes(facilityKey);

  const mapOperationalHandoverForResponse = (handover: OperationalHandover) => ({
    ...handover,
    visibleFrom: handover.visibleFrom?.toISOString?.() ?? handover.visibleFrom,
    dueAt: handover.dueAt?.toISOString?.() ?? handover.dueAt,
    completedAt: handover.completedAt?.toISOString?.() ?? handover.completedAt,
    createdAt: handover.createdAt?.toISOString?.() ?? handover.createdAt,
    updatedAt: handover.updatedAt?.toISOString?.() ?? handover.updatedAt,
  });

  // -------- Portal: Operational Handovers / 交班交接 --------
  app.get("/api/portal/operational-handovers", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const requestedFacilityKey = req.query.facilityKey ? String(req.query.facilityKey) : req.workbenchSession?.activeFacility;
      if (!requestedFacilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      if (!caller.isSupervisor && !canAccessFacility(req, requestedFacilityKey)) {
        return res.status(403).json({ message: "無此館別權限" });
      }
      const items = await storage.listOperationalHandovers({
        facilityKey: requestedFacilityKey,
        status: req.query.status ? String(req.query.status) : undefined,
        targetDate: req.query.targetDate ? String(req.query.targetDate) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ items: items.map(mapOperationalHandoverForResponse) });
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/operational-handovers", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const parsed = operationalHandoverCreateBodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      if (!canAccessFacility(req, parsed.data.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const resolvedAssignee = parsed.data.assigneeEmployeeNumber || parsed.data.assigneeName
        ? { assigneeEmployeeNumber: parsed.data.assigneeEmployeeNumber ?? null, assigneeName: parsed.data.assigneeName ?? null }
        : await resolveOperationalHandoverAssignee({
          facilityKey: parsed.data.facilityKey,
          targetDate: parsed.data.targetDate,
          targetShiftLabel: parsed.data.targetShiftLabel,
        });
      const created = await storage.createOperationalHandover({
        facilityKey: parsed.data.facilityKey,
        title: parsed.data.title,
        content: parsed.data.content,
        priority: parsed.data.priority,
        status: "pending",
        targetDate: parsed.data.targetDate,
        targetShiftLabel: parsed.data.targetShiftLabel,
        visibleFrom: toDateOrNull(parsed.data.visibleFrom),
        dueAt: toDateOrNull(parsed.data.dueAt),
        assigneeEmployeeNumber: resolvedAssignee.assigneeEmployeeNumber,
        assigneeName: resolvedAssignee.assigneeName,
        createdByEmployeeNumber: caller.employeeNumber,
        createdByName: caller.name,
        linkedActionType: parsed.data.linkedActionType ?? null,
        linkedActionUrl: parsed.data.linkedActionUrl ?? null,
      });
      await storage.recordPortalEvent({
        employeeNumber: caller.employeeNumber,
        employeeName: caller.name,
        facilityKey: parsed.data.facilityKey,
        eventType: "handover_create",
        target: String(created.id),
        targetLabel: created.title,
        metadata: JSON.stringify({
          targetDate: created.targetDate,
          targetShiftLabel: created.targetShiftLabel,
          autoAssigned: Boolean(resolvedAssignee.assigneeEmployeeNumber || resolvedAssignee.assigneeName),
          scheduleRawId: resolvedAssignee.scheduleRawId,
          matchedBy: resolvedAssignee.matchedBy,
          confidence: resolvedAssignee.confidence,
        }),
      });
      res.status(201).json(mapOperationalHandoverForResponse(created));
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/operational-handovers/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getOperationalHandoverById(id);
      if (!existing) return res.status(404).json({ message: "找不到交班交接" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const parsed = operationalHandoverPatchBodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const updated = await storage.updateOperationalHandover(id, {
        ...parsed.data,
        visibleFrom: parsed.data.visibleFrom === undefined ? undefined : toDateOrNull(parsed.data.visibleFrom),
        dueAt: parsed.data.dueAt === undefined ? undefined : toDateOrNull(parsed.data.dueAt),
        completedAt: parsed.data.status === "done" ? new Date() : undefined,
      });
      res.json(updated ? mapOperationalHandoverForResponse(updated) : null);
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/operational-handovers/:id/report", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getOperationalHandoverById(id);
      if (!existing) return res.status(404).json({ message: "找不到交班交接" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const parsed = operationalHandoverReportBodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const updated = await storage.updateOperationalHandover(id, {
        status: parsed.data.status,
        reportNote: parsed.data.reportNote ?? null,
        claimedByEmployeeNumber: parsed.data.status === "claimed" ? caller.employeeNumber : undefined,
        claimedByName: parsed.data.status === "claimed" ? caller.name : undefined,
        reportedByEmployeeNumber: caller.employeeNumber,
        reportedByName: caller.name,
        completedAt: parsed.data.status === "done" ? new Date() : null,
      });
      await storage.recordPortalEvent({
        employeeNumber: caller.employeeNumber,
        employeeName: caller.name,
        facilityKey: existing.facilityKey,
        eventType: parsed.data.status === "claimed" ? "handover_claim" : "handover_report",
        target: String(existing.id),
        targetLabel: existing.title,
        metadata: JSON.stringify({ status: parsed.data.status }),
      });
      res.json(updated ? mapOperationalHandoverForResponse(updated) : null);
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接回報失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/operational-handovers/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getOperationalHandoverById(id);
      if (!existing) return res.status(404).json({ message: "找不到交班交接" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const ok = await storage.deleteOperationalHandover(id);
      res.json({ ok });
    } catch (err) {
      const m = err instanceof Error ? err.message : "交班交接刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  // -------- Portal: Widget Layout Settings --------
  app.get("/api/portal/layout-settings", requireEmployee(), async (req, res) => {
    try {
      const facilityKey = String(req.query.facilityKey || req.workbenchSession?.activeFacility || "");
      const role = String(req.query.role || "employee");
      const layoutKey = String(req.query.layoutKey || "employee-home");
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      if (!canAccessFacility(req, facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const setting = await storage.getWidgetLayout({ facilityKey, role, layoutKey });
      res.json({
        facilityKey,
        role,
        layoutKey,
        widgets: normalizeWidgetLayout(setting?.widgets, defaultEmployeeHomeWidgets),
        updatedAt: setting?.updatedAt ?? null,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "版面設定查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/layout-settings", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const bodySchema = z.object({
        facilityKey: z.string().min(1),
        role: z.enum(["employee", "supervisor", "system"]).default("employee"),
        layoutKey: z.string().min(1).default("employee-home"),
        widgets: z.array(z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          area: z.string().min(1),
          enabled: z.boolean(),
          size: z.enum(["wide", "card"]),
          sortOrder: z.number().int(),
        })),
      });
      const parsed = bodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      if (!canAccessFacility(req, parsed.data.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const saved = await storage.upsertWidgetLayout({
        ...parsed.data,
        widgets: normalizeWidgetLayout(parsed.data.widgets, defaultEmployeeHomeWidgets),
        updatedByEmployeeNumber: caller.employeeNumber,
        updatedByName: caller.name,
      });
      await storage.recordPortalEvent({
        employeeNumber: caller.employeeNumber,
        employeeName: caller.name,
        facilityKey: parsed.data.facilityKey,
        eventType: "layout_update",
        target: parsed.data.layoutKey,
        targetLabel: `${parsed.data.role}:${parsed.data.layoutKey}`,
        metadata: JSON.stringify({ widgetCount: parsed.data.widgets.length }),
      });
      res.json(saved);
    } catch (err) {
      const m = err instanceof Error ? err.message : "版面設定儲存失敗";
      res.status(500).json({ message: m });
    }
  });

  // -------- Portal: Quick Links (主管維護) --------
  app.get("/api/portal/quick-links", async (req, res) => {
    try {
      const facilityKey = req.query.facilityKey ? String(req.query.facilityKey) : undefined;
      const includeInactive = req.query.includeInactive === "true";
      const items = await storage.listQuickLinks(facilityKey, includeInactive);
      res.json({ items });
    } catch (err) {
      const m = err instanceof Error ? err.message : "查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/quick-links", requireSupervisor(), async (req, res) => {
    try {
      const { insertQuickLinkSchema } = await import("@shared/schema");
      const parsed = insertQuickLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const created = await storage.createQuickLink(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/quick-links/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const updated = await storage.updateQuickLink(id, req.body || {});
      if (!updated) return res.status(404).json({ message: "找不到資料" });
      res.json(updated);
    } catch (err) {
      const m = err instanceof Error ? err.message : "更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/quick-links/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const ok = await storage.deleteQuickLink(id);
      if (!ok) return res.status(404).json({ message: "找不到資料" });
      res.json({ ok: true });
    } catch (err) {
      const m = err instanceof Error ? err.message : "刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  // -------- Portal: Employee Resources (員工自建活動 / 文件 / 便利貼) --------
  app.get("/api/portal/employee-resources", requireEmployee(), async (req, res) => {
    try {
      const facilityKey = String(req.query.facilityKey || req.workbenchSession?.activeFacility || "");
      const category = req.query.category ? String(req.query.category) : undefined;
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      if (!canAccessFacility(req, facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const items = await storage.listEmployeeResources({ facilityKey, category, limit: req.query.limit ? Number(req.query.limit) : 100 });
      res.json({ items });
    } catch (err) {
      const m = err instanceof Error ? err.message : "員工資源查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/employee-resources", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertEmployeeResourceSchema } = await import("@shared/schema");
      const parsed = insertEmployeeResourceSchema.safeParse({
        ...req.body,
        createdByEmployeeNumber: caller.employeeNumber,
        createdByName: caller.name,
      });
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      if (!canAccessFacility(req, parsed.data.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const created = await storage.createEmployeeResource(parsed.data);
      await storage.recordPortalEvent({
        employeeNumber: caller.employeeNumber,
        employeeName: caller.name,
        facilityKey: parsed.data.facilityKey,
        eventType: "resource_create",
        target: String(created.id),
        targetLabel: `${created.category}:${created.title}`,
        metadata: JSON.stringify({ category: created.category }),
      });
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "員工資源建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/employee-resources/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = (await storage.listEmployeeResources({ limit: 300 })).find((item) => item.id === id);
      if (!existing) return res.status(404).json({ message: "找不到員工資源" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const canEdit = existing.createdByEmployeeNumber === caller.employeeNumber || caller.isSupervisor;
      if (!canEdit) return res.status(403).json({ message: "只能編輯自己建立的資料" });
      const patchSchema = z.object({
        title: z.string().min(1).max(120).optional(),
        content: z.string().max(1000).nullable().optional(),
        url: z.string().url().nullable().optional(),
        isPinned: z.boolean().optional(),
      });
      const parsed = patchSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const updated = await storage.updateEmployeeResource(id, parsed.data);
      res.json(updated);
    } catch (err) {
      const m = err instanceof Error ? err.message : "員工資源更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/employee-resources/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = (await storage.listEmployeeResources({ limit: 300 })).find((item) => item.id === id);
      if (!existing) return res.status(404).json({ message: "找不到員工資源" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const canDelete = existing.createdByEmployeeNumber === caller.employeeNumber || caller.isSupervisor;
      if (!canDelete) return res.status(403).json({ message: "只能刪除自己建立的資料" });
      const ok = await storage.deleteEmployeeResource(id);
      res.json({ ok });
    } catch (err) {
      const m = err instanceof Error ? err.message : "員工資源刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  // -------- Portal: System Announcements (主管維護) --------
  app.get("/api/portal/system-announcements", async (req, res) => {
    try {
      const facilityKey = req.query.facilityKey ? String(req.query.facilityKey) : undefined;
      const includeInactive = req.query.includeInactive === "true";
      const items = await storage.listSystemAnnouncements(facilityKey, includeInactive);
      res.json({ items });
    } catch (err) {
      const m = err instanceof Error ? err.message : "查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/system-announcements", requireSupervisor(), async (req, res) => {
    try {
      const { insertSystemAnnouncementSchema } = await import("@shared/schema");
      const parsed = insertSystemAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const created = await storage.createSystemAnnouncement(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/system-announcements/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const updated = await storage.updateSystemAnnouncement(id, req.body || {});
      if (!updated) return res.status(404).json({ message: "找不到資料" });
      res.json(updated);
    } catch (err) {
      const m = err instanceof Error ? err.message : "更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/system-announcements/:id", requireSupervisor(), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const ok = await storage.deleteSystemAnnouncement(id);
      if (!ok) return res.status(404).json({ message: "找不到資料" });
      res.json({ ok: true });
    } catch (err) {
      const m = err instanceof Error ? err.message : "刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  // -------- Portal: Analytics 事件追蹤 --------
  app.post("/api/portal/events", async (req, res) => {
    try {
      const employeeNumber = (req.headers["x-employee-number"] as string) || null;
      const employeeName = decodeURIComponent((req.headers["x-employee-name"] as string) || "") || null;
      const facilityKey = (req.headers["x-facility-key"] as string) || null;

      const { insertPortalEventSchema } = await import("@shared/schema");
      const body = req.body || {};
      const parsed = insertPortalEventSchema.safeParse({
        employeeNumber,
        employeeName,
        facilityKey,
        eventType: body.eventType,
        target: body.target,
        targetLabel: body.targetLabel,
        metadata: body.metadata,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "事件格式錯誤", errors: parsed.error.flatten() });
      }
      await storage.recordPortalEvent(parsed.data);
      res.status(204).end();
    } catch (err) {
      const m = err instanceof Error ? err.message : "事件記錄失敗";
      res.status(500).json({ message: m });
    }
  });

  app.get("/api/portal/analytics", async (req, res) => {
    try {
      const sinceDays = req.query.sinceDays ? Number(req.query.sinceDays) : 30;
      const facilityKey = req.query.facilityKey ? String(req.query.facilityKey) : undefined;
      const stats = await storage.getEventStats({
        sinceDays: Number.isFinite(sinceDays) ? sinceDays : 30,
        facilityKey,
      });
      res.json(stats);
    } catch (err) {
      const m = err instanceof Error ? err.message : "查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  return httpServer;
}
