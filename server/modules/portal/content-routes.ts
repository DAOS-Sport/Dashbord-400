import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { EmployeeProfile } from "../auth/legacy-ragic-auth";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";
import { canMutateEmployeeResource } from "@shared/employee-resources/privacy";
import { env } from "../../shared/config/env";
import { withCreateMetadata, withEmployeeCreateMetadata, withUpdateMetadata } from "../../shared/data/write-metadata";
import { storage } from "../../storage";

const correlationIdFromRequest = (req: Request) => {
  const header = req.headers["x-correlation-id"];
  return Array.isArray(header) ? header[0] : header;
};

const canAccessFacility = (req: Request, facilityKey: string) =>
  !req.workbenchSession || req.workbenchSession.grantedFacilities.includes(facilityKey);

export const registerPortalContentRoutes = (
  app: Express,
  container: AppContainer,
  auth: { requireEmployee: () => RequestHandler; requireSupervisor: () => RequestHandler },
) => {
  const { requireEmployee, requireSupervisor } = auth;
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
      if (!env.databaseUrl) {
        return res.json({ items: [] });
      }
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
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertQuickLinkSchema } = await import("@shared/schema");
      const parsed = insertQuickLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const created = await storage.createQuickLink(withCreateMetadata(parsed.data, {
        userId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: parsed.data.facilityKey ?? undefined,
      }));
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: parsed.data.facilityKey ?? undefined,
        action: "QUICK_LINK_CREATED",
        resource: "quick_links",
        resourceId: String(created.id),
        payload: { label: created.title, url: created.url },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/quick-links/:id", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const quickLinkPatchSchema = z.object({
        facilityKey: z.string().nullable().optional(),
        title: z.string().min(1, "標題不可為空").optional(),
        url: z.string().url("網址格式不正確").optional(),
        icon: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = quickLinkPatchSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const updated = await storage.updateQuickLink(id, withUpdateMetadata(parsed.data, {
        userId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: parsed.data.facilityKey ?? undefined,
      }));
      if (!updated) return res.status(404).json({ message: "找不到資料" });
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role: "supervisor",
        facilityKey: updated.facilityKey ?? undefined,
        action: "QUICK_LINK_UPDATED",
        resource: "quick_links",
        resourceId: String(updated.id),
        payload: { label: updated.title, url: updated.url },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
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

  // -------- Portal: Employee Resources (員工自建活動 / 文件 / 公告 / 教材) --------
  const employeeResourceDatabaseUnavailable = () => ({
    message: "資料庫尚未連線，請在部署環境設定 NEON_DATABASE_URL 或 DATABASE_URL 後使用員工資源寫入功能。",
    code: "DATABASE_NOT_CONNECTED",
  });

  app.get("/api/portal/employee-resources", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const facilityKey = String(req.query.facilityKey || req.workbenchSession?.activeFacility || "");
      const category = req.query.category ? String(req.query.category) : undefined;
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      if (!canAccessFacility(req, facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const items = await storage.listEmployeeResources({
        facilityKey,
        category,
        ownerEmployeeNumber: caller.employeeNumber,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ items });
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(employeeResourceDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "員工資源查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/employee-resources", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertEmployeeResourceSchema } = await import("@shared/schema");
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const parsed = insertEmployeeResourceSchema.safeParse({
        ...body,
        createdByEmployeeNumber: caller.employeeNumber,
        createdByName: caller.name,
        isPrivate: body.isPrivate,
      });
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      if (!canAccessFacility(req, parsed.data.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const created = await storage.createEmployeeResource(withEmployeeCreateMetadata(parsed.data, {
        userId: caller.employeeNumber,
        role: caller.isSupervisor ? "supervisor" : "employee",
        facilityKey: parsed.data.facilityKey,
      }, caller.name));
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role: caller.isSupervisor ? "supervisor" : "employee",
        facilityKey: parsed.data.facilityKey,
        action: "EMPLOYEE_RESOURCE_CREATED",
        resource: "employee_resources",
        resourceId: String(created.id),
        payload: { category: created.category, subCategory: created.subCategory, title: created.title },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
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
      if (!env.databaseUrl) return res.status(503).json(employeeResourceDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "員工資源建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/employee-resources/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = (await storage.listEmployeeResources({ ownerEmployeeNumber: caller.employeeNumber, limit: 300 })).find((item) => item.id === id);
      if (!existing) return res.status(404).json({ message: "找不到員工資源" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const canEdit = canMutateEmployeeResource(existing, caller);
      if (!canEdit) return res.status(403).json({ message: "只能編輯自己建立的資料" });
      const patchSchema = z.object({
        title: z.string().min(1).max(120).optional(),
        subCategory: z.string().max(60).nullable().optional(),
        content: z.string().max(1000).nullable().optional(),
        url: z.string().refine((value) => value.startsWith("/") || z.string().url().safeParse(value).success, "網址格式不正確").nullable().optional(),
        imageUrl: z.string().refine((value) => value.startsWith("/") || z.string().url().safeParse(value).success, "圖片網址格式不正確").nullable().optional(),
        eventCategory: z.string().max(60).nullable().optional(),
        eventStartAt: z.coerce.date().nullable().optional(),
        eventEndAt: z.coerce.date().nullable().optional(),
        isPinned: z.boolean().optional(),
        isPrivate: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        scheduledAt: z.coerce.date().nullable().optional(),
      });
      const parsed = patchSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const updated = await storage.updateEmployeeResource(id, withUpdateMetadata(parsed.data, {
        userId: caller.employeeNumber,
        role: caller.isSupervisor ? "supervisor" : "employee",
        facilityKey: existing.facilityKey,
      }));
      if (updated) {
        await container.repositories.telemetry.recordAudit({
          actorId: caller.employeeNumber,
          role: caller.isSupervisor ? "supervisor" : "employee",
          facilityKey: existing.facilityKey,
          action: "EMPLOYEE_RESOURCE_UPDATED",
          resource: "employee_resources",
          resourceId: String(updated.id),
          payload: { category: updated.category, subCategory: updated.subCategory, title: updated.title },
          correlationId: correlationIdFromRequest(req),
          resultStatus: "success",
        });
      }
      res.json(updated);
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(employeeResourceDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "員工資源更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/employee-resources/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = (await storage.listEmployeeResources({ ownerEmployeeNumber: caller.employeeNumber, limit: 300 })).find((item) => item.id === id);
      if (!existing) return res.status(404).json({ message: "找不到員工資源" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const canDelete = canMutateEmployeeResource(existing, caller);
      if (!canDelete) return res.status(403).json({ message: "只能刪除自己建立的資料" });
      const ok = await storage.deleteEmployeeResource(id);
      res.json({ ok });
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(employeeResourceDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "員工資源刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  // -------- Portal: Knowledge Base Q&A (相關問題詢問) --------
  const qnaDatabaseUnavailable = () => ({
    message: "資料庫尚未連線，請在部署環境設定 NEON_DATABASE_URL 或 DATABASE_URL 後使用相關問題詢問功能。",
    code: "DATABASE_NOT_CONNECTED",
  });

  app.get("/api/portal/knowledge-base-qna", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const facilityKey = String(req.query.facilityKey || req.workbenchSession?.activeFacility || "");
      if (!facilityKey) return res.status(400).json({ message: "缺少 facilityKey" });
      if (!canAccessFacility(req, facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const items = await storage.listKnowledgeBaseQna({
        facilityKey,
        query,
        viewerEmployeeNumber: caller.employeeNumber,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ items });
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(qnaDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "相關問題查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  app.post("/api/portal/knowledge-base-qna", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertKnowledgeBaseQnaSchema } = await import("@shared/schema");
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const parsed = insertKnowledgeBaseQnaSchema.safeParse({
        ...body,
        tags: Array.isArray(body.tags) ? body.tags : [],
        reviewStatus: "pending",
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        createdByEmployeeNumber: caller.employeeNumber,
        createdByName: caller.name,
      });
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      if (!canAccessFacility(req, parsed.data.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const role = caller.isSupervisor ? "supervisor" : "employee";
      const created = await storage.createKnowledgeBaseQna(withEmployeeCreateMetadata(parsed.data, {
        userId: caller.employeeNumber,
        role,
        facilityKey: parsed.data.facilityKey,
      }, caller.name));
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role,
        facilityKey: parsed.data.facilityKey,
        action: "KNOWLEDGE_QNA_CREATED",
        resource: "knowledge_base_qna",
        resourceId: String(created.id),
        payload: { question: created.question, category: created.category, tags: created.tags },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.status(201).json(created);
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(qnaDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "相關問題建立失敗";
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/knowledge-base-qna/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getKnowledgeBaseQnaById(id);
      if (!existing || existing.status === "archived") return res.status(404).json({ message: "找不到相關問題" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const canEdit = existing.createdByEmployeeNumber === caller.employeeNumber || caller.isSupervisor;
      if (!canEdit) return res.status(403).json({ message: "只能編輯自己建立的問答" });
      const patchSchema = z.object({
        question: z.string().min(1).max(240).optional(),
        answer: z.string().max(4000).nullable().optional(),
        category: z.string().max(60).nullable().optional(),
        tags: z.array(z.string().max(32)).max(12).optional(),
        isPinned: z.boolean().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        reviewStatus: z.enum(["pending", "approved", "rejected"]).optional(),
        reviewNote: z.string().max(1000).nullable().optional(),
      });
      const parsed = patchSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const role = caller.isSupervisor ? "supervisor" : "employee";
      const nextPatch = caller.isSupervisor
        ? parsed.data
        : { ...parsed.data, reviewStatus: "pending" as const, reviewNote: null, reviewedBy: null, reviewedAt: null };
      const updated = await storage.updateKnowledgeBaseQna(id, withUpdateMetadata(nextPatch, {
        userId: caller.employeeNumber,
        role,
        facilityKey: existing.facilityKey,
      }));
      if (!updated) return res.status(404).json({ message: "找不到相關問題" });
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role,
        facilityKey: existing.facilityKey,
        action: "KNOWLEDGE_QNA_UPDATED",
        resource: "knowledge_base_qna",
        resourceId: String(updated.id),
        payload: { question: updated.question, category: updated.category, status: updated.status },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.json(updated);
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(qnaDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "相關問題更新失敗";
      res.status(500).json({ message: m });
    }
  });

  app.delete("/api/portal/knowledge-base-qna/:id", requireEmployee(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const existing = await storage.getKnowledgeBaseQnaById(id);
      if (!existing || existing.status === "archived") return res.status(404).json({ message: "找不到相關問題" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const canDelete = existing.createdByEmployeeNumber === caller.employeeNumber || caller.isSupervisor;
      if (!canDelete) return res.status(403).json({ message: "只能刪除自己建立的問答" });
      const ok = await storage.deleteKnowledgeBaseQna(id);
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role: caller.isSupervisor ? "supervisor" : "employee",
        facilityKey: existing.facilityKey,
        action: "KNOWLEDGE_QNA_DELETED",
        resource: "knowledge_base_qna",
        resourceId: String(existing.id),
        payload: { question: existing.question, category: existing.category },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.json({ ok });
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(qnaDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "相關問題刪除失敗";
      res.status(500).json({ message: m });
    }
  });

  app.get("/api/bff/supervisor/qna-review", requireSupervisor(), async (req, res) => {
    try {
      const facilityKey = req.query.facilityKey ? String(req.query.facilityKey) : undefined;
      if (facilityKey && !canAccessFacility(req, facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const items = await storage.listKnowledgeBaseQna({
        facilityKey,
        reviewStatus: "pending",
        includeArchived: false,
        limit: req.query.limit ? Number(req.query.limit) : 200,
      });
      res.json({ items });
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(qnaDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "主管問答審核查詢失敗";
      res.status(500).json({ message: m });
    }
  });

  const qnaReviewBodySchema = z.object({
    reviewNote: z.string().max(1000).nullable().optional(),
  });

  const reviewKnowledgeBaseQna = async (
    req: import("express").Request,
    res: import("express").Response,
    reviewStatus: "approved" | "rejected",
  ) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const parsed = qnaReviewBodySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      const existing = await storage.getKnowledgeBaseQnaById(id);
      if (!existing || existing.status === "archived") return res.status(404).json({ message: "找不到相關問題" });
      if (!canAccessFacility(req, existing.facilityKey)) return res.status(403).json({ message: "無此館別權限" });
      const role = req.workbenchSession?.activeRole === "system" ? "system" : "supervisor";
      const existingStatus = ["draft", "published", "archived"].includes(existing.status)
        ? existing.status as "draft" | "published" | "archived"
        : "published";
      const updated = await storage.updateKnowledgeBaseQna(id, withUpdateMetadata({
        reviewStatus,
        reviewNote: parsed.data.reviewNote ?? null,
        reviewedBy: caller.employeeNumber,
        reviewedAt: new Date(),
        status: reviewStatus === "approved" ? "published" : existingStatus,
      }, {
        userId: caller.employeeNumber,
        role,
        facilityKey: existing.facilityKey,
      }));
      if (!updated) return res.status(404).json({ message: "找不到相關問題" });
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role,
        facilityKey: existing.facilityKey,
        action: reviewStatus === "approved" ? "QNA_APPROVED" : "QNA_REJECTED",
        resource: "knowledge_base_qna",
        resourceId: String(existing.id),
        payload: { question: existing.question, reason: parsed.data.reviewNote ?? null },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      return res.json(updated);
    } catch (err) {
      if (!env.databaseUrl) return res.status(503).json(qnaDatabaseUnavailable());
      const m = err instanceof Error ? err.message : "主管問答審核失敗";
      return res.status(500).json({ message: m });
    }
  };

  app.post("/api/bff/supervisor/qna-review/:id/approve", requireSupervisor(), (req, res) =>
    reviewKnowledgeBaseQna(req, res, "approved"),
  );

  app.post("/api/bff/supervisor/qna-review/:id/reject", requireSupervisor(), (req, res) =>
    reviewKnowledgeBaseQna(req, res, "rejected"),
  );

  // -------- Portal: System Announcements (主管維護) --------
  app.get("/api/portal/system-announcements", async (req, res) => {
    try {
      const facilityKey = req.query.facilityKey ? String(req.query.facilityKey) : undefined;
      const includeInactive = req.query.includeInactive === "true";
      const items = await storage.listSystemAnnouncements(facilityKey, includeInactive);
      res.json({ items });
    } catch (err) {
      const m = err instanceof Error ? err.message : "查詢失敗";
      console.error("[system-announcements:list_failed]", err);
      res.json({
        items: [],
        sourceStatus: {
          connected: false,
          errorMessage: m,
        },
      });
    }
  });

  app.post("/api/portal/system-announcements", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const { insertSystemAnnouncementSchema } = await import("@shared/schema");
      const parsed = insertSystemAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.flatten() });
      }
      const role = req.workbenchSession?.activeRole === "system" ? "system" : "supervisor";
      const created = await storage.createSystemAnnouncement(withCreateMetadata({
        ...parsed.data,
        publishedBy: parsed.data.publishedBy ?? caller.employeeNumber,
      }, {
        userId: caller.employeeNumber,
        role,
        facilityKey: parsed.data.facilityKey ?? req.workbenchSession?.activeFacility,
      }));
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role,
        facilityKey: parsed.data.facilityKey ?? req.workbenchSession?.activeFacility,
        action: "SYSTEM_ANNOUNCEMENT_CREATED",
        resource: "system_announcements",
        resourceId: String(created.id),
        payload: { title: created.title, severity: created.severity },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
      res.status(201).json(created);
    } catch (err) {
      const m = err instanceof Error ? err.message : "建立失敗";
      console.error("[system-announcements:create_failed]", err);
      res.status(500).json({ message: m });
    }
  });

  app.patch("/api/portal/system-announcements/:id", requireSupervisor(), async (req, res) => {
    try {
      const caller = (req as unknown as { caller: EmployeeProfile }).caller;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "無效 ID" });
      const role = req.workbenchSession?.activeRole === "system" ? "system" : "supervisor";
      const updated = await storage.updateSystemAnnouncement(id, withUpdateMetadata(req.body || {}, {
        userId: caller.employeeNumber,
        role,
        facilityKey: req.workbenchSession?.activeFacility,
      }));
      if (!updated) return res.status(404).json({ message: "找不到資料" });
      await container.repositories.telemetry.recordAudit({
        actorId: caller.employeeNumber,
        role,
        facilityKey: updated.facilityKey ?? req.workbenchSession?.activeFacility,
        action: "SYSTEM_ANNOUNCEMENT_UPDATED",
        resource: "system_announcements",
        resourceId: String(updated.id),
        payload: { title: updated.title, severity: updated.severity },
        correlationId: correlationIdFromRequest(req),
        resultStatus: "success",
      });
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
};
