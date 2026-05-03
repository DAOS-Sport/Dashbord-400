import type { Express, RequestHandler } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../../storage";
import {
  insertParkingPlanSchema,
  insertParkingVehicleSchema,
  insertParkingContractSchema,
  insertParkingPaymentSchema,
  insertParkingEventDaySchema,
  type ParkingContract,
} from "@shared/schema";
import {
  PARKING_TERMS_VERSION,
  PARKING_TERMS_TITLE,
  PARKING_TERMS_PARTIES,
  PARKING_TERMS_SECTIONS,
} from "@shared/parking-terms";
import { ObjectStorageService } from "../../replit_integrations/object_storage";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function readClientIp(req: import("express").Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined) || "";
  return fwd.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

const finalizeSignSchema = z.object({
  // Signature is a small PNG data URL (canvas ~600×190, monochrome strokes).
  // Cap at 500KB to keep DB rows compact and prevent storage-bloat DoS.
  signatureImageUrl: z.string().min(10).max(500_000),
  signerName: z.string().min(1).max(100),
  signerIdLast4: z.string().regex(/^\d{4}$/).optional().nullable(),
  vehicleRegPhotoUrl: z.string().min(1).max(2000),
  driverLicensePhotoUrl: z.string().min(1).max(2000),
  idCardPhotoUrl: z.string().max(2000).optional().nullable(),
  agreedTermsVersion: z.string().min(1).max(50),
});

interface RegisterDeps {
  requireEmployee: () => RequestHandler;
  requireSupervisor: () => RequestHandler;
}

function getCaller(req: import("express").Request) {
  const session = req.workbenchSession;
  return {
    employeeNumber: session?.userId ?? "unknown",
    name: session?.displayName ?? "未知員工",
    isSystem: !!session?.grantedRoles?.includes?.("system"),
  };
}

function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, "");
}

// Compute new endDate when extending a contract by N months from a start date.
// Used both for fresh contracts (start = today) and renewals (start = current
// endDate + 1 day if still active, else today).
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + months);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ----------------------------------------------------------------------
// Strict patch schemas — explicit allowlist per route to prevent
// mass-assignment of audit/state fields from untrusted clients.
// ----------------------------------------------------------------------

const updatePlanSchema = insertParkingPlanSchema.partial().strict();

const updateVehicleSchema = z.object({
  ownerName: z.string().min(1).max(100).optional(),
  ownerPhone: z.string().max(30).nullable().optional(),
  ownerEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  lineUserId: z.string().max(100).nullable().optional(),
  vehicleType: z.enum(["monthly", "quarterly", "yearly", "member", "swim_team", "employee", "special", "blacklist"]).optional(),
  status: z.enum(["active", "expired", "suspended", "blacklisted"]).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
}).strict();

const updateContractSchema = z.object({
  status: z.enum(["draft", "awaiting_sign", "awaiting_payment", "payment_review", "active", "expiring_soon", "expired", "terminated", "refunded"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  totalAmount: z.number().int().min(0).max(100_000_000).optional(),
  depositAmount: z.number().int().min(0).max(100_000_000).optional(),
  signatureImageUrl: z.string().max(2000).nullable().optional(),
  pdfUrl: z.string().max(2000).nullable().optional(),
  refundAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
}).strict();

const reviewPaymentSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(2000).nullable().optional(),
}).strict();

