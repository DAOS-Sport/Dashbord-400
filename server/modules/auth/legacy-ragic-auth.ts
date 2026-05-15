import type { Express } from "express";

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
export type EmployeeProfile = { employeeNumber: string; name: string; title: string; department?: string; status: string; mobile: string; isSupervisor: boolean };
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

export function requireSupervisor(): import("express").RequestHandler {
  return async (req, res, next) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ message: "未授權：請重新登入" });
    if (caller.status && caller.status !== "在職") return res.status(403).json({ message: "員工已離職" });
    if (!caller.isSupervisor) return res.status(403).json({ message: "需主管權限" });
    (req as unknown as { caller: EmployeeProfile }).caller = caller;
    next();
  };
}

export function requireEmployee(): import("express").RequestHandler {
  return async (req, res, next) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ message: "未授權：請重新登入" });
    if (caller.status && caller.status !== "在職") return res.status(403).json({ message: "員工已離職" });
    (req as unknown as { caller: EmployeeProfile }).caller = caller;
    next();
  };
}

export const registerLegacyRagicAuthRoutes = (app: Express) => {
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
};
