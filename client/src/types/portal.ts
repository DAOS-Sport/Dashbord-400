export interface FacilityContactPoint {
  type: "general" | "course" | "maintenance" | "supervisor" | "rental";
  label: string;
  name: string;
  phone?: string;
  note?: string;
}

export interface FacilitySectionToggle {
  mustRead: boolean;
  groupAnnouncements: boolean;
  campaigns: boolean;
  handover: boolean;
  onDutyStaff: boolean;
  contacts: boolean;
  rental: boolean;
}

export interface FacilityConfig {
  facilityKey: string;
  facilityLineGroupId: string;
  facilityName: string;
  shortName: string;
  area?: string;
  portalPath: string;
  isActive: boolean;
  sections: FacilitySectionToggle;
  contactPoints: FacilityContactPoint[];
}

export interface RagicFacility {
  facilityKey: string;
  facilityName: string;
  shortName: string;
  area?: string;
  ragicId?: string;
}

export interface PortalAnnouncement {
  id: number;
  title: string;
  summary?: string;
  candidateType: string;
  priority: "critical" | "high" | "normal" | "low";
  scopeType?: string;
  facilityName: string;
  groupId?: string;
  displayName?: string;
  effectiveStartAt: string;
  effectiveEndAt?: string;
  needsAck: boolean;
  originalText?: string;
  recommendedAction?: string;
  recommendedReply?: string;
  badExample?: string;
  reasoningTags?: string[];
  confidence: number;
  status: string;
}

export interface PortalUser {
  employeeNumber: string;
  name: string;
  role?: string;
}

export interface FacilityHandoverItem {
  id: number | string;
  title: string;
  type?: "doc" | "task" | "note" | string;
  fileName?: string;
  sharedWith?: string;
  updatedAt?: string;
  url?: string;
  description?: string;
}

export interface FacilityMustReadItem {
  id: number | string;
  title: string;
  status?: "OPERATIONAL" | "DEGRADED" | "ALERT" | string;
  candidateType?: string;
  summary?: string;
  recommendedAction?: string;
  recommendedReply?: string;
  badExample?: string;
  originalText?: string;
  scopeType?: string;
  needsAck?: boolean;
  reasoningTags?: string[];
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  detectedAt?: string;
  groupName?: string;
  groupId?: string;
  displayName?: string;
}

export interface FacilityCampaign {
  id: number | string;
  title: string;
  summary?: string;
  imageUrl?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  candidateType?: string;
  detectedAt?: string;
}

export interface FacilityShiftEntry {
  id: number | string;
  name: string;
  role?: string;
  startAt?: string;
  endAt?: string;
  status?: "on_duty" | "checked_in" | "absent" | string;
}

export interface FacilityHomeResponse {
  facility?: { groupId: string; name: string };
  handover?: FacilityHandoverItem[];
  mustRead?: FacilityMustReadItem[];
  announcements?: FacilityMustReadItem[];
  campaigns?: FacilityCampaign[];
  shift?: FacilityShiftEntry[];
  lastRefreshedAt?: string;
}

export interface HandoverEntryDTO {
  id: number;
  facilityKey: string;
  content: string;
  authorEmployeeNumber: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface QuickLinkDTO {
  id: number;
  facilityKey: string | null;
  title: string;
  url: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface SystemAnnouncementDTO {
  id: number;
  title: string;
  content: string;
  announcementType: "notice" | "required" | "sop" | "event" | "discount" | "course";
  severity: "info" | "warning" | "critical";
  isPinned: boolean;
  facilityKey: string | null;
  publishedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PortalEventInsert {
  eventType: "pageview" | "link_click" | "announcement_open" | "handover_create";
  target?: string;
  targetLabel?: string;
  metadata?: string;
}

// ===== Work Logs (工作日誌) =====
export type WorkLogShift = "morning" | "noon" | "night";
export type WorkLogTaskSource = "daily" | "assigned" | "recurring";
export type WorkLogInputType =
  | "checkbox" | "text" | "textarea" | "number" | "select" | "multiselect"
  | "time" | "date" | "rating" | "photo" | "number_photo" | "checkbox_photo"
  | "yes_no" | "on_off" | "yes_no_remark" | "water_quality_form";

export interface WorkLogTaskItem {
  source: WorkLogTaskSource;
  refId: number;
  taskName: string;
  description: string | null;
  inputType: WorkLogInputType;
  inputConfig: Record<string, unknown> | null;
  isRequired: boolean;
  isCompleted: boolean;
  inputValue: Record<string, unknown> | null;
  notes: string | null;
  completedBy: string | null;
  completedAt: string | null;
}

export interface WaterQualitySlot {
  scheduleId: number;
  poolName: string;
  scheduledTime: string;
  isCompleted: boolean;
  recordId: number | null;
  isAbnormal: boolean;
  abnormalNote: string | null;
  recordedBy: string | null;
  recordedAt: string | null;
}

export interface WaterQualityRecordDTO {
  id: number;
  facilityKey: string;
  workDate: string;
  shiftType: string;
  scheduleId: number | null;
  poolName: string;
  scheduledTime: string | null;
  measurements: Record<string, string | number>;
  isAbnormal: boolean;
  abnormalNote: string | null;
  photoUrls: string[] | null;
  recordedByName: string | null;
  recordedAt: string;
}

export interface LifeguardHandoverItem {
  id: number;
  category: string;
  content: string;
  fromShift: string;
  authorName: string | null;
  createdAt: string;
  isConfirmed: boolean;
  confirmedByName: string | null;
  confirmedAt: string | null;
  canConfirm: boolean;
}

export interface DailyReportSubmissionDTO {
  id: number;
  facilityKey: string;
  workDate: string;
  shiftType: string;
  submittedBy: string;
  submittedByName: string | null;
  status: "submitted" | "approved" | "returned";
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  totalRequired: number;
  totalCompleted: number;
  submittedAt: string;
}

export interface WorkLogTodayResponse {
  facility: { facilityKey: string };
  workDate: string;
  shiftType: WorkLogShift;
  weekday: number;
  user: { employeeNumber: string; name: string };
  progress: {
    totalRequired: number;
    totalCompleted: number;
    tasksRequired: number;
    tasksCompleted: number;
    waterRequired: number;
    waterCompleted: number;
    handoverPending: number;
  };
  sections: {
    waterQuality: { schedules: WaterQualitySlot[]; records: WaterQualityRecordDTO[] };
    dailyTasks: WorkLogTaskItem[];
    assignedTasks: WorkLogTaskItem[];
    recurringTasks: WorkLogTaskItem[];
    handover: LifeguardHandoverItem[];
  };
  submission: DailyReportSubmissionDTO | null;
}

export interface PortalEventStats {
  totalEvents: number;
  byType: Array<{ eventType: string; count: number }>;
  topEmployees: Array<{ employeeNumber: string | null; employeeName: string | null; count: number }>;
  topTargets: Array<{ eventType: string; target: string | null; targetLabel: string | null; count: number }>;
  dailyCounts: Array<{ day: string; count: number }>;
}