export function registerParkingRoutes(app: Express, deps: RegisterDeps) {
  const { requireEmployee, requireSupervisor } = deps;

  // ===== Dashboard =====
  app.get("/api/parking/dashboard", requireEmployee(), async (_req, res) => {
    try {
      const summary = await storage.parkingDashboardSummary();
      res.json(summary);
    } catch (err) {
      console.error("[parking] dashboard failed", err);
      res.status(500).json({ message: "載入失敗" });
    }
  });

  // ===== Plans (CRUD) =====
  app.get("/api/parking/plans", requireEmployee(), async (req, res) => {
    const includeInactive = String(req.query.includeInactive ?? "") === "1";
    res.json({ items: await storage.listParkingPlans({ includeInactive }) });
  });

  app.post("/api/parking/plans", requireSupervisor(), async (req, res) => {
    const parsed = insertParkingPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    try {
      const created = await storage.createParkingPlan(parsed.data);
      res.json(created);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "方案代號已存在" });
      console.error("[parking] create plan failed", err);
      res.status(500).json({ message: "建立失敗" });
    }
  });

  app.patch("/api/parking/plans/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const updated = await storage.updateParkingPlan(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "方案不存在" });
    res.json(updated);
  });

  app.delete("/api/parking/plans/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteParkingPlan(id);
    if (!ok) return res.status(404).json({ message: "方案不存在" });
    res.json({ ok: true });
  });

  // ===== Vehicles =====
  app.get("/api/parking/vehicles", requireEmployee(), async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const vehicleType = typeof req.query.vehicleType === "string" ? req.query.vehicleType : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const expiringWithinDays = req.query.expiringWithinDays ? Number(req.query.expiringWithinDays) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    res.json(await storage.listParkingVehicles({ search, vehicleType, status, expiringWithinDays, limit, offset }));
  });

  app.get("/api/parking/vehicles/:id", requireEmployee(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const row = await storage.getParkingVehicleById(id);
    if (!row) return res.status(404).json({ message: "車輛不存在" });
    res.json(row);
  });

  app.post("/api/parking/vehicles", requireSupervisor(), async (req, res) => {
    const body = { ...req.body, licensePlate: typeof req.body?.licensePlate === "string" ? normalizePlate(req.body.licensePlate) : req.body?.licensePlate };
    const parsed = insertParkingVehicleSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    try {
      const created = await storage.createParkingVehicle(parsed.data);
      res.json(created);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "車牌已存在" });
      console.error("[parking] create vehicle failed", err);
      res.status(500).json({ message: "建立失敗" });
    }
  });

  app.patch("/api/parking/vehicles/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const parsed = updateVehicleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const updated = await storage.updateParkingVehicle(id, parsed.data as any);
    if (!updated) return res.status(404).json({ message: "車輛不存在" });
    res.json(updated);
  });

  app.delete("/api/parking/vehicles/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const ok = await storage.deleteParkingVehicle(id);
    if (!ok) return res.status(404).json({ message: "車輛不存在" });
    res.json({ ok: true });
  });

  // ===== Contracts =====
  app.get("/api/parking/contracts", requireEmployee(), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ items: await storage.listParkingContracts({ status, vehicleId, limit }) });
  });

  app.get("/api/parking/contracts/:id", requireEmployee(), async (req, res) => {
    const id = Number(req.params.id);
    const row = await storage.getParkingContractById(id);
    if (!row) return res.status(404).json({ message: "合約不存在" });
    res.json(row);
  });

  app.post("/api/parking/contracts", requireSupervisor(), async (req, res) => {
    const parsed = insertParkingContractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const caller = getCaller(req);
    try {
      const vehicle = await storage.getParkingVehicleById(parsed.data.vehicleId);
      if (!vehicle) return res.status(400).json({ message: "車輛不存在" });
      const plan = await storage.getParkingPlanById(parsed.data.planId);
      if (!plan) return res.status(400).json({ message: "方案不存在" });
      const contractNumber = await storage.generateContractNumber();
      const created = await storage.createParkingContract({
        ...parsed.data,
        contractNumber,
        createdBy: caller.employeeNumber,
        createdByName: caller.name,
      });
      res.json(created);
    } catch (err) {
      console.error("[parking] create contract failed", err);
      res.status(500).json({ message: "建立失敗" });
    }
  });

  app.patch("/api/parking/contracts/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "id 錯誤" });
    const parsed = updateContractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const updated = await storage.updateParkingContract(id, parsed.data as any);
    if (!updated) return res.status(404).json({ message: "合約不存在" });
    res.json(updated);
  });

  // Sign (in-person mode) — staff hands tablet to customer in front of them.
  // Accepts the same payload as the remote sign endpoint, but is gated by
  // supervisor auth instead of token verification.
  app.post("/api/parking/contracts/:id/sign", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const c = await storage.getParkingContractById(id);
    if (!c) return res.status(404).json({ message: "合約不存在" });
    if (!["draft", "awaiting_sign"].includes(c.status)) {
      return res.status(409).json({ message: `合約狀態 ${c.status} 不允許簽約` });
    }
    await finalizeContractSigning({ contract: c, body: req.body, req, res });
  });

  // ===== Phase 2: customer-facing e-sign flow =====

  // Issue a one-time signing link. Token is returned in plaintext to the
  // supervisor (who then copies it / sends it via SMS or LINE) but only the
  // sha256 hash is stored. Default expiry: 7 days. Re-issuing rotates it.
  app.post("/api/parking/contracts/:id/issue-sign-link", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const c = await storage.getParkingContractById(id);
    if (!c) return res.status(404).json({ message: "合約不存在" });
    if (!["draft", "awaiting_sign"].includes(c.status)) {
      return res.status(409).json({ message: `合約狀態 ${c.status} 不允許產生簽約連結` });
    }
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.updateParkingContract(id, {
      status: "awaiting_sign",
      signTokenHash: sha256(token),
      signTokenExpiresAt: expiresAt,
      termsVersion: PARKING_TERMS_VERSION,
    });
    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      url: `/parking/sign/${token}`,
    });
  });

  // Public — resolve a signing token. Returns just enough for the customer
  // view: contract summary, vehicle, plan, and the latest terms blob.
  app.get("/api/parking/sign-tokens/:token", async (req, res) => {
    const token = String(req.params.token || "");
    if (!token || token.length < 8) return res.status(400).json({ message: "無效的簽約連結" });
    const contract = await storage.getParkingContractByTokenHash(sha256(token));
    if (!contract) return res.status(404).json({ message: "找不到簽約資料，連結可能已失效" });
    if (contract.signTokenExpiresAt && new Date(contract.signTokenExpiresAt) < new Date()) {
      return res.status(410).json({ message: "簽約連結已過期，請洽櫃台重新發送" });
    }
    if (!["draft", "awaiting_sign"].includes(contract.status)) {
      return res.status(409).json({ message: `合約狀態 ${contract.status} 不允許再簽約` });
    }
    const vehicle = await storage.getParkingVehicleById(contract.vehicleId);
    const plan = await storage.getParkingPlanById(contract.planId);
    res.json({
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        startDate: contract.startDate,
        endDate: contract.endDate,
        totalAmount: contract.totalAmount,
        depositAmount: contract.depositAmount,
        signTokenExpiresAt: contract.signTokenExpiresAt,
      },
      vehicle: vehicle && {
        licensePlate: vehicle.licensePlate,
        ownerName: vehicle.ownerName,
        ownerPhone: vehicle.ownerPhone,
      },
      plan: plan && {
        name: plan.name,
        planType: plan.planType,
        durationMonths: plan.durationMonths,
        price: plan.price,
        deposit: plan.deposit,
      },
      terms: {
        version: PARKING_TERMS_VERSION,
        title: PARKING_TERMS_TITLE,
        parties: PARKING_TERMS_PARTIES,
        sections: PARKING_TERMS_SECTIONS,
      },
    });
  });

  // Public — request a presigned upload URL while signing. Token-gated so
  // only people with a valid signing link can hit the bucket.
  app.post("/api/parking/sign-tokens/:token/upload-url", async (req, res) => {
    const token = String(req.params.token || "");
    const contract = await storage.getParkingContractByTokenHash(sha256(token));
    if (!contract) return res.status(404).json({ message: "找不到簽約資料" });
    if (contract.signTokenExpiresAt && new Date(contract.signTokenExpiresAt) < new Date()) {
      return res.status(410).json({ message: "簽約連結已過期" });
    }
    if (!["draft", "awaiting_sign"].includes(contract.status)) {
      return res.status(409).json({ message: "合約狀態不允許上傳" });
    }
    const svc = new ObjectStorageService();
    const uploadURL = await svc.getObjectEntityUploadURL();
    const objectPath = svc.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  });

  // Public — finalize signing using the one-time token.
  app.post("/api/parking/sign-tokens/:token/finalize", async (req, res) => {
    const token = String(req.params.token || "");
    const contract = await storage.getParkingContractByTokenHash(sha256(token));
    if (!contract) return res.status(404).json({ message: "找不到簽約資料" });
    if (contract.signTokenExpiresAt && new Date(contract.signTokenExpiresAt) < new Date()) {
      return res.status(410).json({ message: "簽約連結已過期" });
    }
    if (!["draft", "awaiting_sign"].includes(contract.status)) {
      return res.status(409).json({ message: `合約狀態 ${contract.status} 不允許再簽約` });
    }
    await finalizeContractSigning({ contract, body: req.body, req, res, viaToken: true });
  });

  async function finalizeContractSigning(args: {
    contract: ParkingContract;
    body: unknown;
    req: import("express").Request;
    res: import("express").Response;
    viaToken?: boolean;
  }) {
    const { contract, body, req, res, viaToken } = args;
    const parsed = finalizeSignSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ message: "簽約資料格式錯誤", errors: parsed.error.flatten() });
    }
    if (parsed.data.agreedTermsVersion !== PARKING_TERMS_VERSION) {
      return res.status(409).json({
        message: `合約版本已更新為 ${PARKING_TERMS_VERSION}，請重新整理頁面再簽一次`,
      });
    }
    const plan = await storage.getParkingPlanById(contract.planId);
    const nextStatus: "awaiting_payment" | "active" = plan?.requiresPayment ? "awaiting_payment" : "active";
    const updated = await storage.updateParkingContract(contract.id, {
      signatureImageUrl: parsed.data.signatureImageUrl,
      signerName: parsed.data.signerName,
      signerIdLast4: parsed.data.signerIdLast4 ?? null,
      vehicleRegPhotoUrl: parsed.data.vehicleRegPhotoUrl,
      driverLicensePhotoUrl: parsed.data.driverLicensePhotoUrl,
      idCardPhotoUrl: parsed.data.idCardPhotoUrl ?? null,
      termsVersion: parsed.data.agreedTermsVersion,
      signedFromIp: readClientIp(req),
      signedUserAgent: String(req.headers["user-agent"] || "").slice(0, 500),
      signedAt: new Date(),
      status: nextStatus,
      // Burn the token so it can only be used once.
      ...(viaToken ? { signTokenHash: null, signTokenExpiresAt: null } : {}),
    });
    res.json({ ok: true, contract: updated });
  }

  // Terminate — admin-initiated cancellation; vehicle marked expired.
  app.post("/api/parking/contracts/:id/terminate", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const note = typeof req.body?.note === "string" ? req.body.note : null;
    const c = await storage.getParkingContractById(id);
    if (!c) return res.status(404).json({ message: "合約不存在" });
    const updated = await storage.updateParkingContract(id, {
      status: "terminated",
      terminatedAt: new Date(),
      note,
    });
    await storage.updateParkingVehicle(c.vehicleId, { status: "expired" });
    res.json(updated);
  });

  // Refund — partial/full refund; doesn't auto-terminate, supervisor must
  // also call terminate if needed.
  app.post("/api/parking/contracts/:id/refund", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const amount = Number(req.body?.refundAmount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ message: "退款金額錯誤" });
    const c = await storage.getParkingContractById(id);
    if (!c) return res.status(404).json({ message: "合約不存在" });
    const updated = await storage.updateParkingContract(id, {
      status: "refunded",
      refundAmount: Math.floor(amount),
      refundedAt: new Date(),
    });
    res.json(updated);
  });

  app.delete("/api/parking/contracts/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const ok = await storage.deleteParkingContract(id);
    if (!ok) return res.status(404).json({ message: "合約不存在" });
    res.json({ ok: true });
  });

  // ===== Payments =====
  app.get("/api/parking/payments", requireEmployee(), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const contractId = req.query.contractId ? Number(req.query.contractId) : undefined;
    res.json({ items: await storage.listParkingPayments({ status, contractId }) });
  });

  // Phase 1: payment reporting is supervisor-only (admin records the customer's
  // bank-transfer report). Public/customer self-service is deferred to Phase 2.
  // Allowed only when the contract is in a state that expects payment.
  app.post("/api/parking/payments", requireSupervisor(), async (req, res) => {
    const parsed = insertParkingPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const c = await storage.getParkingContractById(parsed.data.contractId);
    if (!c) return res.status(400).json({ message: "合約不存在" });
    const ALLOWED_FOR_REPORT = new Set(["awaiting_sign", "awaiting_payment", "payment_review", "active", "expiring_soon"]);
    if (!ALLOWED_FOR_REPORT.has(c.status)) {
      return res.status(409).json({ message: `合約狀態 ${c.status} 不允許新增付款記錄` });
    }
    const created = await storage.createParkingPayment(parsed.data);
    if (c.status === "awaiting_payment" || c.status === "awaiting_sign") {
      await storage.updateParkingContract(c.id, { status: "payment_review" });
    }
    res.json(created);
  });

  // Approve / Reject — on approve, contract becomes active and vehicle gets
  // its expiresAt extended by plan.durationMonths (if any). On reject we
  // bounce the contract back to awaiting_payment so the user can re-report.
  app.post("/api/parking/payments/:id/review", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const parsed = reviewPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const caller = getCaller(req);
    const payment = await storage.getParkingPaymentById(id);
    if (!payment) return res.status(404).json({ message: "付款記錄不存在" });
    if (payment.status !== "pending") return res.status(409).json({ message: "此筆付款已審核完畢，無法重複審核" });

    const reviewed = await storage.reviewParkingPayment(id, {
      status: parsed.data.status,
      reviewedBy: caller.employeeNumber,
      reviewedByName: caller.name,
      reviewNote: parsed.data.reviewNote ?? null,
    });

    const contract = await storage.getParkingContractById(payment.contractId);
    if (contract) {
      // Approval may only revive contracts that are still in a payment-pending
      // / active flow. Block reactivation of terminated/refunded contracts —
      // those require supervisor to explicitly create a new contract.
      const APPROVE_ALLOWED_STATES = new Set(["awaiting_sign", "awaiting_payment", "payment_review", "active", "expiring_soon"]);
      if (parsed.data.status === "approved" && !APPROVE_ALLOWED_STATES.has(contract.status)) {
        return res.status(409).json({ message: `合約狀態 ${contract.status} 不允許自動續約，請改為新建合約` });
      }
      if (parsed.data.status === "approved") {
        const plan = await storage.getParkingPlanById(contract.planId);
        // Compute new endDate. If contract is being newly activated, start = today
        // (or contract.startDate if already populated). For renewals (already
        // active), extend from current endDate so we don't lose paid days.
        const months = plan?.durationMonths ?? 0;
        const baseStart = contract.startDate ?? todayStr();
        const baseEnd = contract.endDate && contract.endDate >= todayStr() ? contract.endDate : todayStr();
        const newEnd = months > 0 ? addMonths(baseEnd, months) : (contract.endDate ?? null);
        await storage.updateParkingContract(contract.id, {
          status: "active",
          startDate: contract.startDate ?? baseStart,
          endDate: newEnd,
        });
        if (newEnd) {
          await storage.updateParkingVehicle(contract.vehicleId, { status: "active", expiresAt: newEnd });
        }
      } else {
        // Reject — return contract to awaiting_payment so user can re-report.
        await storage.updateParkingContract(contract.id, { status: "awaiting_payment" });
      }
    }
    res.json(reviewed);
  });

  // ===== Event days =====
  app.get("/api/parking/event-days", requireEmployee(), async (req, res) => {
    const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === "string" ? req.query.toDate : undefined;
    res.json({ items: await storage.listParkingEventDays({ fromDate, toDate }) });
  });
  app.post("/api/parking/event-days", requireSupervisor(), async (req, res) => {
    const parsed = insertParkingEventDaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const caller = getCaller(req);
    const created = await storage.createParkingEventDay({ ...parsed.data, createdBy: caller.employeeNumber });
    res.json(created);
  });
  app.patch("/api/parking/event-days/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const parsed = insertParkingEventDaySchema.partial().strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
    const updated = await storage.updateParkingEventDay(id, parsed.data as any);
    if (!updated) return res.status(404).json({ message: "活動日不存在" });
    res.json(updated);
  });
  app.delete("/api/parking/event-days/:id", requireSupervisor(), async (req, res) => {
    const id = Number(req.params.id);
    const ok = await storage.deleteParkingEventDay(id);
    if (!ok) return res.status(404).json({ message: "活動日不存在" });
    res.json({ ok: true });
  });
}
