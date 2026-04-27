import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnomalyReportSchema = createInsertSchema(anomalyReports).omit({
  id: true,
  createdAt: true,
});

export type InsertAnomalyReport = z.infer<typeof insertAnomalyReportSchema>;
export type AnomalyReport = typeof anomalyReports.$inferSelect;

export const notificationRecipients = pgTable("notification_recipients", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  label: text("label"),
  enabled: boolean("enabled").default(true).notNull(),
  notifyNewReport: boolean("notify_new_report").default(true).notNull(),
  notifyResolution: boolean("notify_resolution").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationRecipientSchema = createInsertSchema(notificationRecipients).omit({
  id: true,
  createdAt: true,
});

export type InsertNotificationRecipient = z.infer<typeof insertNotificationRecipientSchema>;
export type NotificationRecipient = typeof notificationRecipients.$inferSelect;

export const handoverEntries = pgTable("handover_entries", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  content: text("content").notNull(),
  authorEmployeeNumber: text("author_employee_number"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHandoverEntrySchema = createInsertSchema(handoverEntries).omit({
  id: true,
  createdAt: true,
}).extend({
  content: z.string().min(1, "內容不可為空").max(2000, "內容過長"),
  facilityKey: z.string().min(1),
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
  reportedByEmployeeNumber: text("reported_by_employee_number"),
  reportedByName: text("reported_by_name"),
  reportNote: text("report_note"),
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
  createdByUserId: text("created_by_user_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  assignedToUserId: text("assigned_to_user_id"),
  assignedToName: text("assigned_to_name"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuickLinkSchema = createInsertSchema(quickLinks).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1, "標題不可為空"),
  url: z.string().url("網址格式不正確"),
});

export type InsertQuickLink = z.infer<typeof insertQuickLinkSchema>;
export type QuickLink = typeof quickLinks.$inferSelect;

export const employeeResources = pgTable("employee_resources", {
  id: serial("id").primaryKey(),
  facilityKey: text("facility_key").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  url: text("url"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdByEmployeeNumber: text("created_by_employee_number"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmployeeResourceSchema = createInsertSchema(employeeResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  facilityKey: z.string().min(1),
  category: z.enum(["event", "document", "sticky_note", "announcement"]),
  title: z.string().min(1, "標題不可為空").max(120, "標題過長"),
  content: z.string().max(1000, "內容過長").optional().nullable(),
  url: z.string().url("網址格式不正確").optional().nullable(),
});

export type InsertEmployeeResource = z.infer<typeof insertEmployeeResourceSchema>;
export type EmployeeResource = typeof employeeResources.$inferSelect;

export const systemAnnouncements = pgTable("system_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  severity: text("severity").default("info").notNull(),
  facilityKey: text("facility_key"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSystemAnnouncementSchema = createInsertSchema(systemAnnouncements).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1, "標題不可為空"),
  content: z.string().min(1, "內容不可為空"),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
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
