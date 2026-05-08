import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

const metadataSourceSchema = z.enum(["manual", "agent", "webhook", "system", "migration", "external", "external-checkin-system"]);
const workbenchRoleSchema = z.enum(["employee", "lifeguard", "supervisor", "system"]);

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFacilitySchema = createInsertSchema(facilities).omit({
  id: true,
  createdAt: true,
});

export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type Facility = typeof facilities.$inferSelect;

export const sessionsIndex = pgTable("sessions_index", {
  id: serial("id").primaryKey(),
  sessionIdHash: text("session_id_hash").notNull().unique(),
  userId: text("user_id").notNull(),
  activeRole: text("active_role").notNull(),
  activeFacility: text("active_facility"),
  issuedAt: timestamp("issued_at").notNull(),
  lastActive: timestamp("last_active").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const userRoleSnapshots = pgTable("user_role_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  grantedRoles: text("granted_roles").array().notNull(),
  grantedFacilities: text("granted_facilities").array().notNull(),
  permissionsSnapshot: text("permissions_snapshot").array().notNull(),
  source: text("source").default("system").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const authAuditLogs = pgTable("auth_audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  resultStatus: text("result_status").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  correlationId: text("correlation_id"),
});

export const anomalyReports = pgTable("anomaly_reports", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  employeeCode: text("employee_code"),
  role: text("role"),
  lineUserId: text("line_user_id"),
  context: text("context").notNull(),
  clockStatus: text("clock_status"),
  clockType: text("clock_type"),
  clockTime: text("clock_time"),
  venueName: text("venue_name"),
  distance: text("distance"),
  failReason: text("fail_reason"),
  errorMsg: text("error_msg"),
  userNote: text("user_note"),
  imageUrls: text("image_urls").array(),
  reportText: text("report_text"),
  resolution: text("resolution").default("pending"),
  resolvedNote: text("resolved_note"),
  facilityKey: text("facility_key"),
  source: text("source").default("external-checkin-system").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnomalyReportSchema = createInsertSchema(anomalyReports).omit({
  id: true,
  createdAt: true,
  receivedAt: true,
  updatedAt: true,
  resolvedAt: true,
}).extend({
  source: metadataSourceSchema.optional(),
});

export type InsertAnomalyReport = z.infer<typeof insertAnomalyReportSchema>;
export type AnomalyReport = typeof anomalyReports.$inferSelect;

export const notificationRecipients = pgTable("notification_recipients", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  label: text("label"),
  facilityKey: text("facility_key"),
  enabled: boolean("enabled").default(true).notNull(),
  notifyNewReport: boolean("notify_new_report").default(true).notNull(),
  notifyResolution: boolean("notify_resolution").default(true).notNull(),
  createdBy: text("created_by"),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationRecipientSchema = createInsertSchema(notificationRecipients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
});

export type InsertNotificationRecipient = z.infer<typeof insertNotificationRecipientSchema>;
export type NotificationRecipient = typeof notificationRecipients.$inferSelect;

export const handoverEntries = pgTable("handover_entries", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  content: text("content").notNull(),
  authorEmployeeNumber: text("author_employee_number"),
  authorName: text("author_name"),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHandoverEntrySchema = createInsertSchema(handoverEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  content: z.string().min(1, "內容不可為空").max(2000, "內容過長"),
  facilityKey: z.string().min(1),
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
});

export type InsertHandoverEntry = z.infer<typeof insertHandoverEntrySchema>;
export type HandoverEntry = typeof handoverEntries.$inferSelect;

export const operationalHandovers = pgTable("operational_handovers", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").default("normal").notNull(),
  status: text("status").default("pending").notNull(),
  targetDate: text("target_date").notNull(),
  targetShiftLabel: text("target_shift_label").notNull(),
  visibleFrom: timestamp("visible_from"),
  dueAt: timestamp("due_at"),
  assigneeEmployeeNumber: text("assignee_employee_number"),
  assigneeName: text("assignee_name"),
  claimedByEmployeeNumber: text("claimed_by_employee_number"),
  claimedByName: text("claimed_by_name"),
  createdByEmployeeNumber: text("created_by_employee_number"),
  createdByName: text("created_by_name"),
  createdByRole: text("created_by_role"),
  reportedByEmployeeNumber: text("reported_by_employee_number"),
  reportedByName: text("reported_by_name"),
  reportNote: text("report_note"),
  updatedBy: text("updated_by"),
  source: text("source").default("manual").notNull(),
  progressStatus: text("progress_status"),
  progressPercent: integer("progress_percent"),
  linkedActionType: text("linked_action_type"),
  linkedActionUrl: text("linked_action_url"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOperationalHandoverSchema = createInsertSchema(operationalHandovers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  title: z.string().min(1, "標題不可為空").max(120, "標題過長"),
  content: z.string().min(1, "內容不可為空").max(2000, "內容過長"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  status: z.enum(["pending", "claimed", "in_progress", "reported", "done", "cancelled"]).default("pending"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD"),
  targetShiftLabel: z.string().min(1, "請指定班別"),
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
  progressStatus: z.enum(["pending", "in_progress", "blocked", "done"]).optional().nullable(),
  progressPercent: z.number().int().min(0).max(100).optional().nullable(),
});

export type InsertOperationalHandover = z.infer<typeof insertOperationalHandoverSchema>;
export type OperationalHandover = typeof operationalHandovers.$inferSelect;

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  priority: text("priority").default("normal").notNull(),
  status: text("status").default("pending").notNull(),
  source: text("source").default("employee").notNull(),
  inputSource: text("input_source").default("manual").notNull(),
  createdByUserId: text("created_by_user_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  assignedToUserId: text("assigned_to_user_id"),
  assignedToName: text("assigned_to_name"),
  assignedByUserId: text("assigned_by_user_id"),
  assignedAt: timestamp("assigned_at"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  title: z.string().min(1, "標題不可為空").max(140, "標題過長"),
  content: z.string().max(2000, "內容過長").optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).default("pending"),
  source: z.enum(["employee", "supervisor", "system"]).default("employee"),
  inputSource: metadataSourceSchema.optional(),
  createdByRole: workbenchRoleSchema.optional().nullable(),
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const quickLinks = pgTable("quick_links", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key"),
  title: text("title").notNull(),
  url: text("url").notNull(),
  icon: text("icon"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: text("created_by"),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuickLinkSchema = createInsertSchema(quickLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "標題不可為空"),
  url: z.string().url("網址格式不正確"),
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
});

export type InsertQuickLink = z.infer<typeof insertQuickLinkSchema>;
export type QuickLink = typeof quickLinks.$inferSelect;

const linkUrlSchema = z.string().refine((value) => {
  if (value.startsWith("/")) return true;
  return z.string().url().safeParse(value).success;
}, "網址格式不正確");

export const employeeResources = pgTable("employee_resources", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  title: text("title").notNull(),
  content: text("content"),
  url: text("url"),
  imageUrl: text("image_url"),
  eventCategory: text("event_category"),
  eventStartAt: timestamp("event_start_at"),
  eventEndAt: timestamp("event_end_at"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  sortOrder: integer("sort_order").default(100).notNull(),
  scheduledAt: timestamp("scheduled_at"),
  createdByEmployeeNumber: text("created_by_employee_number"),
  createdByName: text("created_by_name"),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  source: text("source").default("manual").notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmployeeResourceSchema = createInsertSchema(employeeResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  category: z.enum(["event", "document", "sticky_note", "announcement", "training"]),
  title: z.string().min(1, "標題不可為空").max(120, "標題過長"),
  subCategory: z.string().max(60, "分類過長").optional().nullable(),
  content: z.string().max(1000, "內容過長").optional().nullable(),
  url: linkUrlSchema.optional().nullable(),
  imageUrl: linkUrlSchema.optional().nullable(),
  eventCategory: z.string().max(60, "活動類型過長").optional().nullable(),
  eventStartAt: z.coerce.date().optional().nullable(),
  eventEndAt: z.coerce.date().optional().nullable(),
  sortOrder: z.number().int().optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
  isPrivate: z.boolean().optional(),
  viewCount: z.number().int().min(0).optional(),
});

export type InsertEmployeeResource = z.infer<typeof insertEmployeeResourceSchema>;
export type EmployeeResource = typeof employeeResources.$inferSelect;

export const knowledgeBaseQna = pgTable("knowledge_base_qna", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  category: text("category"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
  status: text("status").default("published").notNull(),
  reviewStatus: text("review_status").default("approved").notNull(),
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdByEmployeeNumber: text("created_by_employee_number"),
  createdByName: text("created_by_name"),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKnowledgeBaseQnaSchema = createInsertSchema(knowledgeBaseQna).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  question: z.string().min(1, "問題不可為空").max(240, "問題過長"),
  answer: z.string().max(4000, "答案過長").optional().nullable(),
  category: z.string().max(60, "分類過長").optional().nullable(),
  tags: z.array(z.string().max(32)).max(12).optional(),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  reviewStatus: z.enum(["pending", "approved", "rejected"]).default("approved"),
  reviewNote: z.string().max(1000, "審核備註過長").optional().nullable(),
  reviewedBy: z.string().max(80).optional().nullable(),
  reviewedAt: z.coerce.date().optional().nullable(),
  isPinned: z.boolean().optional(),
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
});

export type InsertKnowledgeBaseQna = z.infer<typeof insertKnowledgeBaseQnaSchema>;
export type KnowledgeBaseQna = typeof knowledgeBaseQna.$inferSelect;

export const systemAnnouncements = pgTable("system_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  announcementType: text("announcement_type").default("notice").notNull(),
  severity: text("severity").default("info").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  facilityKey: text("facility_key"),
  facilityKeys: jsonb("facility_keys").$type<string[]>(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  publishedBy: text("published_by"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: text("created_by"),
  createdByRole: text("created_by_role"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSystemAnnouncementSchema = createInsertSchema(systemAnnouncements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "標題不可為空"),
  content: z.string().min(1, "內容不可為空"),
  announcementType: z.enum(["notice", "required", "sop", "event", "discount", "course"]).default("notice"),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  isPinned: z.boolean().optional(),
  facilityKeys: z.array(z.string()).optional().nullable(),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  createdByRole: workbenchRoleSchema.optional().nullable(),
  source: metadataSourceSchema.optional(),
});

export type InsertSystemAnnouncement = z.infer<typeof insertSystemAnnouncementSchema>;
export type SystemAnnouncement = typeof systemAnnouncements.$inferSelect;

export const announcementAcknowledgements = pgTable("announcement_acknowledgements", {
  id: serial("id").primaryKey(),
  announcementId: text("announcement_id").notNull(),
  facilityKey: text("facility_key").notNull(),
  userId: text("user_id").notNull(),
  employeeName: text("employee_name").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnnouncementAcknowledgementSchema = createInsertSchema(announcementAcknowledgements).omit({
  id: true,
  acknowledgedAt: true,
  createdAt: true,
}).extend({
  announcementId: z.string().min(1),
  facilityKey: z.string().min(1),
  userId: z.string().min(1),
  employeeName: z.string().min(1),
});

export type InsertAnnouncementAcknowledgement = z.infer<typeof insertAnnouncementAcknowledgementSchema>;
export type AnnouncementAcknowledgement = typeof announcementAcknowledgements.$inferSelect;

export const portalEvents = pgTable("portal_events", {
  id: serial("id").primaryKey(),
  employeeNumber: text("employee_number"),
  employeeName: text("employee_name"),
  facilityKey: text("facility_key"),
  eventType: text("event_type").notNull(),
  target: text("target"),
  targetLabel: text("target_label"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortalEventSchema = createInsertSchema(portalEvents).omit({
  id: true,
  createdAt: true,
}).extend({
  eventType: z.enum(["pageview", "link_click", "announcement_open", "announcement_ack", "handover_create", "handover_report", "handover_claim", "layout_update", "widget_click", "search", "resource_create"]),
});

export type InsertPortalEvent = z.infer<typeof insertPortalEventSchema>;
export type PortalEvent = typeof portalEvents.$inferSelect;

export const widgetLayoutSettings = pgTable("widget_layout_settings", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  role: text("role").notNull(),
  layoutKey: text("layout_key").default("employee-home").notNull(),
  widgets: jsonb("widgets").$type<Array<{
    key: string;
    label: string;
    area: string;
    enabled: boolean;
    size: "wide" | "card";
    sortOrder: number;
  }>>().notNull(),
  updatedByEmployeeNumber: text("updated_by_employee_number"),
  updatedByName: text("updated_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWidgetLayoutSettingSchema = createInsertSchema(widgetLayoutSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  role: z.enum(["employee", "supervisor", "system"]),
  layoutKey: z.string().min(1),
  widgets: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    area: z.string().min(1),
    enabled: z.boolean(),
    size: z.enum(["wide", "card"]),
    sortOrder: z.number().int(),
  })),
});

export type InsertWidgetLayoutSetting = z.infer<typeof insertWidgetLayoutSettingSchema>;
export type WidgetLayoutSetting = typeof widgetLayoutSettings.$inferSelect;

export const moduleSettings = pgTable("module_settings", {
  moduleId: text("module_id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  stage: text("stage").notNull(),
  menuOrder: integer("menu_order").default(100).notNull(),
  cardOrder: integer("card_order"),
  configJson: jsonb("config_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const moduleRolePermissions = pgTable("module_role_permissions", {
  id: serial("id").primaryKey(),
  moduleId: text("module_id").notNull(),
  role: text("role").notNull(),
  canView: boolean("can_view").default(false).notNull(),
  canManage: boolean("can_manage").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const moduleFacilityOverrides = pgTable("module_facility_overrides", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  moduleId: text("module_id").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  sortOrder: integer("sort_order").default(100).notNull(),
  configJson: jsonb("config_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ModuleSetting = typeof moduleSettings.$inferSelect;
export type ModuleRolePermission = typeof moduleRolePermissions.$inferSelect;
export type ModuleFacilityOverride = typeof moduleFacilityOverrides.$inferSelect;

export const watchdogEvents = pgTable("watchdog_events", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  serviceName: text("service_name").notNull(),
  status: text("status").notNull(),
  severity: text("severity").default("info").notNull(),
  message: text("message"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  observedAt: timestamp("observed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWatchdogEventSchema = createInsertSchema(watchdogEvents).omit({
  id: true,
  createdAt: true,
}).extend({
  source: z.string().min(1),
  serviceName: z.string().min(1),
  status: z.enum(["ok", "degraded", "down", "unknown"]),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});

export type InsertWatchdogEvent = z.infer<typeof insertWatchdogEventSchema>;
export type WatchdogEvent = typeof watchdogEvents.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actorId: text("actor_id"),
  role: text("role"),
  facilityKey: text("facility_key"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  correlationId: text("correlation_id"),
  resultStatus: text("result_status").default("success").notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const uiEvents = pgTable("ui_events", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: text("user_id"),
  role: text("role"),
  facilityKey: text("facility_key"),
  page: text("page").notNull(),
  componentId: text("component_id"),
  actionType: text("action_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  traceId: text("trace_id"),
  correlationId: text("correlation_id"),
  sessionIdHash: text("session_id_hash"),
});

export const insertUiEventSchema = createInsertSchema(uiEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertUiEvent = z.infer<typeof insertUiEventSchema>;
export type UiEvent = typeof uiEvents.$inferSelect;

export const clientErrors = pgTable("client_errors", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  role: text("role"),
  facilityKey: text("facility_key"),
  routePath: text("route_path"),
  message: text("message").notNull(),
  stack: text("stack"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientErrorSchema = createInsertSchema(clientErrors).omit({
  id: true,
  createdAt: true,
});

export type InsertClientError = z.infer<typeof insertClientErrorSchema>;
export type ClientError = typeof clientErrors.$inferSelect;

export const integrationErrorLogs = pgTable("integration_error_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  source: text("source").notNull(),
  errorCode: text("error_code").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  correlationId: text("correlation_id"),
});

export const syncJobRuns = pgTable("sync_job_runs", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  errorCode: text("error_code"),
  message: text("message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export const bffLatencyLogs = pgTable("bff_latency_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  route: text("route").notNull(),
  role: text("role"),
  facilityKey: text("facility_key"),
  durationMs: integer("duration_ms").notNull(),
  statusCode: integer("status_code").notNull(),
  correlationId: text("correlation_id"),
});

export const employeeHomeProjection = pgTable("employee_home_projection", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  facilityKey: text("facility_key").notNull(),
  projection: jsonb("projection").$type<Record<string, unknown>>().notNull(),
  sourceStatus: text("source_status").default("ok").notNull(),
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supervisorDashboardProjection = pgTable("supervisor_dashboard_projection", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  projection: jsonb("projection").$type<Record<string, unknown>>().notNull(),
  sourceStatus: text("source_status").default("ok").notNull(),
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const systemOverviewProjection = pgTable("system_overview_projection", {
  id: serial("id").primaryKey(),
  projection: jsonb("projection").$type<Record<string, unknown>>().notNull(),
  sourceStatus: text("source_status").default("ok").notNull(),
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================================================================
// Work Logs (工作日誌) — 救生員紙本日誌數位化
// =====================================================================

const shiftTypeSchema = z.enum(["morning", "noon", "night", "all"]);
const workLogInputTypeSchema = z.enum([
  "checkbox",
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
  "time",
  "date",
  "rating",
  "photo",
  "number_photo",
  "checkbox_photo",
  "yes_no",
  "on_off",
  "yes_no_remark",
  "water_quality_form",
]);

export const dailyTaskCategorySchema = z.enum(["routine", "opening", "closing", "locker_inspection"]);
export type DailyTaskCategory = z.infer<typeof dailyTaskCategorySchema>;

export const workLogModuleTypeSchema = z.enum(["lifeguard", "counter"]);
export type WorkLogModuleType = z.infer<typeof workLogModuleTypeSchema>;

export const dailyTaskTemplates = pgTable("daily_task_templates", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  moduleType: text("module_type").default("lifeguard").notNull(),
  category: text("category").default("routine").notNull(),
  shiftType: text("shift_type").notNull(),
  taskName: text("task_name").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(),
  inputConfig: jsonb("input_config").$type<Record<string, unknown>>(),
  isRequired: boolean("is_required").default(true).notNull(),
  requirePhoto: boolean("require_photo").default(false).notNull(),
  intervalMinutes: integer("interval_minutes"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailyTaskTemplateSchema = createInsertSchema(dailyTaskTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  moduleType: workLogModuleTypeSchema.optional(),
  category: dailyTaskCategorySchema.optional(),
  shiftType: shiftTypeSchema,
  taskName: z.string().min(1),
  inputType: workLogInputTypeSchema,
  requirePhoto: z.boolean().optional(),
  intervalMinutes: z.number().int().min(5).max(720).optional().nullable(),
});

export type InsertDailyTaskTemplate = z.infer<typeof insertDailyTaskTemplateSchema>;
export type DailyTaskTemplate = typeof dailyTaskTemplates.$inferSelect;

export const lifeguardAssignedTasks = pgTable("lifeguard_assigned_tasks", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  moduleType: text("module_type").default("lifeguard").notNull(),
  taskName: text("task_name").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(),
  inputConfig: jsonb("input_config").$type<Record<string, unknown>>(),
  assignedToEmployeeNumber: text("assigned_to_employee_number"),
  assignedToShift: text("assigned_to_shift"),
  taskDate: text("task_date"),
  dueDate: text("due_date"),
  isRequired: boolean("is_required").default(true).notNull(),
  status: text("status").default("active").notNull(),
  assignedBy: text("assigned_by"),
  assignedByName: text("assigned_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLifeguardAssignedTaskSchema = createInsertSchema(lifeguardAssignedTasks).omit({
  id: true,
  createdAt: true,
}).extend({
  facilityKey: z.string().min(1),
  moduleType: workLogModuleTypeSchema.optional(),
  taskName: z.string().min(1),
  inputType: workLogInputTypeSchema,
  assignedToShift: shiftTypeSchema.optional().nullable(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
});

export type InsertLifeguardAssignedTask = z.infer<typeof insertLifeguardAssignedTaskSchema>;
export type LifeguardAssignedTask = typeof lifeguardAssignedTasks.$inferSelect;

export const recurringTaskTemplates = pgTable("recurring_task_templates", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  moduleType: text("module_type").default("lifeguard").notNull(),
  taskName: text("task_name").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(),
  inputConfig: jsonb("input_config").$type<Record<string, unknown>>(),
  recurrenceType: text("recurrence_type").notNull(),
  recurrenceDays: integer("recurrence_days").array(),
  shiftType: text("shift_type").default("all").notNull(),
  isRequired: boolean("is_required").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRecurringTaskTemplateSchema = createInsertSchema(recurringTaskTemplates).omit({
  id: true,
  createdAt: true,
}).extend({
  facilityKey: z.string().min(1),
  moduleType: workLogModuleTypeSchema.optional(),
  taskName: z.string().min(1),
  inputType: workLogInputTypeSchema,
  recurrenceType: z.enum(["daily", "weekly", "monthly"]),
  shiftType: shiftTypeSchema.optional(),
});

export type InsertRecurringTaskTemplate = z.infer<typeof insertRecurringTaskTemplateSchema>;
export type RecurringTaskTemplate = typeof recurringTaskTemplates.$inferSelect;

export const waterQualitySchedules = pgTable("water_quality_schedules", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  poolName: text("pool_name").notNull(),
  shiftType: text("shift_type").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  intervalMinutes: integer("interval_minutes"),
  customTimes: text("custom_times").array(),
  priority: integer("priority").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWaterQualityScheduleSchema = createInsertSchema(waterQualitySchedules).omit({
  id: true,
  createdAt: true,
}).extend({
  facilityKey: z.string().min(1),
  poolName: z.string().min(1),
  shiftType: shiftTypeSchema,
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "格式為 HH:MM"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式為 YYYY-MM-DD").optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式為 YYYY-MM-DD").optional().nullable(),
  intervalMinutes: z.number().int().min(5).max(720).optional().nullable(),
  customTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
});

export type InsertWaterQualitySchedule = z.infer<typeof insertWaterQualityScheduleSchema>;
export type WaterQualitySchedule = typeof waterQualitySchedules.$inferSelect;

export const waterQualityStandards = pgTable("water_quality_standards", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  poolName: text("pool_name").notNull(),
  parameterName: text("parameter_name").notNull(),
  unit: text("unit"),
  minValue: text("min_value"),
  maxValue: text("max_value"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWaterQualityStandardSchema = createInsertSchema(waterQualityStandards).omit({
  id: true,
  createdAt: true,
}).extend({
  facilityKey: z.string().min(1),
  poolName: z.string().min(1),
  parameterName: z.string().min(1),
});

export type InsertWaterQualityStandard = z.infer<typeof insertWaterQualityStandardSchema>;
export type WaterQualityStandard = typeof waterQualityStandards.$inferSelect;

export const workLogTaskCompletions = pgTable("work_log_task_completions", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  workDate: text("work_date").notNull(),
  shiftType: text("shift_type").notNull(),
  taskSource: text("task_source").notNull(),
  taskRefId: integer("task_ref_id").notNull(),
  taskName: text("task_name").notNull(),
  inputValue: jsonb("input_value").$type<Record<string, unknown>>(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedBy: text("completed_by"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uxNaturalKey: uniqueIndex("ux_work_log_task_completion_natural").on(
    table.facilityKey, table.workDate, table.shiftType, table.taskSource, table.taskRefId,
  ),
  idxFacilityDate: index("idx_work_log_task_completions_lookup").on(
    table.facilityKey, table.workDate, table.shiftType,
  ),
}));

export const insertWorkLogTaskCompletionSchema = createInsertSchema(workLogTaskCompletions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: shiftTypeSchema,
  taskSource: z.enum(["daily", "assigned", "recurring"]),
});

export type InsertWorkLogTaskCompletion = z.infer<typeof insertWorkLogTaskCompletionSchema>;
export type WorkLogTaskCompletion = typeof workLogTaskCompletions.$inferSelect;

export const waterQualityRecords = pgTable("water_quality_records", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  workDate: text("work_date").notNull(),
  shiftType: text("shift_type").notNull(),
  scheduleId: integer("schedule_id"),
  poolName: text("pool_name").notNull(),
  scheduledTime: text("scheduled_time"),
  measurements: jsonb("measurements").$type<Record<string, string | number>>().notNull(),
  isAbnormal: boolean("is_abnormal").default(false).notNull(),
  abnormalNote: text("abnormal_note"),
  photoUrls: text("photo_urls").array(),
  recordedBy: text("recorded_by"),
  recordedByName: text("recorded_by_name"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertWaterQualityRecordSchema = createInsertSchema(waterQualityRecords).omit({
  id: true,
  recordedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: shiftTypeSchema,
  poolName: z.string().min(1),
  measurements: z.record(z.union([z.string(), z.number()])),
});

export type InsertWaterQualityRecord = z.infer<typeof insertWaterQualityRecordSchema>;
export type WaterQualityRecord = typeof waterQualityRecords.$inferSelect;

export const lifeguardHandoverNotes = pgTable("lifeguard_handover_notes", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  workDate: text("work_date").notNull(),
  fromShift: text("from_shift").notNull(),
  toShift: text("to_shift").notNull(),
  category: text("category").default("general").notNull(),
  content: text("content").notNull(),
  isImportant: boolean("is_important").default(false).notNull(),
  needsAttention: boolean("needs_attention").default(false).notNull(),
  photoUrls: text("photo_urls").array(),
  authorEmployeeNumber: text("author_employee_number"),
  authorName: text("author_name"),
  isConfirmed: boolean("is_confirmed").default(false).notNull(),
  confirmedBy: text("confirmed_by"),
  confirmedByName: text("confirmed_by_name"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  idxLookup: index("idx_lifeguard_handover_lookup").on(
    table.facilityKey, table.workDate, table.toShift, table.fromShift,
  ),
}));

export const insertLifeguardHandoverNoteSchema = createInsertSchema(lifeguardHandoverNotes).omit({
  id: true,
  createdAt: true,
  isConfirmed: true,
  confirmedBy: true,
  confirmedByName: true,
  confirmedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromShift: shiftTypeSchema,
  toShift: shiftTypeSchema,
  content: z.string().min(1),
  category: z.enum(["facility", "customer", "safety", "general"]).optional(),
  isImportant: z.boolean().optional(),
  needsAttention: z.boolean().optional(),
  photoUrls: z.array(z.string().min(1)).max(8).optional(),
});

export type InsertLifeguardHandoverNote = z.infer<typeof insertLifeguardHandoverNoteSchema>;
export type LifeguardHandoverNote = typeof lifeguardHandoverNotes.$inferSelect;

export const dailyReportSubmissions = pgTable("daily_report_submissions", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  moduleType: text("module_type").default("lifeguard").notNull(),
  workDate: text("work_date").notNull(),
  shiftType: text("shift_type").notNull(),
  submittedBy: text("submitted_by").notNull(),
  submittedByName: text("submitted_by_name"),
  status: text("status").default("submitted").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  totalRequired: integer("total_required").default(0).notNull(),
  totalCompleted: integer("total_completed").default(0).notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertDailyReportSubmissionSchema = createInsertSchema(dailyReportSubmissions).omit({
  id: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewedByName: true,
  reviewNote: true,
}).extend({
  facilityKey: z.string().min(1),
  moduleType: workLogModuleTypeSchema.optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: shiftTypeSchema,
  status: z.enum(["submitted", "approved", "returned"]).optional(),
});

export type InsertDailyReportSubmission = z.infer<typeof insertDailyReportSubmissionSchema>;
export type DailyReportSubmission = typeof dailyReportSubmissions.$inferSelect;

export const workLogReviewActions = pgTable("work_log_review_actions", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  action: text("action").notNull(),
  reviewerEmployeeNumber: text("reviewer_employee_number").notNull(),
  reviewerName: text("reviewer_name"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  idxBySubmission: index("idx_work_log_review_actions_submission").on(table.submissionId, table.createdAt),
}));

export const insertWorkLogReviewActionSchema = createInsertSchema(workLogReviewActions).omit({
  id: true,
  createdAt: true,
}).extend({
  action: z.enum(["approve", "return"]),
});

export type InsertWorkLogReviewAction = z.infer<typeof insertWorkLogReviewActionSchema>;
export type WorkLogReviewAction = typeof workLogReviewActions.$inferSelect;

// 水道租借 (Lane rentals — currently used by 松山國小 only)
export const laneRentals = pgTable("lane_rentals", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  bookingDate: text("booking_date").notNull(),
  laneCode: text("lane_code").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  renterName: text("renter_name").notNull(),
  renterContact: text("renter_contact"),
  note: text("note"),
  status: text("status").default("active").notNull(),
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idxLookup: index("idx_lane_rentals_lookup").on(table.facilityKey, table.bookingDate, table.laneCode),
}));

export const insertLaneRentalSchema = createInsertSchema(laneRentals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  laneCode: z.enum(["A", "B", "C", "D", "E"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  renterName: z.string().min(1).max(100),
  renterContact: z.string().max(100).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  status: z.enum(["active", "cancelled"]).optional(),
});

export type InsertLaneRental = z.infer<typeof insertLaneRentalSchema>;
export type LaneRental = typeof laneRentals.$inferSelect;

// ======================================================================
// 停車場會員與租約管理 (Parking Member & Lease Management)
// ----------------------------------------------------------------------
// 5 tables: plans (方案), vehicles (車輛), contracts (租約),
//           payments (付款回報), event_days (活動日)
// ======================================================================

// 方案 — admin-defined parking plans (monthly/quarterly/yearly/member/etc.)
export const parkingPlans = pgTable("parking_plans", {
  id: serial("id").primaryKey(),
  planKey: text("plan_key").notNull().unique(),  // slug, e.g. "monthly_basic"
  name: text("name").notNull(),
  planType: text("plan_type").notNull(),         // monthly|quarterly|yearly|member|swim_team|employee|special|blacklist
  durationMonths: integer("duration_months"),    // null for member/blacklist
  price: integer("price").notNull().default(0),  // NTD
  deposit: integer("deposit").notNull().default(0),
  guarantee: integer("guarantee").notNull().default(0),
  requiresContract: boolean("requires_contract").notNull().default(true),
  requiresPayment: boolean("requires_payment").notNull().default(true),
  requiresReview: boolean("requires_review").notNull().default(true),
  allowsOnlineRenewal: boolean("allows_online_renewal").notNull().default(true),
  notifyDaysBefore: integer("notify_days_before").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertParkingPlanSchema = createInsertSchema(parkingPlans).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  planKey: z.string().regex(/^[a-z0-9_]+$/, "planKey 僅允許小寫英數與底線").min(1).max(64),
  name: z.string().min(1).max(100),
  planType: z.enum(["monthly", "quarterly", "yearly", "member", "swim_team", "employee", "special", "blacklist"]),
  durationMonths: z.number().int().positive().max(120).optional().nullable(),
  price: z.number().int().min(0).max(10_000_000),
  deposit: z.number().int().min(0).max(10_000_000),
  guarantee: z.number().int().min(0).max(10_000_000),
  notifyDaysBefore: z.number().int().min(0).max(365),
  description: z.string().max(2000).optional().nullable(),
});
export type InsertParkingPlan = z.infer<typeof insertParkingPlanSchema>;
export type ParkingPlan = typeof parkingPlans.$inferSelect;

// 車輛 — license-plate as natural key (uppercased, dash-stripped)
export const parkingVehicles = pgTable("parking_vehicles", {
  id: serial("id").primaryKey(),
  licensePlate: text("license_plate").notNull().unique(),  // normalized e.g. "ABC1234"
  ownerName: text("owner_name").notNull(),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  lineUserId: text("line_user_id"),  // reserved for future LINE Messaging API
  vehicleType: text("vehicle_type").notNull(),  // monthly|quarterly|yearly|member|swim_team|employee|special|blacklist
  status: text("status").notNull().default("active"),  // active|expired|suspended|blacklisted
  expiresAt: text("expires_at"),  // YYYY-MM-DD; null = no expiry (member/employee may have one anyway)
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idxPhone: index("idx_parking_vehicles_phone").on(table.ownerPhone),
  idxStatus: index("idx_parking_vehicles_status").on(table.status, table.expiresAt),
  idxType: index("idx_parking_vehicles_type").on(table.vehicleType),
}));

export const insertParkingVehicleSchema = createInsertSchema(parkingVehicles).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  licensePlate: z.string().regex(/^[A-Z0-9]{2,10}$/, "車牌格式錯誤（請使用大寫英數，2–10 碼，去除連字號）"),
  ownerName: z.string().min(1).max(100),
  ownerPhone: z.string().max(30).optional().nullable(),
  ownerEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  lineUserId: z.string().max(100).optional().nullable(),
  vehicleType: z.enum(["monthly", "quarterly", "yearly", "member", "swim_team", "employee", "special", "blacklist"]),
  status: z.enum(["active", "expired", "suspended", "blacklisted"]).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});
export type InsertParkingVehicle = z.infer<typeof insertParkingVehicleSchema>;
export type ParkingVehicle = typeof parkingVehicles.$inferSelect;

// 租約 — links a vehicle to a plan; lifecycle: draft → awaiting_sign → awaiting_payment
//         → payment_review → active → expiring_soon → expired (or terminated/refunded)
export const parkingContracts = pgTable("parking_contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").notNull().unique(),  // PK-YYYYMM-####
  vehicleId: integer("vehicle_id").notNull(),
  planId: integer("plan_id").notNull(),
  status: text("status").notNull().default("draft"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  totalAmount: integer("total_amount").notNull().default(0),
  depositAmount: integer("deposit_amount").notNull().default(0),
  signatureImageUrl: text("signature_image_url"),
  pdfUrl: text("pdf_url"),
  signedAt: timestamp("signed_at"),
  terminatedAt: timestamp("terminated_at"),
  refundedAt: timestamp("refunded_at"),
  refundAmount: integer("refund_amount"),
  note: text("note"),
  // ----- Phase 2: customer-facing e-sign flow -----
  termsVersion: text("terms_version"),                 // e.g. "2026-NBHS-v1"
  signTokenHash: text("sign_token_hash"),              // sha256 of one-time link token
  signTokenExpiresAt: timestamp("sign_token_expires_at"),
  signedFromIp: text("signed_from_ip"),
  signedUserAgent: text("signed_user_agent"),
  signerName: text("signer_name"),                     // name typed at signing
  signerIdLast4: text("signer_id_last4"),              // last 4 of national ID, optional
  vehicleRegPhotoUrl: text("vehicle_reg_photo_url"),   // 行照
  driverLicensePhotoUrl: text("driver_license_photo_url"), // 駕照
  idCardPhotoUrl: text("id_card_photo_url"),           // 身分證 (optional)
  // ----- end Phase 2 -----
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idxVehicle: index("idx_parking_contracts_vehicle").on(table.vehicleId),
  idxStatus: index("idx_parking_contracts_status").on(table.status, table.endDate),
  idxSignToken: index("idx_parking_contracts_sign_token").on(table.signTokenHash),
}));

export const insertParkingContractSchema = createInsertSchema(parkingContracts).omit({
  id: true, contractNumber: true, createdAt: true, updatedAt: true,
  signedAt: true, terminatedAt: true, refundedAt: true,
  // Phase 2 e-sign fields are managed exclusively by the sign endpoints,
  // never by client-supplied insert payloads.
  signTokenHash: true, signTokenExpiresAt: true, signedFromIp: true,
  signedUserAgent: true, signerName: true, signerIdLast4: true,
  vehicleRegPhotoUrl: true, driverLicensePhotoUrl: true, idCardPhotoUrl: true,
  signatureImageUrl: true,
}).extend({
  vehicleId: z.number().int().positive(),
  planId: z.number().int().positive(),
  status: z.enum(["draft", "awaiting_sign", "awaiting_payment", "payment_review", "active", "expiring_soon", "expired", "terminated", "refunded"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  totalAmount: z.number().int().min(0).max(100_000_000),
  depositAmount: z.number().int().min(0).max(100_000_000),
  pdfUrl: z.string().max(2000).optional().nullable(),
  refundAmount: z.number().int().min(0).max(100_000_000).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  termsVersion: z.string().max(50).optional().nullable(),
});
export type InsertParkingContract = z.infer<typeof insertParkingContractSchema>;
export type ParkingContract = typeof parkingContracts.$inferSelect;

// 付款回報 — user-reported transfers awaiting back-office approval
export const parkingPayments = pgTable("parking_payments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  amount: integer("amount").notNull(),
  transferLast5: text("transfer_last5").notNull(),  // last 5 digits of transferring account
  receiptImageUrl: text("receipt_image_url"),
  reportedNote: text("reported_note"),
  status: text("status").notNull().default("pending"),  // pending|approved|rejected
  reviewedBy: text("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  idxContract: index("idx_parking_payments_contract").on(table.contractId),
  idxStatus: index("idx_parking_payments_status").on(table.status, table.reportedAt),
}));

export const insertParkingPaymentSchema = createInsertSchema(parkingPayments).omit({
  id: true, createdAt: true, reportedAt: true, reviewedAt: true,
  reviewedBy: true, reviewedByName: true, reviewNote: true, status: true,
}).extend({
  contractId: z.number().int().positive(),
  amount: z.number().int().min(1).max(100_000_000),
  transferLast5: z.string().regex(/^\d{5}$/, "需 5 碼數字"),
  receiptImageUrl: z.string().max(2000).optional().nullable(),
  reportedNote: z.string().max(2000).optional().nullable(),
});
export type InsertParkingPayment = z.infer<typeof insertParkingPaymentSchema>;
export type ParkingPayment = typeof parkingPayments.$inferSelect;

// 活動日 — operations days that may restrict certain vehicle types from parking
export const parkingEventDays = pgTable("parking_event_days", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  eventDate: text("event_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  restrictMonthly: boolean("restrict_monthly").notNull().default(false),
  restrictMember: boolean("restrict_member").notNull().default(false),
  restrictSwimTeam: boolean("restrict_swim_team").notNull().default(false),
  restrictEmployee: boolean("restrict_employee").notNull().default(false),
  announcement: text("announcement"),
  notifyInAdvance: boolean("notify_in_advance").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  idxDate: index("idx_parking_event_days_date").on(table.eventDate),
}));

export const insertParkingEventDaySchema = createInsertSchema(parkingEventDays).omit({
  id: true, createdAt: true,
}).extend({
  name: z.string().min(1).max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  announcement: z.string().max(2000).optional().nullable(),
});
export type InsertParkingEventDay = z.infer<typeof insertParkingEventDaySchema>;
export type ParkingEventDay = typeof parkingEventDays.$inferSelect;

// External source payloads, such as Ragic, schedule, booking, LINE, Gmail, or
// Replit-hosted migration feeds, are stored here before projection. These rows
// are not the system of record for internal workbench business state.
export const sourceSnapshots = pgTable("source_snapshots", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  externalId: text("external_id"),
  facilityKey: text("facility_key"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

// ──────────────────────────────────────────────────────────────────────────
// 場地預約系統（新北高中 / 三重商工）— Courts module
// Tables intentionally prefixed `court_` to avoid colliding with other
// reservation-shaped tables we may add later.
// ──────────────────────────────────────────────────────────────────────────
export const COURT_SCHOOL_IDS = ["xinbei", "sanchong"] as const;
export type CourtSchoolId = (typeof COURT_SCHOOL_IDS)[number];
export const courtSchoolEnum = z.enum(COURT_SCHOOL_IDS);

export const courtReservations = pgTable(
  "court_reservations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    school: text("school").notNull().default("xinbei"),
    date: text("date").notNull(),
    court: integer("court").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("confirmed"),
    createdAt: timestamp("created_at").defaultNow(),
    bookingNumber: text("booking_number"),
    serviceName: text("service_name"),
    rawTitle: text("raw_title"),
    rawDescription: text("raw_description"),
    source: text("source").notNull().default("manual"),
  },
  (table) => ({
    dateIdx: index("court_reservations_date_idx").on(table.date),
    schoolDateIdx: index("court_reservations_school_date_idx").on(
      table.school,
      table.date,
    ),
    schoolDateCourtIdx: index("court_reservations_school_date_court_idx").on(
      table.school,
      table.date,
      table.court,
    ),
  }),
);

export const insertCourtReservationSchema = createInsertSchema(courtReservations)
  .pick({
    school: true,
    date: true,
    court: true,
    startTime: true,
    endTime: true,
    customerName: true,
    phone: true,
    notes: true,
    status: true,
    serviceName: true,
    source: true,
  })
  .extend({
    school: courtSchoolEnum,
    court: z.number().int().min(1),
    status: z.enum(["confirmed", "pending", "member"]),
    source: z.enum(["manual", "google", "batch"]).optional(),
  });

export type InsertCourtReservation = z.infer<typeof insertCourtReservationSchema>;
export type CourtReservation = typeof courtReservations.$inferSelect;

export const courtBatchImportSchema = z.object({
  school: courtSchoolEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式須為 YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式須為 YYYY-MM-DD"),
  weekdays: z.array(z.number().min(0).max(6)).min(1, "至少選擇一個星期"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式須為 HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式須為 HH:MM"),
  court: z.number().int().min(1),
  customerName: z.string().min(1, "請輸入使用者名稱"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  serviceName: z.string().optional(),
  status: z.enum(["confirmed", "pending", "member"]).default("member"),
});

export type CourtBatchImportPayload = z.infer<typeof courtBatchImportSchema>;

export const courtSyncLogs = pgTable(
  "court_sync_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    school: text("school").notNull().default("xinbei"),
    source: text("source").notNull().default("google_calendar"),
    scope: text("scope").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    eventCount: integer("event_count").notNull().default(0),
    reservationCount: integer("reservation_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("court_sync_logs_created_at_idx").on(table.createdAt),
    schoolCreatedAtIdx: index("court_sync_logs_school_created_at_idx").on(
      table.school,
      table.createdAt,
    ),
  }),
);

export type CourtSyncLog = typeof courtSyncLogs.$inferSelect;
export type InsertCourtSyncLog = typeof courtSyncLogs.$inferInsert;

export const courtSyncErrors = pgTable(
  "court_sync_errors",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    school: text("school").notNull().default("xinbei"),
    source: text("source").notNull().default("google_calendar"),
    eventId: text("event_id"),
    summary: text("summary"),
    location: text("location"),
    description: text("description"),
    reason: text("reason").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("court_sync_errors_created_at_idx").on(table.createdAt),
    reasonIdx: index("court_sync_errors_reason_idx").on(table.reason),
    schoolCreatedAtIdx: index("court_sync_errors_school_created_at_idx").on(
      table.school,
      table.createdAt,
    ),
  }),
);

export type CourtSyncError = typeof courtSyncErrors.$inferSelect;
export type InsertCourtSyncError = typeof courtSyncErrors.$inferInsert;
