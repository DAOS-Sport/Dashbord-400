import {
  type User, type InsertUser,
  type AnomalyReport, type InsertAnomalyReport,
  type NotificationRecipient, type InsertNotificationRecipient,
  type HandoverEntry, type InsertHandoverEntry,
  type OperationalHandover, type InsertOperationalHandover,
  type Task, type InsertTask,
  type QuickLink, type InsertQuickLink,
  type EmployeeResource, type InsertEmployeeResource,
  type KnowledgeBaseQna, type InsertKnowledgeBaseQna,
  type SystemAnnouncement, type InsertSystemAnnouncement,
  type AnnouncementAcknowledgement, type InsertAnnouncementAcknowledgement,
  type PortalEvent, type InsertPortalEvent,
  type WidgetLayoutSetting, type InsertWidgetLayoutSetting,
  type WatchdogEvent, type InsertWatchdogEvent,
  type DailyTaskTemplate, type InsertDailyTaskTemplate,
  type LifeguardAssignedTask, type InsertLifeguardAssignedTask,
  type RecurringTaskTemplate, type InsertRecurringTaskTemplate,
  type WaterQualitySchedule, type InsertWaterQualitySchedule,
  type WaterQualityStandard, type InsertWaterQualityStandard,
  type WorkLogTaskCompletion, type InsertWorkLogTaskCompletion,
  type WaterQualityRecord, type InsertWaterQualityRecord,
  type LifeguardHandoverNote, type InsertLifeguardHandoverNote,
  type DailyReportSubmission, type InsertDailyReportSubmission,
  users, anomalyReports, notificationRecipients,
  handoverEntries, operationalHandovers, tasks, quickLinks, employeeResources, systemAnnouncements, portalEvents,
  knowledgeBaseQna, announcementAcknowledgements, widgetLayoutSettings, watchdogEvents,
  dailyTaskTemplates, lifeguardAssignedTasks, recurringTaskTemplates,
  waterQualitySchedules, waterQualityStandards, workLogTaskCompletions,
  waterQualityRecords, lifeguardHandoverNotes, dailyReportSubmissions,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, inArray, and, or, isNull, gte, lte, sql, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface AnomalyResolutionActor {
  userId: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createAnomalyReport(report: InsertAnomalyReport): Promise<AnomalyReport>;
  getAllAnomalyReports(): Promise<AnomalyReport[]>;
  getAnomalyReportById(id: number): Promise<AnomalyReport | undefined>;
  updateAnomalyReportResolution(id: number, resolution: string, resolvedNote: string | null, actor?: AnomalyResolutionActor): Promise<AnomalyReport | undefined>;
  batchUpdateResolution(ids: number[], resolution: string, resolvedNote: string | null, actor?: AnomalyResolutionActor): Promise<number>;
  deleteAnomalyReport(id: number): Promise<boolean>;
  getAllRecipients(): Promise<NotificationRecipient[]>;
  createRecipient(recipient: InsertNotificationRecipient): Promise<NotificationRecipient>;
  updateRecipient(id: number, data: Partial<InsertNotificationRecipient>): Promise<NotificationRecipient | undefined>;
  deleteRecipient(id: number): Promise<boolean>;

  // Handover (員工 KEY)
  listHandovers(facilityKey: string, limit?: number): Promise<HandoverEntry[]>;
  getHandoverById(id: number): Promise<HandoverEntry | undefined>;
  createHandover(entry: InsertHandoverEntry): Promise<HandoverEntry>;
  deleteHandover(id: number): Promise<boolean>;

  // Operational Handovers / 交班交接
  listOperationalHandovers(opts: { facilityKey?: string; status?: string; targetDate?: string; limit?: number }): Promise<OperationalHandover[]>;
  getOperationalHandoverById(id: number): Promise<OperationalHandover | undefined>;
  createOperationalHandover(task: InsertOperationalHandover): Promise<OperationalHandover>;
  updateOperationalHandover(id: number, data: Partial<InsertOperationalHandover & {
    assigneeEmployeeNumber: string | null;
    assigneeName: string | null;
    claimedByEmployeeNumber: string | null;
    claimedByName: string | null;
    reportedByEmployeeNumber: string | null;
    reportedByName: string | null;
    reportNote: string | null;
    completedAt: Date | null;
  }>): Promise<OperationalHandover | undefined>;
  deleteOperationalHandover(id: number): Promise<boolean>;

  // Tasks / 員工任務
  listTasks(opts: { facilityKey?: string; status?: string; userId?: string; includeCancelled?: boolean; limit?: number }): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask & { completedAt: Date | null }>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;

  // QuickLinks (主管維護)
  listQuickLinks(facilityKey?: string, includeInactive?: boolean): Promise<QuickLink[]>;
  createQuickLink(link: InsertQuickLink): Promise<QuickLink>;
  updateQuickLink(id: number, data: Partial<InsertQuickLink>): Promise<QuickLink | undefined>;
  deleteQuickLink(id: number): Promise<boolean>;

  // Employee resources (員工自建入口 / 便利貼)
  listEmployeeResources(opts: { facilityKey?: string; category?: string; limit?: number }): Promise<EmployeeResource[]>;
  createEmployeeResource(resource: InsertEmployeeResource): Promise<EmployeeResource>;
  updateEmployeeResource(id: number, data: Partial<InsertEmployeeResource>): Promise<EmployeeResource | undefined>;
  deleteEmployeeResource(id: number): Promise<boolean>;

  // Knowledge Base Q&A (相關問題詢問)
  listKnowledgeBaseQna(opts: { facilityKey?: string; query?: string; includeArchived?: boolean; limit?: number }): Promise<KnowledgeBaseQna[]>;
  getKnowledgeBaseQnaById(id: number): Promise<KnowledgeBaseQna | undefined>;
  createKnowledgeBaseQna(entry: InsertKnowledgeBaseQna): Promise<KnowledgeBaseQna>;
  updateKnowledgeBaseQna(id: number, data: Partial<InsertKnowledgeBaseQna>): Promise<KnowledgeBaseQna | undefined>;
  deleteKnowledgeBaseQna(id: number): Promise<boolean>;

  // SystemAnnouncements (主管維護)
  listSystemAnnouncements(facilityKey?: string, includeInactive?: boolean): Promise<SystemAnnouncement[]>;
  createSystemAnnouncement(ann: InsertSystemAnnouncement): Promise<SystemAnnouncement>;
  updateSystemAnnouncement(id: number, data: Partial<InsertSystemAnnouncement>): Promise<SystemAnnouncement | undefined>;
  deleteSystemAnnouncement(id: number): Promise<boolean>;
  listAnnouncementAcknowledgements(opts: { facilityKey?: string; userId?: string; announcementId?: string }): Promise<AnnouncementAcknowledgement[]>;
  acknowledgeAnnouncement(input: InsertAnnouncementAcknowledgement): Promise<AnnouncementAcknowledgement>;

  // Portal Events (analytics)
  recordPortalEvent(event: InsertPortalEvent): Promise<PortalEvent>;
  getWidgetLayout(opts: { facilityKey: string; role: string; layoutKey: string }): Promise<WidgetLayoutSetting | undefined>;
  upsertWidgetLayout(layout: InsertWidgetLayoutSetting): Promise<WidgetLayoutSetting>;
  createWatchdogEvent(event: InsertWatchdogEvent): Promise<WatchdogEvent>;
  listWatchdogEvents(limit?: number): Promise<WatchdogEvent[]>;
  getEventStats(opts: { sinceDays?: number; facilityKey?: string }): Promise<{
    totalEvents: number;
    byType: Array<{ eventType: string; count: number }>;
    topEmployees: Array<{ employeeNumber: string | null; employeeName: string | null; count: number }>;
    topTargets: Array<{ eventType: string; target: string | null; targetLabel: string | null; count: number }>;
    dailyCounts: Array<{ day: string; count: number }>;
  }>;

  // Work Logs (工作日誌)
  listDailyTaskTemplates(opts: { facilityKey: string; shiftType?: string; includeInactive?: boolean }): Promise<DailyTaskTemplate[]>;
  createDailyTaskTemplate(input: InsertDailyTaskTemplate): Promise<DailyTaskTemplate>;
  updateDailyTaskTemplate(id: number, data: Partial<InsertDailyTaskTemplate>): Promise<DailyTaskTemplate | undefined>;
  deleteDailyTaskTemplate(id: number): Promise<boolean>;

  listLifeguardAssignedTasks(opts: { facilityKey: string; workDate?: string; shiftType?: string; employeeNumber?: string; status?: string }): Promise<LifeguardAssignedTask[]>;
  createLifeguardAssignedTask(input: InsertLifeguardAssignedTask): Promise<LifeguardAssignedTask>;
  updateLifeguardAssignedTask(id: number, data: Partial<InsertLifeguardAssignedTask>): Promise<LifeguardAssignedTask | undefined>;
  deleteLifeguardAssignedTask(id: number): Promise<boolean>;

  listRecurringTaskTemplates(opts: { facilityKey: string; includeInactive?: boolean }): Promise<RecurringTaskTemplate[]>;
  createRecurringTaskTemplate(input: InsertRecurringTaskTemplate): Promise<RecurringTaskTemplate>;
  updateRecurringTaskTemplate(id: number, data: Partial<InsertRecurringTaskTemplate>): Promise<RecurringTaskTemplate | undefined>;
  deleteRecurringTaskTemplate(id: number): Promise<boolean>;

  listWaterQualitySchedules(opts: { facilityKey: string; shiftType?: string; includeInactive?: boolean }): Promise<WaterQualitySchedule[]>;
  createWaterQualitySchedule(input: InsertWaterQualitySchedule): Promise<WaterQualitySchedule>;
  updateWaterQualitySchedule(id: number, data: Partial<InsertWaterQualitySchedule>): Promise<WaterQualitySchedule | undefined>;
  deleteWaterQualitySchedule(id: number): Promise<boolean>;

  listWaterQualityStandards(opts: { facilityKey: string; poolName?: string; includeInactive?: boolean }): Promise<WaterQualityStandard[]>;
  createWaterQualityStandard(input: InsertWaterQualityStandard): Promise<WaterQualityStandard>;
  updateWaterQualityStandard(id: number, data: Partial<InsertWaterQualityStandard>): Promise<WaterQualityStandard | undefined>;
  deleteWaterQualityStandard(id: number): Promise<boolean>;

  listTaskCompletions(opts: { facilityKey: string; workDate: string; shiftType?: string }): Promise<WorkLogTaskCompletion[]>;
  upsertTaskCompletion(input: InsertWorkLogTaskCompletion): Promise<WorkLogTaskCompletion>;

  listWaterQualityRecords(opts: { facilityKey: string; workDate?: string; shiftType?: string; limit?: number }): Promise<WaterQualityRecord[]>;
  createWaterQualityRecord(input: InsertWaterQualityRecord): Promise<WaterQualityRecord>;

  listLifeguardHandoverNotes(opts: { facilityKey: string; workDate?: string; toShift?: string; fromShift?: string; limit?: number }): Promise<LifeguardHandoverNote[]>;
  getLifeguardHandoverNoteById(id: number): Promise<LifeguardHandoverNote | undefined>;
  createLifeguardHandoverNote(input: InsertLifeguardHandoverNote): Promise<LifeguardHandoverNote>;
  confirmLifeguardHandoverNote(id: number, by: { employeeNumber: string; name: string }): Promise<LifeguardHandoverNote | undefined>;

  listDailyReportSubmissions(opts: { facilityKey?: string; workDate?: string; status?: string; limit?: number }): Promise<DailyReportSubmission[]>;
  getDailyReportSubmission(opts: { facilityKey: string; workDate: string; shiftType: string; submittedBy: string }): Promise<DailyReportSubmission | undefined>;
  createDailyReportSubmission(input: InsertDailyReportSubmission): Promise<DailyReportSubmission>;
  updateDailyReportSubmissionReview(id: number, data: { status: string; reviewedBy: string; reviewedByName: string; reviewNote?: string | null }): Promise<DailyReportSubmission | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({ ...insertUser, id: randomUUID() }).returning();
    return user;
  }

  async createAnomalyReport(report: InsertAnomalyReport): Promise<AnomalyReport> {
    const [created] = await db.insert(anomalyReports).values(report).returning();
    return created;
  }

  async getAllAnomalyReports(): Promise<AnomalyReport[]> {
    return db.select().from(anomalyReports).orderBy(desc(anomalyReports.createdAt));
  }

  async getAnomalyReportById(id: number): Promise<AnomalyReport | undefined> {
    const [report] = await db.select().from(anomalyReports).where(eq(anomalyReports.id, id));
    return report;
  }

  async updateAnomalyReportResolution(id: number, resolution: string, resolvedNote: string | null, actor?: AnomalyResolutionActor): Promise<AnomalyReport | undefined> {
    const resolvedAt = resolution === "resolved" ? new Date() : null;
    const [updated] = await db
      .update(anomalyReports)
      .set({
        resolution,
        resolvedNote,
        resolvedBy: resolution === "resolved" ? actor?.userId ?? null : null,
        resolvedAt,
        updatedBy: actor?.userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(anomalyReports.id, id))
      .returning();
    return updated;
  }

  async batchUpdateResolution(ids: number[], resolution: string, resolvedNote: string | null, actor?: AnomalyResolutionActor): Promise<number> {
    const resolvedAt = resolution === "resolved" ? new Date() : null;
    const result = await db
      .update(anomalyReports)
      .set({
        resolution,
        resolvedNote,
        resolvedBy: resolution === "resolved" ? actor?.userId ?? null : null,
        resolvedAt,
        updatedBy: actor?.userId ?? null,
        updatedAt: new Date(),
      })
      .where(inArray(anomalyReports.id, ids))
      .returning();
    return result.length;
  }

  async deleteAnomalyReport(id: number): Promise<boolean> {
    const result = await db.delete(anomalyReports).where(eq(anomalyReports.id, id)).returning();
    return result.length > 0;
  }

  async getAllRecipients(): Promise<NotificationRecipient[]> {
    return db.select().from(notificationRecipients).orderBy(desc(notificationRecipients.createdAt));
  }

  async createRecipient(recipient: InsertNotificationRecipient): Promise<NotificationRecipient> {
    const [created] = await db.insert(notificationRecipients).values(recipient).returning();
    return created;
  }

  async updateRecipient(id: number, data: Partial<InsertNotificationRecipient>): Promise<NotificationRecipient | undefined> {
    const [updated] = await db.update(notificationRecipients).set(data).where(eq(notificationRecipients.id, id)).returning();
    return updated;
  }

  async deleteRecipient(id: number): Promise<boolean> {
    const result = await db.delete(notificationRecipients).where(eq(notificationRecipients.id, id)).returning();
    return result.length > 0;
  }

  async listHandovers(facilityKey: string, limit = 50): Promise<HandoverEntry[]> {
    return db.select().from(handoverEntries)
      .where(eq(handoverEntries.facilityKey, facilityKey))
      .orderBy(desc(handoverEntries.createdAt))
      .limit(limit);
  }

  async getHandoverById(id: number): Promise<HandoverEntry | undefined> {
    const [row] = await db.select().from(handoverEntries).where(eq(handoverEntries.id, id)).limit(1);
    return row;
  }

  async createHandover(entry: InsertHandoverEntry): Promise<HandoverEntry> {
    const [created] = await db.insert(handoverEntries).values(entry).returning();
    return created;
  }

  async deleteHandover(id: number): Promise<boolean> {
    const result = await db.delete(handoverEntries).where(eq(handoverEntries.id, id)).returning();
    return result.length > 0;
  }

  async listOperationalHandovers(opts: { facilityKey?: string; status?: string; targetDate?: string; limit?: number }): Promise<OperationalHandover[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(operationalHandovers.facilityKey, opts.facilityKey));
    if (opts.status) conditions.push(eq(operationalHandovers.status, opts.status));
    if (opts.targetDate) conditions.push(eq(operationalHandovers.targetDate, opts.targetDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = where ? db.select().from(operationalHandovers).where(where) : db.select().from(operationalHandovers);
    return query
      .orderBy(desc(operationalHandovers.targetDate), desc(operationalHandovers.createdAt))
      .limit(Math.min(opts.limit ?? 100, 300));
  }

  async getOperationalHandoverById(id: number): Promise<OperationalHandover | undefined> {
    const [row] = await db.select().from(operationalHandovers).where(eq(operationalHandovers.id, id)).limit(1);
    return row;
  }

  async createOperationalHandover(task: InsertOperationalHandover): Promise<OperationalHandover> {
    const [created] = await db.insert(operationalHandovers).values(task).returning();
    return created;
  }

  async updateOperationalHandover(id: number, data: Partial<InsertOperationalHandover & {
    assigneeEmployeeNumber: string | null;
    assigneeName: string | null;
    claimedByEmployeeNumber: string | null;
    claimedByName: string | null;
    reportedByEmployeeNumber: string | null;
    reportedByName: string | null;
    reportNote: string | null;
    completedAt: Date | null;
  }>): Promise<OperationalHandover | undefined> {
    const [updated] = await db
      .update(operationalHandovers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationalHandovers.id, id))
      .returning();
    return updated;
  }

  async deleteOperationalHandover(id: number): Promise<boolean> {
    const result = await db.delete(operationalHandovers).where(eq(operationalHandovers.id, id)).returning();
    return result.length > 0;
  }

  async listTasks(opts: { facilityKey?: string; status?: string; userId?: string; includeCancelled?: boolean; limit?: number }): Promise<Task[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(tasks.facilityKey, opts.facilityKey));
    if (opts.status) conditions.push(eq(tasks.status, opts.status));
    if (!opts.includeCancelled) conditions.push(sql`${tasks.status} <> 'cancelled'`);
    if (opts.userId) {
      conditions.push(or(eq(tasks.createdByUserId, opts.userId), eq(tasks.assignedToUserId, opts.userId), isNull(tasks.assignedToUserId))!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = where ? db.select().from(tasks).where(where) : db.select().from(tasks);
    return query.orderBy(desc(tasks.dueAt), desc(tasks.createdAt)).limit(Math.min(opts.limit ?? 100, 300));
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return row;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: number, data: Partial<InsertTask & { completedAt: Date | null }>): Promise<Task | undefined> {
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  async listQuickLinks(facilityKey?: string, includeInactive = false): Promise<QuickLink[]> {
    const conditions = [];
    if (!includeInactive) conditions.push(eq(quickLinks.isActive, true));
    if (facilityKey) {
      conditions.push(or(eq(quickLinks.facilityKey, facilityKey), isNull(quickLinks.facilityKey))!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const q = where ? db.select().from(quickLinks).where(where) : db.select().from(quickLinks);
    return q.orderBy(quickLinks.sortOrder, desc(quickLinks.createdAt));
  }

  async createQuickLink(link: InsertQuickLink): Promise<QuickLink> {
    const [created] = await db.insert(quickLinks).values(link).returning();
    return created;
  }

  async updateQuickLink(id: number, data: Partial<InsertQuickLink>): Promise<QuickLink | undefined> {
    const [updated] = await db.update(quickLinks).set(data).where(eq(quickLinks.id, id)).returning();
    return updated;
  }

  async deleteQuickLink(id: number): Promise<boolean> {
    const result = await db.delete(quickLinks).where(eq(quickLinks.id, id)).returning();
    return result.length > 0;
  }

  async listEmployeeResources(opts: { facilityKey?: string; category?: string; limit?: number }): Promise<EmployeeResource[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(employeeResources.facilityKey, opts.facilityKey));
    if (opts.category) conditions.push(eq(employeeResources.category, opts.category));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = where ? db.select().from(employeeResources).where(where) : db.select().from(employeeResources);
    return query
      .orderBy(desc(employeeResources.isPinned), asc(employeeResources.sortOrder), asc(employeeResources.eventStartAt), asc(employeeResources.scheduledAt), desc(employeeResources.createdAt))
      .limit(Math.min(opts.limit ?? 100, 200));
  }

  async createEmployeeResource(resource: InsertEmployeeResource): Promise<EmployeeResource> {
    const [created] = await db.insert(employeeResources).values(resource).returning();
    return created;
  }

  async updateEmployeeResource(id: number, data: Partial<InsertEmployeeResource>): Promise<EmployeeResource | undefined> {
    const [updated] = await db
      .update(employeeResources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeResources.id, id))
      .returning();
    return updated;
  }

  async deleteEmployeeResource(id: number): Promise<boolean> {
    const result = await db.delete(employeeResources).where(eq(employeeResources.id, id)).returning();
    return result.length > 0;
  }

  async listKnowledgeBaseQna(opts: { facilityKey?: string; query?: string; includeArchived?: boolean; limit?: number }): Promise<KnowledgeBaseQna[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(knowledgeBaseQna.facilityKey, opts.facilityKey));
    if (!opts.includeArchived) conditions.push(sql`${knowledgeBaseQna.status} <> 'archived'`);
    const query = opts.query?.trim();
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(or(
        ilike(knowledgeBaseQna.question, pattern),
        ilike(knowledgeBaseQna.answer, pattern),
        ilike(knowledgeBaseQna.category, pattern),
        sql`array_to_string(${knowledgeBaseQna.tags}, ' ') ILIKE ${pattern}`,
      )!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const q = where ? db.select().from(knowledgeBaseQna).where(where) : db.select().from(knowledgeBaseQna);
    return q
      .orderBy(desc(knowledgeBaseQna.isPinned), desc(knowledgeBaseQna.updatedAt), desc(knowledgeBaseQna.createdAt))
      .limit(Math.min(opts.limit ?? 100, 200));
  }

  async getKnowledgeBaseQnaById(id: number): Promise<KnowledgeBaseQna | undefined> {
    const [row] = await db.select().from(knowledgeBaseQna).where(eq(knowledgeBaseQna.id, id)).limit(1);
    return row;
  }

  async createKnowledgeBaseQna(entry: InsertKnowledgeBaseQna): Promise<KnowledgeBaseQna> {
    const [created] = await db.insert(knowledgeBaseQna).values(entry).returning();
    return created;
  }

  async updateKnowledgeBaseQna(id: number, data: Partial<InsertKnowledgeBaseQna>): Promise<KnowledgeBaseQna | undefined> {
    const [updated] = await db
      .update(knowledgeBaseQna)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(knowledgeBaseQna.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBaseQna(id: number): Promise<boolean> {
    const [archived] = await db
      .update(knowledgeBaseQna)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(knowledgeBaseQna.id, id))
      .returning();
    return Boolean(archived);
  }

  async listSystemAnnouncements(facilityKey?: string, includeInactive = false): Promise<SystemAnnouncement[]> {
    const conditions = [];
    if (!includeInactive) {
      const now = new Date();
      conditions.push(eq(systemAnnouncements.isActive, true));
      conditions.push(lte(systemAnnouncements.publishedAt, now));
      conditions.push(or(isNull(systemAnnouncements.expiresAt), gte(systemAnnouncements.expiresAt, now))!);
    }
    if (facilityKey) {
      conditions.push(or(eq(systemAnnouncements.facilityKey, facilityKey), isNull(systemAnnouncements.facilityKey))!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const q = where ? db.select().from(systemAnnouncements).where(where) : db.select().from(systemAnnouncements);
    return q.orderBy(desc(systemAnnouncements.isPinned), desc(systemAnnouncements.publishedAt));
  }

  async createSystemAnnouncement(ann: InsertSystemAnnouncement): Promise<SystemAnnouncement> {
    const [created] = await db.insert(systemAnnouncements).values(ann).returning();
    return created;
  }

  async updateSystemAnnouncement(id: number, data: Partial<InsertSystemAnnouncement>): Promise<SystemAnnouncement | undefined> {
    const [updated] = await db.update(systemAnnouncements).set(data).where(eq(systemAnnouncements.id, id)).returning();
    return updated;
  }

  async deleteSystemAnnouncement(id: number): Promise<boolean> {
    const result = await db.delete(systemAnnouncements).where(eq(systemAnnouncements.id, id)).returning();
    return result.length > 0;
  }

  async listAnnouncementAcknowledgements(opts: { facilityKey?: string; userId?: string; announcementId?: string }): Promise<AnnouncementAcknowledgement[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(announcementAcknowledgements.facilityKey, opts.facilityKey));
    if (opts.userId) conditions.push(eq(announcementAcknowledgements.userId, opts.userId));
    if (opts.announcementId) conditions.push(eq(announcementAcknowledgements.announcementId, opts.announcementId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = where ? db.select().from(announcementAcknowledgements).where(where) : db.select().from(announcementAcknowledgements);
    return query.orderBy(desc(announcementAcknowledgements.acknowledgedAt));
  }

  async acknowledgeAnnouncement(input: InsertAnnouncementAcknowledgement): Promise<AnnouncementAcknowledgement> {
    const [existing] = await this.listAnnouncementAcknowledgements({
      facilityKey: input.facilityKey,
      userId: input.userId,
      announcementId: input.announcementId,
    });
    if (existing) return existing;
    const [created] = await db.insert(announcementAcknowledgements).values(input).returning();
    return created;
  }

  async recordPortalEvent(event: InsertPortalEvent): Promise<PortalEvent> {
    const [created] = await db.insert(portalEvents).values(event).returning();
    return created;
  }

  async getWidgetLayout(opts: { facilityKey: string; role: string; layoutKey: string }): Promise<WidgetLayoutSetting | undefined> {
    const [row] = await db
      .select()
      .from(widgetLayoutSettings)
      .where(and(
        eq(widgetLayoutSettings.facilityKey, opts.facilityKey),
        eq(widgetLayoutSettings.role, opts.role),
        eq(widgetLayoutSettings.layoutKey, opts.layoutKey),
      ))
      .orderBy(desc(widgetLayoutSettings.updatedAt))
      .limit(1);
    return row;
  }

  async upsertWidgetLayout(layout: InsertWidgetLayoutSetting): Promise<WidgetLayoutSetting> {
    const existing = await this.getWidgetLayout({
      facilityKey: layout.facilityKey,
      role: layout.role,
      layoutKey: layout.layoutKey,
    });
    if (existing) {
      const [updated] = await db
        .update(widgetLayoutSettings)
        .set({ ...layout, updatedAt: new Date() })
        .where(eq(widgetLayoutSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(widgetLayoutSettings).values(layout).returning();
    return created;
  }

  async createWatchdogEvent(event: InsertWatchdogEvent): Promise<WatchdogEvent> {
    const [created] = await db.insert(watchdogEvents).values(event).returning();
    return created;
  }

  async listWatchdogEvents(limit = 50): Promise<WatchdogEvent[]> {
    return db.select().from(watchdogEvents).orderBy(desc(watchdogEvents.observedAt)).limit(Math.min(limit, 200));
  }

  async getEventStats(opts: { sinceDays?: number; facilityKey?: string }): Promise<{
    totalEvents: number;
    byType: Array<{ eventType: string; count: number }>;
    topEmployees: Array<{ employeeNumber: string | null; employeeName: string | null; count: number }>;
    topTargets: Array<{ eventType: string; target: string | null; targetLabel: string | null; count: number }>;
    dailyCounts: Array<{ day: string; count: number }>;
  }> {
    const sinceDays = opts.sinceDays ?? 30;
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const conditions = [gte(portalEvents.createdAt, sinceDate)];
    if (opts.facilityKey) conditions.push(eq(portalEvents.facilityKey, opts.facilityKey));
    const where = and(...conditions);

    const [totalRow] = await db.select({ c: sql<number>`count(*)::int` }).from(portalEvents).where(where);

    const byType = await db
      .select({ eventType: portalEvents.eventType, count: sql<number>`count(*)::int` })
      .from(portalEvents)
      .where(where)
      .groupBy(portalEvents.eventType)
      .orderBy(desc(sql`count(*)`));

    const topEmployees = await db
      .select({
        employeeNumber: portalEvents.employeeNumber,
        employeeName: portalEvents.employeeName,
        count: sql<number>`count(*)::int`,
      })
      .from(portalEvents)
      .where(where)
      .groupBy(portalEvents.employeeNumber, portalEvents.employeeName)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    const topTargets = await db
      .select({
        eventType: portalEvents.eventType,
        target: portalEvents.target,
        targetLabel: portalEvents.targetLabel,
        count: sql<number>`count(*)::int`,
      })
      .from(portalEvents)
      .where(where)
      .groupBy(portalEvents.eventType, portalEvents.target, portalEvents.targetLabel)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    const dailyCounts = await db
      .select({
        day: sql<string>`to_char(${portalEvents.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(portalEvents)
      .where(where)
      .groupBy(sql`to_char(${portalEvents.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${portalEvents.createdAt}, 'YYYY-MM-DD')`);

    return {
      totalEvents: totalRow?.c ?? 0,
      byType,
      topEmployees,
      topTargets,
      dailyCounts,
    };
  }

  // ===================================================================
  // Work Logs (工作日誌)
  // ===================================================================

  async listDailyTaskTemplates(opts: { facilityKey: string; shiftType?: string; includeInactive?: boolean }): Promise<DailyTaskTemplate[]> {
    const conditions = [eq(dailyTaskTemplates.facilityKey, opts.facilityKey)];
    if (!opts.includeInactive) conditions.push(eq(dailyTaskTemplates.isActive, true));
    if (opts.shiftType && opts.shiftType !== "all") {
      conditions.push(inArray(dailyTaskTemplates.shiftType, [opts.shiftType, "all"]));
    }
    return db.select().from(dailyTaskTemplates).where(and(...conditions))
      .orderBy(asc(dailyTaskTemplates.sortOrder), asc(dailyTaskTemplates.id));
  }

  async createDailyTaskTemplate(input: InsertDailyTaskTemplate): Promise<DailyTaskTemplate> {
    const [row] = await db.insert(dailyTaskTemplates).values(input).returning();
    return row;
  }

  async updateDailyTaskTemplate(id: number, data: Partial<InsertDailyTaskTemplate>): Promise<DailyTaskTemplate | undefined> {
    const [row] = await db.update(dailyTaskTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dailyTaskTemplates.id, id)).returning();
    return row;
  }

  async deleteDailyTaskTemplate(id: number): Promise<boolean> {
    const result = await db.delete(dailyTaskTemplates).where(eq(dailyTaskTemplates.id, id)).returning();
    return result.length > 0;
  }

  async listLifeguardAssignedTasks(opts: { facilityKey: string; workDate?: string; shiftType?: string; employeeNumber?: string; status?: string }): Promise<LifeguardAssignedTask[]> {
    const conditions = [eq(lifeguardAssignedTasks.facilityKey, opts.facilityKey)];
    if (opts.status) conditions.push(eq(lifeguardAssignedTasks.status, opts.status));
    if (opts.workDate) {
      conditions.push(or(
        isNull(lifeguardAssignedTasks.taskDate),
        eq(lifeguardAssignedTasks.taskDate, opts.workDate),
      )!);
    }
    if (opts.shiftType && opts.shiftType !== "all") {
      conditions.push(or(
        isNull(lifeguardAssignedTasks.assignedToShift),
        eq(lifeguardAssignedTasks.assignedToShift, "all"),
        eq(lifeguardAssignedTasks.assignedToShift, opts.shiftType),
      )!);
    }
    if (opts.employeeNumber) {
      conditions.push(or(
        isNull(lifeguardAssignedTasks.assignedToEmployeeNumber),
        eq(lifeguardAssignedTasks.assignedToEmployeeNumber, opts.employeeNumber),
      )!);
    }
    return db.select().from(lifeguardAssignedTasks).where(and(...conditions))
      .orderBy(asc(lifeguardAssignedTasks.id));
  }

  async createLifeguardAssignedTask(input: InsertLifeguardAssignedTask): Promise<LifeguardAssignedTask> {
    const [row] = await db.insert(lifeguardAssignedTasks).values(input).returning();
    return row;
  }

  async updateLifeguardAssignedTask(id: number, data: Partial<InsertLifeguardAssignedTask>): Promise<LifeguardAssignedTask | undefined> {
    const [row] = await db.update(lifeguardAssignedTasks).set(data)
      .where(eq(lifeguardAssignedTasks.id, id)).returning();
    return row;
  }

  async deleteLifeguardAssignedTask(id: number): Promise<boolean> {
    const result = await db.delete(lifeguardAssignedTasks).where(eq(lifeguardAssignedTasks.id, id)).returning();
    return result.length > 0;
  }

  async listRecurringTaskTemplates(opts: { facilityKey: string; includeInactive?: boolean }): Promise<RecurringTaskTemplate[]> {
    const conditions = [eq(recurringTaskTemplates.facilityKey, opts.facilityKey)];
    if (!opts.includeInactive) conditions.push(eq(recurringTaskTemplates.isActive, true));
    return db.select().from(recurringTaskTemplates).where(and(...conditions))
      .orderBy(asc(recurringTaskTemplates.id));
  }

  async createRecurringTaskTemplate(input: InsertRecurringTaskTemplate): Promise<RecurringTaskTemplate> {
    const [row] = await db.insert(recurringTaskTemplates).values(input).returning();
    return row;
  }

  async updateRecurringTaskTemplate(id: number, data: Partial<InsertRecurringTaskTemplate>): Promise<RecurringTaskTemplate | undefined> {
    const [row] = await db.update(recurringTaskTemplates).set(data)
      .where(eq(recurringTaskTemplates.id, id)).returning();
    return row;
  }

  async deleteRecurringTaskTemplate(id: number): Promise<boolean> {
    const result = await db.delete(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id)).returning();
    return result.length > 0;
  }

  async listWaterQualitySchedules(opts: { facilityKey: string; shiftType?: string; includeInactive?: boolean }): Promise<WaterQualitySchedule[]> {
    const conditions = [eq(waterQualitySchedules.facilityKey, opts.facilityKey)];
    if (!opts.includeInactive) conditions.push(eq(waterQualitySchedules.isActive, true));
    if (opts.shiftType && opts.shiftType !== "all") {
      conditions.push(inArray(waterQualitySchedules.shiftType, [opts.shiftType, "all"]));
    }
    return db.select().from(waterQualitySchedules).where(and(...conditions))
      .orderBy(asc(waterQualitySchedules.scheduledTime));
  }

  async createWaterQualitySchedule(input: InsertWaterQualitySchedule): Promise<WaterQualitySchedule> {
    const [row] = await db.insert(waterQualitySchedules).values(input).returning();
    return row;
  }

  async updateWaterQualitySchedule(id: number, data: Partial<InsertWaterQualitySchedule>): Promise<WaterQualitySchedule | undefined> {
    const [row] = await db.update(waterQualitySchedules).set(data)
      .where(eq(waterQualitySchedules.id, id)).returning();
    return row;
  }

  async deleteWaterQualitySchedule(id: number): Promise<boolean> {
    const result = await db.delete(waterQualitySchedules).where(eq(waterQualitySchedules.id, id)).returning();
    return result.length > 0;
  }

  async listWaterQualityStandards(opts: { facilityKey: string; poolName?: string; includeInactive?: boolean }): Promise<WaterQualityStandard[]> {
    const conditions = [eq(waterQualityStandards.facilityKey, opts.facilityKey)];
    if (!opts.includeInactive) conditions.push(eq(waterQualityStandards.isActive, true));
    if (opts.poolName) conditions.push(eq(waterQualityStandards.poolName, opts.poolName));
    return db.select().from(waterQualityStandards).where(and(...conditions))
      .orderBy(asc(waterQualityStandards.poolName), asc(waterQualityStandards.parameterName));
  }

  async createWaterQualityStandard(input: InsertWaterQualityStandard): Promise<WaterQualityStandard> {
    const [row] = await db.insert(waterQualityStandards).values(input).returning();
    return row;
  }

  async updateWaterQualityStandard(id: number, data: Partial<InsertWaterQualityStandard>): Promise<WaterQualityStandard | undefined> {
    const [row] = await db.update(waterQualityStandards).set(data)
      .where(eq(waterQualityStandards.id, id)).returning();
    return row;
  }

  async deleteWaterQualityStandard(id: number): Promise<boolean> {
    const result = await db.delete(waterQualityStandards).where(eq(waterQualityStandards.id, id)).returning();
    return result.length > 0;
  }

  async listTaskCompletions(opts: { facilityKey: string; workDate: string; shiftType?: string }): Promise<WorkLogTaskCompletion[]> {
    const conditions = [
      eq(workLogTaskCompletions.facilityKey, opts.facilityKey),
      eq(workLogTaskCompletions.workDate, opts.workDate),
    ];
    if (opts.shiftType) conditions.push(eq(workLogTaskCompletions.shiftType, opts.shiftType));
    return db.select().from(workLogTaskCompletions).where(and(...conditions));
  }

  async upsertTaskCompletion(input: InsertWorkLogTaskCompletion): Promise<WorkLogTaskCompletion> {
    const existing = await db.select().from(workLogTaskCompletions).where(and(
      eq(workLogTaskCompletions.facilityKey, input.facilityKey),
      eq(workLogTaskCompletions.workDate, input.workDate),
      eq(workLogTaskCompletions.shiftType, input.shiftType),
      eq(workLogTaskCompletions.taskSource, input.taskSource),
      eq(workLogTaskCompletions.taskRefId, input.taskRefId),
    )).limit(1);

    const completedAt = input.isCompleted ? new Date() : null;

    if (existing.length > 0) {
      const [row] = await db.update(workLogTaskCompletions)
        .set({
          inputValue: input.inputValue ?? null,
          isCompleted: input.isCompleted ?? false,
          completedBy: input.completedBy ?? null,
          completedByName: input.completedByName ?? null,
          completedAt,
          notes: input.notes ?? null,
          taskName: input.taskName,
          updatedAt: new Date(),
        })
        .where(eq(workLogTaskCompletions.id, existing[0].id))
        .returning();
      return row;
    }
    const [row] = await db.insert(workLogTaskCompletions).values({ ...input, completedAt }).returning();
    return row;
  }

  async listWaterQualityRecords(opts: { facilityKey: string; workDate?: string; shiftType?: string; limit?: number }): Promise<WaterQualityRecord[]> {
    const conditions = [eq(waterQualityRecords.facilityKey, opts.facilityKey)];
    if (opts.workDate) conditions.push(eq(waterQualityRecords.workDate, opts.workDate));
    if (opts.shiftType) conditions.push(eq(waterQualityRecords.shiftType, opts.shiftType));
    return db.select().from(waterQualityRecords).where(and(...conditions))
      .orderBy(desc(waterQualityRecords.recordedAt))
      .limit(Math.min(opts.limit ?? 200, 500));
  }

  async createWaterQualityRecord(input: InsertWaterQualityRecord): Promise<WaterQualityRecord> {
    const [row] = await db.insert(waterQualityRecords).values(input).returning();
    return row;
  }

  async listLifeguardHandoverNotes(opts: { facilityKey: string; workDate?: string; toShift?: string; fromShift?: string; limit?: number }): Promise<LifeguardHandoverNote[]> {
    const conditions = [eq(lifeguardHandoverNotes.facilityKey, opts.facilityKey)];
    if (opts.workDate) conditions.push(eq(lifeguardHandoverNotes.workDate, opts.workDate));
    if (opts.toShift) conditions.push(eq(lifeguardHandoverNotes.toShift, opts.toShift));
    if (opts.fromShift) conditions.push(eq(lifeguardHandoverNotes.fromShift, opts.fromShift));
    return db.select().from(lifeguardHandoverNotes).where(and(...conditions))
      .orderBy(desc(lifeguardHandoverNotes.createdAt))
      .limit(Math.min(opts.limit ?? 100, 500));
  }

  async getLifeguardHandoverNoteById(id: number): Promise<LifeguardHandoverNote | undefined> {
    const [row] = await db.select().from(lifeguardHandoverNotes).where(eq(lifeguardHandoverNotes.id, id)).limit(1);
    return row;
  }

  async createLifeguardHandoverNote(input: InsertLifeguardHandoverNote): Promise<LifeguardHandoverNote> {
    const [row] = await db.insert(lifeguardHandoverNotes).values(input).returning();
    return row;
  }

  async confirmLifeguardHandoverNote(id: number, by: { employeeNumber: string; name: string }): Promise<LifeguardHandoverNote | undefined> {
    const [row] = await db.update(lifeguardHandoverNotes).set({
      isConfirmed: true,
      confirmedBy: by.employeeNumber,
      confirmedByName: by.name,
      confirmedAt: new Date(),
    }).where(eq(lifeguardHandoverNotes.id, id)).returning();
    return row;
  }

  async listDailyReportSubmissions(opts: { facilityKey?: string; workDate?: string; status?: string; limit?: number }): Promise<DailyReportSubmission[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(dailyReportSubmissions.facilityKey, opts.facilityKey));
    if (opts.workDate) conditions.push(eq(dailyReportSubmissions.workDate, opts.workDate));
    if (opts.status) conditions.push(eq(dailyReportSubmissions.status, opts.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const q = db.select().from(dailyReportSubmissions);
    return (where ? q.where(where) : q)
      .orderBy(desc(dailyReportSubmissions.submittedAt))
      .limit(Math.min(opts.limit ?? 100, 500));
  }

  async getDailyReportSubmission(opts: { facilityKey: string; workDate: string; shiftType: string; submittedBy: string }): Promise<DailyReportSubmission | undefined> {
    const [row] = await db.select().from(dailyReportSubmissions).where(and(
      eq(dailyReportSubmissions.facilityKey, opts.facilityKey),
      eq(dailyReportSubmissions.workDate, opts.workDate),
      eq(dailyReportSubmissions.shiftType, opts.shiftType),
      eq(dailyReportSubmissions.submittedBy, opts.submittedBy),
    )).orderBy(desc(dailyReportSubmissions.submittedAt)).limit(1);
    return row;
  }

  async createDailyReportSubmission(input: InsertDailyReportSubmission): Promise<DailyReportSubmission> {
    const [row] = await db.insert(dailyReportSubmissions).values(input).returning();
    return row;
  }

  async updateDailyReportSubmissionReview(id: number, data: { status: string; reviewedBy: string; reviewedByName: string; reviewNote?: string | null }): Promise<DailyReportSubmission | undefined> {
    const [row] = await db.update(dailyReportSubmissions).set({
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedByName: data.reviewedByName,
      reviewNote: data.reviewNote ?? null,
      reviewedAt: new Date(),
    }).where(eq(dailyReportSubmissions.id, id)).returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
