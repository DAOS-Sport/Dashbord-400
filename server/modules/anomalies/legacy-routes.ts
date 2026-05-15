import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../../storage";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "anomaly-reports");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const anomalyResolutionActor = (req: import("express").Request) => ({
  userId: req.workbenchSession?.userId ?? "legacy-anonymous",
  role: req.workbenchSession?.activeRole ?? "system",
  facilityKey: req.workbenchSession?.activeFacility,
});

const correlationIdFromRequest = (req: import("express").Request) => {
  const header = req.headers["x-correlation-id"];
  return Array.isArray(header) ? header[0] : header;
};

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);

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

export const registerAnomalyLegacyRoutes = (app: Express, container: AppContainer) => {
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
        facilityKey: clockResult.facilityKey ?? data.facilityKey ?? null,
        source: "external-checkin-system",
      });
      await container.repositories.telemetry.recordAudit({
        actorId: "external-checkin-system",
        role: "system",
        facilityKey: clockResult.facilityKey ?? data.facilityKey ?? null,
        action: "ANOMALY_REPORTED",
        resource: "anomaly_reports",
        resourceId: String(report.id),
        payload: {
          context: data.context,
          clockStatus: clockResult.status,
          source: "external-checkin-system",
        },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
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

      const actor = anomalyResolutionActor(req);
      const updated = await storage.updateAnomalyReportResolution(id, resolution, resolvedNote ?? null, actor);
      if (!updated) return res.status(404).json({ message: "找不到此異常報告" });
      await container.repositories.telemetry.recordAudit({
        actorId: actor.userId,
        role: actor.role,
        facilityKey: updated.facilityKey ?? actor.facilityKey,
        action: "ANOMALY_RESOLVED",
        resource: "anomaly_reports",
        resourceId: String(updated.id),
        payload: { resolution: updated.resolution, hasResolutionNote: Boolean(updated.resolvedNote) },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });

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
      const actor = anomalyResolutionActor(req);
      const count = await storage.batchUpdateResolution(ids, resolution, resolvedNote ?? null, actor);
      await container.repositories.telemetry.recordAudit({
        actorId: actor.userId,
        role: actor.role,
        facilityKey: actor.facilityKey,
        action: "ANOMALY_RESOLVED",
        resource: "anomaly_reports",
        resourceId: ids.map(String).join(","),
        payload: { resolution, count, hasResolutionNote: Boolean(resolvedNote) },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });

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
};
