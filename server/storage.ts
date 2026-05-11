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
  type FacilityAnnouncementGroup, type InsertFacilityAnnouncementGroup,
  announcementOverlays, type AnnouncementOverlay, type InsertAnnouncementOverlay,
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
  type WorkLogReviewAction, type InsertWorkLogReviewAction,
  type LifeguardWaterQualityLog, type InsertLifeguardWaterQualityLog,
  type LifeguardCoachDiveLog, type InsertLifeguardCoachDiveLog,
  type LifeguardCleanupLog, type InsertLifeguardCleanupLog,
  type LifeguardLostAndFound, type InsertLifeguardLostAndFound,
  type LaneRental, type InsertLaneRental,
  type ParkingPlan, type InsertParkingPlan,
  type ParkingVehicle, type InsertParkingVehicle,
  type ParkingContract, type InsertParkingContract,
  type ParkingPayment, type InsertParkingPayment,
  type ParkingEventDay, type InsertParkingEventDay,
  users, anomalyReports, notificationRecipients,
  handoverEntries, operationalHandovers, tasks, quickLinks, employeeResources, systemAnnouncements, facilityAnnouncementGroups, portalEvents,
  knowledgeBaseQna, announcementAcknowledgements, widgetLayoutSettings, watchdogEvents,
  dailyTaskTemplates, lifeguardAssignedTasks, recurringTaskTemplates,
  waterQualitySchedules, waterQualityStandards, workLogTaskCompletions,
  waterQualityRecords, lifeguardHandoverNotes, dailyReportSubmissions, workLogReviewActions,
  lifeguardWaterQualityLogs, lifeguardCoachDiveLogs, lifeguardCleanupLogs, lifeguardLostAndFound,
  laneRentals,
  parkingPlans, parkingVehicles, parkingContracts, parkingPayments, parkingEventDays,
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
  listEmployeeResources(opts: { facilityKey?: string; category?: string; ownerEmployeeNumber?: string; limit?: number }): Promise<EmployeeResource[]>;
  createEmployeeResource(resource: InsertEmployeeResource): Promise<EmployeeResource>;
  updateEmployeeResource(id: number, data: Partial<InsertEmployeeResource>): Promise<EmployeeResource | undefined>;
  deleteEmployeeResource(id: number): Promise<boolean>;

  // Knowledge Base Q&A (相關問題詢問)
  listKnowledgeBaseQna(opts: {
    facilityKey?: string;
    query?: string;
    includeArchived?: boolean;
    viewerEmployeeNumber?: string;
    reviewStatus?: "pending" | "approved" | "rejected";
    includeAllReviewStatuses?: boolean;
    limit?: number;
  }): Promise<KnowledgeBaseQna[]>;
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
  listAnnouncementGroups(filters?: { facilityKey?: string; isActive?: boolean }): Promise<FacilityAnnouncementGroup[]>;
  getAnnouncementGroupById(id: number): Promise<FacilityAnnouncementGroup | undefined>;
  createAnnouncementGroup(input: InsertFacilityAnnouncementGroup): Promise<FacilityAnnouncementGroup>;
  updateAnnouncementGroup(id: number, patch: Partial<InsertFacilityAnnouncementGroup>): Promise<FacilityAnnouncementGroup | undefined>;
  deleteAnnouncementGroup(id: number): Promise<boolean>;

  // Announcement overlays (hide / pin-with-expiry / note)
  getAnnouncementOverlays(announcementIds: string[]): Promise<Map<string, AnnouncementOverlay>>;
  listHiddenAnnouncementOverlays(): Promise<AnnouncementOverlay[]>;
  upsertAnnouncementOverlay(input: InsertAnnouncementOverlay): Promise<AnnouncementOverlay>;

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
  listDailyTaskTemplates(opts: { facilityKey: string; moduleType?: string; shiftType?: string; includeInactive?: boolean }): Promise<DailyTaskTemplate[]>;
  createDailyTaskTemplate(input: InsertDailyTaskTemplate): Promise<DailyTaskTemplate>;
  updateDailyTaskTemplate(id: number, data: Partial<InsertDailyTaskTemplate>): Promise<DailyTaskTemplate | undefined>;
  deleteDailyTaskTemplate(id: number): Promise<boolean>;

  listLifeguardAssignedTasks(opts: { facilityKey: string; moduleType?: string; workDate?: string; taskDate?: string; shiftType?: string; employeeNumber?: string; status?: string }): Promise<LifeguardAssignedTask[]>;
  createLifeguardAssignedTask(input: InsertLifeguardAssignedTask): Promise<LifeguardAssignedTask>;
  updateLifeguardAssignedTask(id: number, data: Partial<InsertLifeguardAssignedTask>): Promise<LifeguardAssignedTask | undefined>;
  deleteLifeguardAssignedTask(id: number): Promise<boolean>;

  listRecurringTaskTemplates(opts: { facilityKey: string; moduleType?: string; includeInactive?: boolean }): Promise<RecurringTaskTemplate[]>;
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
  /**
   * Insert-or-update a water quality record.
   * - If `input.scheduleId` is provided, the natural key is
   *   `(facilityKey, workDate, shiftType, scheduleId)` — when an existing
   *   row matches, it is updated in place; otherwise a new row is inserted.
   * - If `input.scheduleId` is null/undefined, this falls back to a plain
   *   insert (ad-hoc, off-schedule entries always create a new row).
   */
  upsertWaterQualityRecord(input: InsertWaterQualityRecord): Promise<WaterQualityRecord>;

  listLifeguardHandoverNotes(opts: { facilityKey: string; workDate?: string; toShift?: string; fromShift?: string; limit?: number }): Promise<LifeguardHandoverNote[]>;
  getLifeguardHandoverNoteById(id: number): Promise<LifeguardHandoverNote | undefined>;
  createLifeguardHandoverNote(input: InsertLifeguardHandoverNote): Promise<LifeguardHandoverNote>;
  confirmLifeguardHandoverNote(id: number, by: { employeeNumber: string; name: string }): Promise<LifeguardHandoverNote | undefined>;

  listDailyReportSubmissions(opts: { facilityKey?: string; moduleType?: string; workDate?: string; fromDate?: string; toDate?: string; status?: string; limit?: number }): Promise<DailyReportSubmission[]>;
  getDailyReportSubmission(opts: { facilityKey: string; workDate: string; shiftType: string; submittedBy: string }): Promise<DailyReportSubmission | undefined>;
  getDailyReportSubmissionById(id: number): Promise<DailyReportSubmission | undefined>;
  createDailyReportSubmission(input: InsertDailyReportSubmission): Promise<DailyReportSubmission>;
  updateDailyReportSubmissionReview(id: number, data: { status: string; reviewedBy: string; reviewedByName: string; reviewNote?: string | null }): Promise<DailyReportSubmission | undefined>;
  createWorkLogReviewAction(input: InsertWorkLogReviewAction): Promise<WorkLogReviewAction>;
  listWorkLogReviewActionsBySubmission(submissionId: number): Promise<WorkLogReviewAction[]>;
  recordDailyReportReview(id: number, data: {
    action: "approve" | "return";
    reviewerEmployeeNumber: string;
    reviewerName: string;
    note: string | null;
  }): Promise<{ submission: DailyReportSubmission; reviewAction: WorkLogReviewAction } | undefined>;

  // Lifeguard operation modules
  listLifeguardWaterQualityLogs(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; limit?: number }): Promise<LifeguardWaterQualityLog[]>;
  createLifeguardWaterQualityLog(input: InsertLifeguardWaterQualityLog): Promise<LifeguardWaterQualityLog>;
  listLifeguardCoachDiveLogs(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; limit?: number }): Promise<LifeguardCoachDiveLog[]>;
  createLifeguardCoachDiveLog(input: InsertLifeguardCoachDiveLog): Promise<LifeguardCoachDiveLog>;
  listLifeguardCleanupLogs(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; limit?: number }): Promise<LifeguardCleanupLog[]>;
  createLifeguardCleanupLog(input: InsertLifeguardCleanupLog): Promise<LifeguardCleanupLog>;
  listLifeguardLostAndFound(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; claimStatus?: string; itemCategory?: string; limit?: number }): Promise<LifeguardLostAndFound[]>;
  getLifeguardLostAndFoundById(id: number): Promise<LifeguardLostAndFound | undefined>;
  createLifeguardLostAndFound(input: InsertLifeguardLostAndFound): Promise<LifeguardLostAndFound>;
  updateLifeguardLostAndFoundClaim(id: number, data: {
    claimStatus: "claimed" | "disposed";
    updatedBy: string;
    claimedByName?: string | null;
    claimedByContact?: string | null;
    claimedHandlerUserId?: string | null;
    claimNote?: string | null;
    disposedByUserId?: string | null;
    disposedReason?: string | null;
  }): Promise<LifeguardLostAndFound | undefined>;

  // Lane rentals (水道租借)
  listLaneRentals(opts: { facilityKey: string; bookingDate?: string; status?: string }): Promise<LaneRental[]>;
  getLaneRentalById(id: number): Promise<LaneRental | undefined>;
  findLaneRentalConflicts(opts: { facilityKey: string; bookingDate: string; laneCode: string; startTime: string; endTime: string; excludeId?: number }): Promise<LaneRental[]>;
  createLaneRental(input: InsertLaneRental): Promise<LaneRental>;
  updateLaneRental(id: number, data: Partial<InsertLaneRental>): Promise<LaneRental | undefined>;
  deleteLaneRental(id: number): Promise<boolean>;

  // Parking — plans
  listParkingPlans(opts?: { includeInactive?: boolean }): Promise<ParkingPlan[]>;
  getParkingPlanById(id: number): Promise<ParkingPlan | undefined>;
  createParkingPlan(input: InsertParkingPlan): Promise<ParkingPlan>;
  updateParkingPlan(id: number, data: Partial<InsertParkingPlan>): Promise<ParkingPlan | undefined>;
  deleteParkingPlan(id: number): Promise<boolean>;

  // Parking — vehicles
  listParkingVehicles(opts: { search?: string; vehicleType?: string; status?: string; expiringWithinDays?: number; limit?: number; offset?: number }): Promise<{ items: ParkingVehicle[]; total: number }>;
  getParkingVehicleById(id: number): Promise<ParkingVehicle | undefined>;
  getParkingVehicleByPlate(plate: string): Promise<ParkingVehicle | undefined>;
  createParkingVehicle(input: InsertParkingVehicle): Promise<ParkingVehicle>;
  updateParkingVehicle(id: number, data: Partial<InsertParkingVehicle>): Promise<ParkingVehicle | undefined>;
  deleteParkingVehicle(id: number): Promise<boolean>;

  // Parking — contracts
  listParkingContracts(opts: { status?: string; vehicleId?: number; limit?: number }): Promise<ParkingContract[]>;
  getParkingContractById(id: number): Promise<ParkingContract | undefined>;
  getParkingContractByTokenHash(hash: string): Promise<ParkingContract | undefined>;
  generateContractNumber(): Promise<string>;
  createParkingContract(input: InsertParkingContract & { contractNumber: string }): Promise<ParkingContract>;
  updateParkingContract(id: number, data: Partial<InsertParkingContract> & {
    signedAt?: Date | null;
    terminatedAt?: Date | null;
    refundedAt?: Date | null;
    signTokenHash?: string | null;
    signTokenExpiresAt?: Date | null;
    signedFromIp?: string | null;
    signedUserAgent?: string | null;
    signerName?: string | null;
    signerIdLast4?: string | null;
    signatureImageUrl?: string | null;
    vehicleRegPhotoUrl?: string | null;
    driverLicensePhotoUrl?: string | null;
    idCardPhotoUrl?: string | null;
  }): Promise<ParkingContract | undefined>;
  deleteParkingContract(id: number): Promise<boolean>;

  // Parking — payments
  listParkingPayments(opts: { status?: string; contractId?: number; limit?: number }): Promise<ParkingPayment[]>;
  getParkingPaymentById(id: number): Promise<ParkingPayment | undefined>;
  createParkingPayment(input: InsertParkingPayment): Promise<ParkingPayment>;
  reviewParkingPayment(id: number, data: { status: "approved" | "rejected"; reviewedBy: string; reviewedByName: string; reviewNote?: string | null }): Promise<ParkingPayment | undefined>;

  // Parking — event days
  listParkingEventDays(opts: { fromDate?: string; toDate?: string }): Promise<ParkingEventDay[]>;
  getParkingEventDayById(id: number): Promise<ParkingEventDay | undefined>;
  createParkingEventDay(input: InsertParkingEventDay): Promise<ParkingEventDay>;
  updateParkingEventDay(id: number, data: Partial<InsertParkingEventDay>): Promise<ParkingEventDay | undefined>;
  deleteParkingEventDay(id: number): Promise<boolean>;

  // Parking — dashboard summary aggregator
  parkingDashboardSummary(): Promise<{
    activeVehicleCount: number;
    expiringSoonCount: number;
    pendingPaymentReviewCount: number;
    notSignedCount: number;
    overdueCount: number;
    todayEventDayCount: number;
    monthRevenue: number;
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

  async listEmployeeResources(opts: { facilityKey?: string; category?: string; ownerEmployeeNumber?: string; limit?: number }): Promise<EmployeeResource[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(employeeResources.facilityKey, opts.facilityKey));
    if (opts.category) conditions.push(eq(employeeResources.category, opts.category));
    if (opts.category === "sticky_note") {
      if (opts.ownerEmployeeNumber) {
        conditions.push(eq(employeeResources.createdByEmployeeNumber, opts.ownerEmployeeNumber));
      } else {
        conditions.push(sql`${employeeResources.category} <> 'sticky_note'`);
      }
    } else if (!opts.category) {
      conditions.push(
        opts.ownerEmployeeNumber
          ? or(sql`${employeeResources.category} <> 'sticky_note'`, eq(employeeResources.createdByEmployeeNumber, opts.ownerEmployeeNumber))!
          : sql`${employeeResources.category} <> 'sticky_note'`,
      );
    }
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

  async listKnowledgeBaseQna(opts: {
    facilityKey?: string;
    query?: string;
    includeArchived?: boolean;
    viewerEmployeeNumber?: string;
    reviewStatus?: "pending" | "approved" | "rejected";
    includeAllReviewStatuses?: boolean;
    limit?: number;
  }): Promise<KnowledgeBaseQna[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(knowledgeBaseQna.facilityKey, opts.facilityKey));
    if (!opts.includeArchived) conditions.push(sql`${knowledgeBaseQna.status} <> 'archived'`);
    if (opts.reviewStatus) {
      conditions.push(eq(knowledgeBaseQna.reviewStatus, opts.reviewStatus));
    } else if (!opts.includeAllReviewStatuses) {
      conditions.push(
        opts.viewerEmployeeNumber
          ? or(eq(knowledgeBaseQna.reviewStatus, "approved"), eq(knowledgeBaseQna.createdByEmployeeNumber, opts.viewerEmployeeNumber))!
          : eq(knowledgeBaseQna.reviewStatus, "approved"),
      );
    }
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

  async listAnnouncementGroups(filters: { facilityKey?: string; isActive?: boolean } = {}): Promise<FacilityAnnouncementGroup[]> {
    const conditions = [];
    if (filters.facilityKey) conditions.push(eq(facilityAnnouncementGroups.facilityKey, filters.facilityKey));
    if (typeof filters.isActive === "boolean") conditions.push(eq(facilityAnnouncementGroups.isActive, filters.isActive));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = where ? db.select().from(facilityAnnouncementGroups).where(where) : db.select().from(facilityAnnouncementGroups);
    return query.orderBy(asc(facilityAnnouncementGroups.facilityKey), asc(facilityAnnouncementGroups.label));
  }

  async getAnnouncementGroupById(id: number): Promise<FacilityAnnouncementGroup | undefined> {
    const [row] = await db.select().from(facilityAnnouncementGroups).where(eq(facilityAnnouncementGroups.id, id)).limit(1);
    return row;
  }

  async createAnnouncementGroup(input: InsertFacilityAnnouncementGroup): Promise<FacilityAnnouncementGroup> {
    const [created] = await db.insert(facilityAnnouncementGroups).values(input).returning();
    return created;
  }

  async updateAnnouncementGroup(id: number, patch: Partial<InsertFacilityAnnouncementGroup>): Promise<FacilityAnnouncementGroup | undefined> {
    const [updated] = await db
      .update(facilityAnnouncementGroups)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(facilityAnnouncementGroups.id, id))
      .returning();
    return updated;
  }

  async deleteAnnouncementGroup(id: number): Promise<boolean> {
    const rows = await db.delete(facilityAnnouncementGroups).where(eq(facilityAnnouncementGroups.id, id)).returning();
    return rows.length > 0;
  }

  async getAnnouncementOverlays(announcementIds: string[]): Promise<Map<string, AnnouncementOverlay>> {
    const map = new Map<string, AnnouncementOverlay>();
    if (announcementIds.length === 0) return map;
    const rows = await db.select().from(announcementOverlays).where(inArray(announcementOverlays.announcementId, announcementIds));
    for (const row of rows) map.set(row.announcementId, row);
    return map;
  }

  async listHiddenAnnouncementOverlays(): Promise<AnnouncementOverlay[]> {
    return db.select().from(announcementOverlays).where(eq(announcementOverlays.isHidden, true)).orderBy(desc(announcementOverlays.updatedAt));
  }

  async upsertAnnouncementOverlay(input: InsertAnnouncementOverlay): Promise<AnnouncementOverlay> {
    const now = new Date();
    const [row] = await db
      .insert(announcementOverlays)
      .values({ ...input, updatedAt: now })
      .onConflictDoUpdate({
        target: announcementOverlays.announcementId,
        set: {
          ...(input.isHidden !== undefined ? { isHidden: input.isHidden } : {}),
          ...(input.pinnedUntil !== undefined ? { pinnedUntil: input.pinnedUntil } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          lastModifiedBy: input.lastModifiedBy,
          lastModifiedByName: input.lastModifiedByName ?? null,
          lastModifiedRole: input.lastModifiedRole,
          updatedAt: now,
        },
      })
      .returning();
    return row;
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

  async listDailyTaskTemplates(opts: { facilityKey: string; moduleType?: string; shiftType?: string; includeInactive?: boolean }): Promise<DailyTaskTemplate[]> {
    const conditions = [eq(dailyTaskTemplates.facilityKey, opts.facilityKey)];
    if (opts.moduleType) conditions.push(eq(dailyTaskTemplates.moduleType, opts.moduleType));
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

  async listLifeguardAssignedTasks(opts: { facilityKey: string; moduleType?: string; workDate?: string; taskDate?: string; shiftType?: string; employeeNumber?: string; status?: string }): Promise<LifeguardAssignedTask[]> {
    const conditions = [eq(lifeguardAssignedTasks.facilityKey, opts.facilityKey)];
    if (opts.moduleType) conditions.push(eq(lifeguardAssignedTasks.moduleType, opts.moduleType));
    if (opts.status) conditions.push(eq(lifeguardAssignedTasks.status, opts.status));
    if (opts.taskDate) {
      conditions.push(eq(lifeguardAssignedTasks.taskDate, opts.taskDate));
    } else if (opts.workDate) {
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

  async listRecurringTaskTemplates(opts: { facilityKey: string; moduleType?: string; includeInactive?: boolean }): Promise<RecurringTaskTemplate[]> {
    const conditions = [eq(recurringTaskTemplates.facilityKey, opts.facilityKey)];
    if (opts.moduleType) conditions.push(eq(recurringTaskTemplates.moduleType, opts.moduleType));
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

  async upsertWaterQualityRecord(input: InsertWaterQualityRecord): Promise<WaterQualityRecord> {
    if (input.scheduleId !== undefined && input.scheduleId !== null) {
      const [existing] = await db.select().from(waterQualityRecords).where(and(
        eq(waterQualityRecords.facilityKey, input.facilityKey),
        eq(waterQualityRecords.workDate, input.workDate),
        eq(waterQualityRecords.shiftType, input.shiftType),
        eq(waterQualityRecords.scheduleId, input.scheduleId),
      )).limit(1);
      if (existing) {
        const [updated] = await db.update(waterQualityRecords)
          .set({
            poolName: input.poolName,
            scheduledTime: input.scheduledTime ?? existing.scheduledTime,
            measurements: input.measurements,
            isAbnormal: input.isAbnormal ?? false,
            abnormalNote: input.abnormalNote ?? null,
            photoUrls: input.photoUrls ?? null,
            recordedBy: input.recordedBy ?? existing.recordedBy,
            recordedByName: input.recordedByName ?? existing.recordedByName,
            recordedAt: new Date(),
          })
          .where(eq(waterQualityRecords.id, existing.id))
          .returning();
        return updated;
      }
    }
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

  async listDailyReportSubmissions(opts: { facilityKey?: string; moduleType?: string; workDate?: string; fromDate?: string; toDate?: string; status?: string; limit?: number }): Promise<DailyReportSubmission[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(dailyReportSubmissions.facilityKey, opts.facilityKey));
    if (opts.moduleType) conditions.push(eq(dailyReportSubmissions.moduleType, opts.moduleType));
    if (opts.workDate) conditions.push(eq(dailyReportSubmissions.workDate, opts.workDate));
    if (opts.fromDate) conditions.push(gte(dailyReportSubmissions.workDate, opts.fromDate));
    if (opts.toDate) conditions.push(lte(dailyReportSubmissions.workDate, opts.toDate));
    if (opts.status) conditions.push(eq(dailyReportSubmissions.status, opts.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const q = db.select().from(dailyReportSubmissions);
    return (where ? q.where(where) : q)
      .orderBy(desc(dailyReportSubmissions.workDate), desc(dailyReportSubmissions.submittedAt))
      .limit(Math.min(opts.limit ?? 100, 2000));
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

  async getDailyReportSubmissionById(id: number): Promise<DailyReportSubmission | undefined> {
    const [row] = await db.select().from(dailyReportSubmissions).where(eq(dailyReportSubmissions.id, id)).limit(1);
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

  async createWorkLogReviewAction(input: InsertWorkLogReviewAction): Promise<WorkLogReviewAction> {
    const [row] = await db.insert(workLogReviewActions).values(input).returning();
    return row;
  }

  async listWorkLogReviewActionsBySubmission(submissionId: number): Promise<WorkLogReviewAction[]> {
    return db.select().from(workLogReviewActions)
      .where(eq(workLogReviewActions.submissionId, submissionId))
      .orderBy(asc(workLogReviewActions.createdAt));
  }

  async recordDailyReportReview(id: number, data: {
    action: "approve" | "return";
    reviewerEmployeeNumber: string;
    reviewerName: string;
    note: string | null;
  }): Promise<{ submission: DailyReportSubmission; reviewAction: WorkLogReviewAction } | undefined> {
    return await db.transaction(async (tx) => {
      const [submission] = await tx.update(dailyReportSubmissions).set({
        status: data.action === "approve" ? "approved" : "returned",
        reviewedBy: data.reviewerEmployeeNumber,
        reviewedByName: data.reviewerName,
        reviewNote: data.note,
        reviewedAt: new Date(),
      }).where(eq(dailyReportSubmissions.id, id)).returning();
      if (!submission) return undefined;
      const [reviewAction] = await tx.insert(workLogReviewActions).values({
        submissionId: id,
        action: data.action,
        reviewerEmployeeNumber: data.reviewerEmployeeNumber,
        reviewerName: data.reviewerName,
        note: data.note,
      }).returning();
      return { submission, reviewAction };
    });
  }

  async listLifeguardWaterQualityLogs(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; limit?: number }): Promise<LifeguardWaterQualityLog[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(lifeguardWaterQualityLogs.facilityKey, opts.facilityKey));
    if (opts.facilityKeys?.length) conditions.push(inArray(lifeguardWaterQualityLogs.facilityKey, opts.facilityKeys));
    if (opts.fromDate) conditions.push(gte(lifeguardWaterQualityLogs.createdAt, opts.fromDate));
    if (opts.toDate) conditions.push(lte(lifeguardWaterQualityLogs.createdAt, opts.toDate));
    if (opts.createdBy) conditions.push(eq(lifeguardWaterQualityLogs.createdBy, opts.createdBy));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(lifeguardWaterQualityLogs);
    return (where ? q.where(where) : q).orderBy(desc(lifeguardWaterQualityLogs.createdAt)).limit(Math.min(opts.limit ?? 100, 500));
  }

  async createLifeguardWaterQualityLog(input: InsertLifeguardWaterQualityLog): Promise<LifeguardWaterQualityLog> {
    const [row] = await db.insert(lifeguardWaterQualityLogs).values(input).returning();
    return row;
  }

  async listLifeguardCoachDiveLogs(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; limit?: number }): Promise<LifeguardCoachDiveLog[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(lifeguardCoachDiveLogs.facilityKey, opts.facilityKey));
    if (opts.facilityKeys?.length) conditions.push(inArray(lifeguardCoachDiveLogs.facilityKey, opts.facilityKeys));
    if (opts.fromDate) conditions.push(gte(lifeguardCoachDiveLogs.createdAt, opts.fromDate));
    if (opts.toDate) conditions.push(lte(lifeguardCoachDiveLogs.createdAt, opts.toDate));
    if (opts.createdBy) conditions.push(eq(lifeguardCoachDiveLogs.createdBy, opts.createdBy));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(lifeguardCoachDiveLogs);
    return (where ? q.where(where) : q).orderBy(desc(lifeguardCoachDiveLogs.createdAt)).limit(Math.min(opts.limit ?? 100, 500));
  }

  async createLifeguardCoachDiveLog(input: InsertLifeguardCoachDiveLog): Promise<LifeguardCoachDiveLog> {
    const [row] = await db.insert(lifeguardCoachDiveLogs).values(input).returning();
    return row;
  }

  async listLifeguardCleanupLogs(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; limit?: number }): Promise<LifeguardCleanupLog[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(lifeguardCleanupLogs.facilityKey, opts.facilityKey));
    if (opts.facilityKeys?.length) conditions.push(inArray(lifeguardCleanupLogs.facilityKey, opts.facilityKeys));
    if (opts.fromDate) conditions.push(gte(lifeguardCleanupLogs.createdAt, opts.fromDate));
    if (opts.toDate) conditions.push(lte(lifeguardCleanupLogs.createdAt, opts.toDate));
    if (opts.createdBy) conditions.push(eq(lifeguardCleanupLogs.createdBy, opts.createdBy));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(lifeguardCleanupLogs);
    return (where ? q.where(where) : q).orderBy(desc(lifeguardCleanupLogs.createdAt)).limit(Math.min(opts.limit ?? 100, 500));
  }

  async createLifeguardCleanupLog(input: InsertLifeguardCleanupLog): Promise<LifeguardCleanupLog> {
    const [row] = await db.insert(lifeguardCleanupLogs).values(input).returning();
    return row;
  }

  async listLifeguardLostAndFound(opts: { facilityKeys?: string[]; facilityKey?: string; fromDate?: Date; toDate?: Date; createdBy?: string; claimStatus?: string; itemCategory?: string; limit?: number }): Promise<LifeguardLostAndFound[]> {
    const conditions = [];
    if (opts.facilityKey) conditions.push(eq(lifeguardLostAndFound.facilityKey, opts.facilityKey));
    if (opts.facilityKeys?.length) conditions.push(inArray(lifeguardLostAndFound.facilityKey, opts.facilityKeys));
    if (opts.fromDate) conditions.push(gte(lifeguardLostAndFound.createdAt, opts.fromDate));
    if (opts.toDate) conditions.push(lte(lifeguardLostAndFound.createdAt, opts.toDate));
    if (opts.createdBy) conditions.push(eq(lifeguardLostAndFound.createdBy, opts.createdBy));
    if (opts.claimStatus) conditions.push(eq(lifeguardLostAndFound.claimStatus, opts.claimStatus));
    if (opts.itemCategory) conditions.push(eq(lifeguardLostAndFound.itemCategory, opts.itemCategory));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(lifeguardLostAndFound);
    return (where ? q.where(where) : q).orderBy(desc(lifeguardLostAndFound.createdAt)).limit(Math.min(opts.limit ?? 100, 500));
  }

  async getLifeguardLostAndFoundById(id: number): Promise<LifeguardLostAndFound | undefined> {
    const [row] = await db.select().from(lifeguardLostAndFound).where(eq(lifeguardLostAndFound.id, id)).limit(1);
    return row;
  }

  async createLifeguardLostAndFound(input: InsertLifeguardLostAndFound): Promise<LifeguardLostAndFound> {
    const [row] = await db.insert(lifeguardLostAndFound).values(input).returning();
    return row;
  }

  async updateLifeguardLostAndFoundClaim(id: number, data: {
    claimStatus: "claimed" | "disposed";
    updatedBy: string;
    claimedByName?: string | null;
    claimedByContact?: string | null;
    claimedHandlerUserId?: string | null;
    claimNote?: string | null;
    disposedByUserId?: string | null;
    disposedReason?: string | null;
  }): Promise<LifeguardLostAndFound | undefined> {
    const existing = await this.getLifeguardLostAndFoundById(id);
    if (!existing || existing.claimStatus !== "unclaimed") return undefined;
    const now = new Date();
    const patch = data.claimStatus === "claimed"
      ? {
          claimStatus: "claimed",
          updatedBy: data.updatedBy,
          updatedAt: now,
          claimedByName: data.claimedByName ?? null,
          claimedByContact: data.claimedByContact ?? null,
          claimedHandlerUserId: data.claimedHandlerUserId ?? data.updatedBy,
          claimNote: data.claimNote ?? null,
          claimedAt: now,
        }
      : {
          claimStatus: "disposed",
          updatedBy: data.updatedBy,
          updatedAt: now,
          disposedByUserId: data.disposedByUserId ?? data.updatedBy,
          disposedReason: data.disposedReason ?? null,
          disposedAt: now,
        };
    const [row] = await db.update(lifeguardLostAndFound).set(patch).where(eq(lifeguardLostAndFound.id, id)).returning();
    return row;
  }

  // ==================== Parking (停車場會員與租約) ====================
  // --- Plans ---
  async listParkingPlans(opts: { includeInactive?: boolean } = {}): Promise<ParkingPlan[]> {
    const conditions = [];
    if (!opts.includeInactive) conditions.push(eq(parkingPlans.isActive, true));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(parkingPlans);
    return (where ? q.where(where) : q).orderBy(asc(parkingPlans.displayOrder), asc(parkingPlans.id));
  }
  async getParkingPlanById(id: number): Promise<ParkingPlan | undefined> {
    const [row] = await db.select().from(parkingPlans).where(eq(parkingPlans.id, id)).limit(1);
    return row;
  }
  async createParkingPlan(input: InsertParkingPlan): Promise<ParkingPlan> {
    const [row] = await db.insert(parkingPlans).values(input).returning();
    return row;
  }
  async updateParkingPlan(id: number, data: Partial<InsertParkingPlan>): Promise<ParkingPlan | undefined> {
    const [row] = await db.update(parkingPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(parkingPlans.id, id)).returning();
    return row;
  }
  async deleteParkingPlan(id: number): Promise<boolean> {
    const result = await db.delete(parkingPlans).where(eq(parkingPlans.id, id)).returning();
    return result.length > 0;
  }

  // --- Vehicles ---
  async listParkingVehicles(opts: { search?: string; vehicleType?: string; status?: string; expiringWithinDays?: number; limit?: number; offset?: number }): Promise<{ items: ParkingVehicle[]; total: number }> {
    const conditions = [];
    if (opts.vehicleType) conditions.push(eq(parkingVehicles.vehicleType, opts.vehicleType));
    if (opts.status) conditions.push(eq(parkingVehicles.status, opts.status));
    if (opts.search) {
      const s = `%${opts.search.trim()}%`;
      const orParts = [
        ilike(parkingVehicles.licensePlate, s),
        ilike(parkingVehicles.ownerName, s),
        ilike(parkingVehicles.ownerPhone, s),
      ];
      const orClause = or(...orParts);
      if (orClause) conditions.push(orClause);
    }
    if (typeof opts.expiringWithinDays === "number") {
      const today = new Date();
      const limit = new Date();
      limit.setDate(today.getDate() + opts.expiringWithinDays);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      conditions.push(gte(parkingVehicles.expiresAt, fmt(today)));
      conditions.push(lte(parkingVehicles.expiresAt, fmt(limit)));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(opts.limit ?? 100, 500);
    const offset = opts.offset ?? 0;
    const baseList = db.select().from(parkingVehicles);
    const items = await (where ? baseList.where(where) : baseList)
      .orderBy(desc(parkingVehicles.updatedAt))
      .limit(limit).offset(offset);
    const baseCount = db.select({ c: sql<number>`count(*)::int` }).from(parkingVehicles);
    const [{ c }] = await (where ? baseCount.where(where) : baseCount);
    return { items, total: c };
  }
  async getParkingVehicleById(id: number): Promise<ParkingVehicle | undefined> {
    const [row] = await db.select().from(parkingVehicles).where(eq(parkingVehicles.id, id)).limit(1);
    return row;
  }
  async getParkingVehicleByPlate(plate: string): Promise<ParkingVehicle | undefined> {
    const [row] = await db.select().from(parkingVehicles).where(eq(parkingVehicles.licensePlate, plate)).limit(1);
    return row;
  }
  async createParkingVehicle(input: InsertParkingVehicle): Promise<ParkingVehicle> {
    const [row] = await db.insert(parkingVehicles).values(input).returning();
    return row;
  }
  async updateParkingVehicle(id: number, data: Partial<InsertParkingVehicle>): Promise<ParkingVehicle | undefined> {
    const [row] = await db.update(parkingVehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(parkingVehicles.id, id)).returning();
    return row;
  }
  async deleteParkingVehicle(id: number): Promise<boolean> {
    const result = await db.delete(parkingVehicles).where(eq(parkingVehicles.id, id)).returning();
    return result.length > 0;
  }

  // --- Contracts ---
  async listParkingContracts(opts: { status?: string; vehicleId?: number; limit?: number }): Promise<ParkingContract[]> {
    const conditions = [];
    if (opts.status) conditions.push(eq(parkingContracts.status, opts.status));
    if (opts.vehicleId) conditions.push(eq(parkingContracts.vehicleId, opts.vehicleId));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(parkingContracts);
    return (where ? q.where(where) : q)
      .orderBy(desc(parkingContracts.createdAt))
      .limit(Math.min(opts.limit ?? 200, 1000));
  }
  async getParkingContractById(id: number): Promise<ParkingContract | undefined> {
    const [row] = await db.select().from(parkingContracts).where(eq(parkingContracts.id, id)).limit(1);
    return row;
  }
  async getParkingContractByTokenHash(hash: string): Promise<ParkingContract | undefined> {
    const [row] = await db.select().from(parkingContracts).where(eq(parkingContracts.signTokenHash, hash)).limit(1);
    return row;
  }
  async generateContractNumber(): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `PK-${ym}-`;
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` })
      .from(parkingContracts)
      .where(ilike(parkingContracts.contractNumber, `${prefix}%`));
    const seq = String((c ?? 0) + 1).padStart(4, "0");
    return `${prefix}${seq}`;
  }
  async createParkingContract(input: InsertParkingContract & { contractNumber: string }): Promise<ParkingContract> {
    const [row] = await db.insert(parkingContracts).values(input).returning();
    return row;
  }
  async updateParkingContract(id: number, data: Partial<InsertParkingContract> & {
    signedAt?: Date | null;
    terminatedAt?: Date | null;
    refundedAt?: Date | null;
    signTokenHash?: string | null;
    signTokenExpiresAt?: Date | null;
    signedFromIp?: string | null;
    signedUserAgent?: string | null;
    signerName?: string | null;
    signerIdLast4?: string | null;
    signatureImageUrl?: string | null;
    vehicleRegPhotoUrl?: string | null;
    driverLicensePhotoUrl?: string | null;
    idCardPhotoUrl?: string | null;
  }): Promise<ParkingContract | undefined> {
    const [row] = await db.update(parkingContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(parkingContracts.id, id)).returning();
    return row;
  }
  async deleteParkingContract(id: number): Promise<boolean> {
    const result = await db.delete(parkingContracts).where(eq(parkingContracts.id, id)).returning();
    return result.length > 0;
  }

  // --- Payments ---
  async listParkingPayments(opts: { status?: string; contractId?: number; limit?: number }): Promise<ParkingPayment[]> {
    const conditions = [];
    if (opts.status) conditions.push(eq(parkingPayments.status, opts.status));
    if (opts.contractId) conditions.push(eq(parkingPayments.contractId, opts.contractId));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(parkingPayments);
    return (where ? q.where(where) : q)
      .orderBy(desc(parkingPayments.reportedAt))
      .limit(Math.min(opts.limit ?? 200, 1000));
  }
  async getParkingPaymentById(id: number): Promise<ParkingPayment | undefined> {
    const [row] = await db.select().from(parkingPayments).where(eq(parkingPayments.id, id)).limit(1);
    return row;
  }
  async createParkingPayment(input: InsertParkingPayment): Promise<ParkingPayment> {
    const [row] = await db.insert(parkingPayments).values(input).returning();
    return row;
  }
  async reviewParkingPayment(id: number, data: { status: "approved" | "rejected"; reviewedBy: string; reviewedByName: string; reviewNote?: string | null }): Promise<ParkingPayment | undefined> {
    const [row] = await db.update(parkingPayments).set({
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedByName: data.reviewedByName,
      reviewNote: data.reviewNote ?? null,
      reviewedAt: new Date(),
    }).where(eq(parkingPayments.id, id)).returning();
    return row;
  }

  // --- Event days ---
  async listParkingEventDays(opts: { fromDate?: string; toDate?: string }): Promise<ParkingEventDay[]> {
    const conditions = [];
    if (opts.fromDate) conditions.push(gte(parkingEventDays.eventDate, opts.fromDate));
    if (opts.toDate) conditions.push(lte(parkingEventDays.eventDate, opts.toDate));
    const where = conditions.length ? and(...conditions) : undefined;
    const q = db.select().from(parkingEventDays);
    return (where ? q.where(where) : q).orderBy(asc(parkingEventDays.eventDate));
  }
  async getParkingEventDayById(id: number): Promise<ParkingEventDay | undefined> {
    const [row] = await db.select().from(parkingEventDays).where(eq(parkingEventDays.id, id)).limit(1);
    return row;
  }
  async createParkingEventDay(input: InsertParkingEventDay): Promise<ParkingEventDay> {
    const [row] = await db.insert(parkingEventDays).values(input).returning();
    return row;
  }
  async updateParkingEventDay(id: number, data: Partial<InsertParkingEventDay>): Promise<ParkingEventDay | undefined> {
    const [row] = await db.update(parkingEventDays).set(data).where(eq(parkingEventDays.id, id)).returning();
    return row;
  }
  async deleteParkingEventDay(id: number): Promise<boolean> {
    const result = await db.delete(parkingEventDays).where(eq(parkingEventDays.id, id)).returning();
    return result.length > 0;
  }

  // --- Dashboard ---
  async parkingDashboardSummary() {
    const today = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayStr = fmt(today);
    const in30 = new Date(); in30.setDate(today.getDate() + 30);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [activeVehicles] = await db.select({ c: sql<number>`count(*)::int` }).from(parkingVehicles).where(eq(parkingVehicles.status, "active"));
    const [expiring] = await db.select({ c: sql<number>`count(*)::int` }).from(parkingVehicles).where(and(
      eq(parkingVehicles.status, "active"),
      gte(parkingVehicles.expiresAt, todayStr),
      lte(parkingVehicles.expiresAt, fmt(in30)),
    ));
    const [pendingReview] = await db.select({ c: sql<number>`count(*)::int` }).from(parkingPayments).where(eq(parkingPayments.status, "pending"));
    const [notSigned] = await db.select({ c: sql<number>`count(*)::int` }).from(parkingContracts).where(inArray(parkingContracts.status, ["awaiting_sign", "draft"]));
    const [overdue] = await db.select({ c: sql<number>`count(*)::int` }).from(parkingVehicles).where(eq(parkingVehicles.status, "expired"));
    const [todayEvents] = await db.select({ c: sql<number>`count(*)::int` }).from(parkingEventDays).where(eq(parkingEventDays.eventDate, todayStr));
    const [revenue] = await db.select({ s: sql<number>`coalesce(sum(amount), 0)::int` }).from(parkingPayments).where(and(
      eq(parkingPayments.status, "approved"),
      gte(parkingPayments.reviewedAt, monthStart),
    ));

    return {
      activeVehicleCount: activeVehicles.c,
      expiringSoonCount: expiring.c,
      pendingPaymentReviewCount: pendingReview.c,
      notSignedCount: notSigned.c,
      overdueCount: overdue.c,
      todayEventDayCount: todayEvents.c,
      monthRevenue: revenue.s,
    };
  }

  // ==================== Lane rentals (水道租借) ====================

  async listLaneRentals(opts: { facilityKey: string; bookingDate?: string; status?: string }): Promise<LaneRental[]> {
    const conditions = [eq(laneRentals.facilityKey, opts.facilityKey)];
    if (opts.bookingDate) conditions.push(eq(laneRentals.bookingDate, opts.bookingDate));
    if (opts.status) conditions.push(eq(laneRentals.status, opts.status));
    return db.select().from(laneRentals).where(and(...conditions))
      .orderBy(asc(laneRentals.bookingDate), asc(laneRentals.laneCode), asc(laneRentals.startTime));
  }

  async getLaneRentalById(id: number): Promise<LaneRental | undefined> {
    const [row] = await db.select().from(laneRentals).where(eq(laneRentals.id, id)).limit(1);
    return row;
  }

  async findLaneRentalConflicts(opts: { facilityKey: string; bookingDate: string; laneCode: string; startTime: string; endTime: string; excludeId?: number }): Promise<LaneRental[]> {
    // Two intervals [a,b) and [c,d) overlap iff a < d AND c < b.
    // We compare HH:MM strings lexicographically — valid for fixed-format zero-padded times.
    const conditions = [
      eq(laneRentals.facilityKey, opts.facilityKey),
      eq(laneRentals.bookingDate, opts.bookingDate),
      eq(laneRentals.laneCode, opts.laneCode),
      eq(laneRentals.status, "active"),
      sql`${laneRentals.startTime} < ${opts.endTime}`,
      sql`${opts.startTime} < ${laneRentals.endTime}`,
    ];
    const rows = await db.select().from(laneRentals).where(and(...conditions));
    return opts.excludeId ? rows.filter((r) => r.id !== opts.excludeId) : rows;
  }

  async createLaneRental(input: InsertLaneRental): Promise<LaneRental> {
    // Atomic create: serialize concurrent writers on (facility, date, lane) via advisory lock
    // then re-check conflicts inside the same transaction before insert. This closes the
    // TOCTOU window between findLaneRentalConflicts() and INSERT.
    const lockKey = `${input.facilityKey}|${input.bookingDate}|${input.laneCode}`;
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      const conflicts = await tx.select().from(laneRentals).where(and(
        eq(laneRentals.facilityKey, input.facilityKey),
        eq(laneRentals.bookingDate, input.bookingDate),
        eq(laneRentals.laneCode, input.laneCode),
        eq(laneRentals.status, "active"),
        sql`${laneRentals.startTime} < ${input.endTime}`,
        sql`${input.startTime} < ${laneRentals.endTime}`,
      ));
      if (conflicts.length > 0) {
        const c = conflicts[0];
        const err: Error & { code?: string; conflicts?: LaneRental[] } = new Error(
          `時段衝突：水道 ${c.laneCode} 已被「${c.renterName}」於 ${c.startTime}-${c.endTime} 預訂`,
        );
        err.code = "LANE_RENTAL_CONFLICT";
        err.conflicts = conflicts;
        throw err;
      }
      const [row] = await tx.insert(laneRentals).values({ ...input, updatedAt: new Date() }).returning();
      return row;
    });
  }

  async updateLaneRental(id: number, data: Partial<InsertLaneRental>): Promise<LaneRental | undefined> {
    // Atomic update with the same advisory-lock pattern. The lock key uses the existing row's
    // (facility, date, lane) — the route layer is responsible for forbidding edits to those
    // immutable fields, so the lock key is stable for the lifetime of the rental.
    const existing = await this.getLaneRentalById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...data } as LaneRental;
    const lockKey = `${existing.facilityKey}|${existing.bookingDate}|${existing.laneCode}`;
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      if (merged.status !== "cancelled") {
        const conflicts = await tx.select().from(laneRentals).where(and(
          eq(laneRentals.facilityKey, existing.facilityKey),
          eq(laneRentals.bookingDate, existing.bookingDate),
          eq(laneRentals.laneCode, existing.laneCode),
          eq(laneRentals.status, "active"),
          sql`${laneRentals.startTime} < ${merged.endTime}`,
          sql`${merged.startTime} < ${laneRentals.endTime}`,
        ));
        const real = conflicts.filter((r) => r.id !== id);
        if (real.length > 0) {
          const c = real[0];
          const err: Error & { code?: string; conflicts?: LaneRental[] } = new Error(
            `時段衝突：水道 ${c.laneCode} 已被「${c.renterName}」於 ${c.startTime}-${c.endTime} 預訂`,
          );
          err.code = "LANE_RENTAL_CONFLICT";
          err.conflicts = real;
          throw err;
        }
      }
      const [row] = await tx.update(laneRentals).set({ ...data, updatedAt: new Date() })
        .where(eq(laneRentals.id, id)).returning();
      return row;
    });
  }

  async deleteLaneRental(id: number): Promise<boolean> {
    const result = await db.delete(laneRentals).where(eq(laneRentals.id, id)).returning({ id: laneRentals.id });
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
