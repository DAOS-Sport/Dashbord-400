import {
  type User, type InsertUser,
  type AnomalyReport, type InsertAnomalyReport,
  type NotificationRecipient, type InsertNotificationRecipient,
  type HandoverEntry, type InsertHandoverEntry,
  type OperationalHandover, type InsertOperationalHandover,
  type Task, type InsertTask,
  type QuickLink, type InsertQuickLink,
  type EmployeeResource, type InsertEmployeeResource,
  type SystemAnnouncement, type InsertSystemAnnouncement,
  type AnnouncementAcknowledgement, type InsertAnnouncementAcknowledgement,
  type PortalEvent, type InsertPortalEvent,
  type WidgetLayoutSetting, type InsertWidgetLayoutSetting,
  type WatchdogEvent, type InsertWatchdogEvent,
  users, anomalyReports, notificationRecipients,
  handoverEntries, operationalHandovers, tasks, quickLinks, employeeResources, systemAnnouncements, portalEvents,
  announcementAcknowledgements, widgetLayoutSettings, watchdogEvents,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, and, or, isNull, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createAnomalyReport(report: InsertAnomalyReport): Promise<AnomalyReport>;
  getAllAnomalyReports(): Promise<AnomalyReport[]>;
  getAnomalyReportById(id: number): Promise<AnomalyReport | undefined>;
  updateAnomalyReportResolution(id: number, resolution: string, resolvedNote: string | null): Promise<AnomalyReport | undefined>;
  batchUpdateResolution(ids: number[], resolution: string, resolvedNote: string | null): Promise<number>;
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

  async updateAnomalyReportResolution(id: number, resolution: string, resolvedNote: string | null): Promise<AnomalyReport | undefined> {
    const [updated] = await db
      .update(anomalyReports)
      .set({ resolution, resolvedNote })
      .where(eq(anomalyReports.id, id))
      .returning();
    return updated;
  }

  async batchUpdateResolution(ids: number[], resolution: string, resolvedNote: string | null): Promise<number> {
    const result = await db
      .update(anomalyReports)
      .set({ resolution, resolvedNote })
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
    return query.orderBy(desc(employeeResources.isPinned), desc(employeeResources.createdAt)).limit(Math.min(opts.limit ?? 100, 200));
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

  async listSystemAnnouncements(facilityKey?: string, includeInactive = false): Promise<SystemAnnouncement[]> {
    const conditions = [];
    if (!includeInactive) conditions.push(eq(systemAnnouncements.isActive, true));
    if (facilityKey) {
      conditions.push(or(eq(systemAnnouncements.facilityKey, facilityKey), isNull(systemAnnouncements.facilityKey))!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const q = where ? db.select().from(systemAnnouncements).where(where) : db.select().from(systemAnnouncements);
    return q.orderBy(desc(systemAnnouncements.publishedAt));
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
}

export const storage = new DatabaseStorage();
