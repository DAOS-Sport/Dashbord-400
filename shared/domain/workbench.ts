import type { BffSection } from "../bff/envelope";
import type { WorkbenchWidgetLayoutItem } from "./layout";
import type { HomeCardDto, NavigationModuleDto } from "../modules/types";

export interface EmployeeHomeCardSet {
  todayTasks: HomeCardDto;
  announcements: HomeCardDto;
  handover: HomeCardDto;
  quickActions: HomeCardDto;
  shiftReminder: HomeCardDto;
  bookingSnapshot: HomeCardDto;
}

export interface FacilitySummary {
  key: string;
  name: string;
  businessDate: string;
  statusLabel: string;
}

export interface WeatherSummary {
  temperatureC: number;
  label: string;
  humidity: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  content?: string | null;
  status: "pending" | "in_progress" | "reported" | "done";
  priority: "low" | "normal" | "high";
  dueLabel?: string;
  dueAt?: string | null;
  createdByName?: string | null;
  assignedToName?: string | null;
  source?: "employee" | "supervisor" | "system";
  reportNote?: string | null;
}

export interface AnnouncementSummary {
  id: string;
  resourceId?: number;
  title: string;
  summary: string;
  priority: "required" | "high" | "normal";
  effectiveRange: string;
  type?: "required" | "sop" | "notice" | "event" | "general";
  isPinned?: boolean;
  publishedAt?: string;
  scheduledAt?: string;
  content?: string;
  deadlineLabel?: string;
  linkUrl?: string;
  linkLabel?: string;
  acknowledgedAt?: string | null;
  isAcknowledged?: boolean;
}

export interface HandoverSummary {
  id: string;
  title: string;
  authorName: string;
  status: "unread" | "read" | "confirmed" | "pending" | "completed" | "expired";
  content?: string;
  facilityKey?: string;
  targetDate?: string;
  targetShiftLabel?: string;
  dueLabel?: string;
  reportNote?: string | null;
  assigneeName?: string | null;
}

export interface HandoverItemDto {
  id: string;
  facilityKey: string;
  title: string;
  content: string;
  dueDate: string;
  preview: string;
  status: "pending" | "completed" | "expired";
  priority?: "low" | "normal" | "high";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reportNote?: string | null;
}

export interface HandoverSummaryDto {
  moduleId: "handover";
  title: "交辦事項";
  items: Array<Pick<HandoverItemDto, "id" | "title" | "dueDate" | "preview" | "status">>;
  totalPending: number;
  sourceStatus: {
    connected: boolean;
    lastSyncedAt?: string;
    errorMessage?: string;
  };
}

export interface HandoverListDto {
  moduleId: "handover";
  items: HandoverItemDto[];
  sourceStatus: {
    connected: boolean;
    lastSyncedAt?: string;
    errorMessage?: string;
  };
}

export interface ShortcutSummary {
  id: string;
  label: string;
  href: string;
  tone: "blue" | "green" | "amber" | "violet" | "rose" | "cyan";
}

export interface ShiftSummary {
  id: string;
  label: string;
  timeRange: string;
  status: "active" | "upcoming" | "finished";
  employeeName?: string;
  venueName?: string;
  startsAt?: string;
  endsAt?: string;
  kind?: string;
}

export interface ShiftBoardDto {
  facility: {
    key: string;
    name: string;
  };
  date: string;
  now: string;
  currentUserId: string;
  shifts: Array<{
    shiftId: string;
    start: string;
    end: string;
    isCurrent: boolean;
    isFuture: boolean;
    people: Array<{
      userId: string;
      name: string;
      role: string;
      isCurrentUser: boolean;
    }>;
  }>;
  totalCount: number;
  sourceStatus: {
    connected: boolean;
    lastSyncedAt?: string;
    errorMessage?: string;
  };
}

export interface CampaignSummary {
  id: string;
  resourceId?: number;
  title: string;
  statusLabel: string;
  effectiveRange: string;
  linkUrl?: string;
  imageUrl?: string;
}

export interface DocumentSummary {
  id: string;
  resourceId?: number;
  title: string;
  updatedAt: string;
  url?: string;
  description?: string;
  subCategory?: string;
  sortOrder?: number;
  source?: "employee_resource" | "system_link" | "quick_link";
}

export interface StickyNoteSummary {
  id: string;
  resourceId?: number;
  title: string;
  content: string;
  authorName?: string | null;
  createdAt: string;
  scheduledAt?: string | null;
}

export interface TrainingSummary {
  id: string;
  resourceId?: number;
  title: string;
  content?: string;
  url?: string;
  mediaType: "video" | "image" | "link" | "note";
  subCategory?: string;
  createdByName?: string | null;
  updatedAt: string;
}

export interface EmployeeHomeDto {
  homeCards?: EmployeeHomeCardSet;
  currentUser?: {
    id: string;
    displayName: string;
    role: "employee";
    facilityName: string;
  };
  date?: string;
  quickSearch?: {
    placeholder: string;
    enabledModules: string[];
  };
  todayTasks?: HomeCardDto;
  handoverSummary?: HomeCardDto;
  importantAnnouncements?: HomeCardDto;
  quickActions?: HomeCardDto;
  todayShift?: HomeCardDto;
  weatherCard?: HomeCardDto;
  navigation?: NavigationModuleDto[];
  unreadCounts?: {
    announcements: number;
    tasks: number;
    handovers: number;
  };
  facility: FacilitySummary;
  layout?: BffSection<WorkbenchWidgetLayoutItem[]>;
  weather: BffSection<WeatherSummary>;
  tasks: BffSection<TaskSummary[]>;
  announcements: BffSection<AnnouncementSummary[]>;
  handover: BffSection<HandoverSummary[]>;
  shortcuts: BffSection<ShortcutSummary[]>;
  shifts: BffSection<ShiftSummary[]>;
  campaigns: BffSection<CampaignSummary[]>;
  documents: BffSection<DocumentSummary[]>;
  stickyNotes: BffSection<StickyNoteSummary[]>;
  training: BffSection<TrainingSummary[]>;
}

export interface SupervisorStaffingSummary {
  active: number;
  total: number;
  onShift: number;
  absent: number;
  activeEmployees?: StaffMemberSummary[];
  currentOnDuty?: StaffMemberSummary[];
  nextOnDuty?: StaffMemberSummary[];
  byFacility?: Array<{ facilityKey: string; facilityName: string; active: number; onShift: number; next: number }>;
}

export interface StaffMemberSummary {
  employeeNumber?: string;
  name: string;
  facilityKey?: string;
  facilityName?: string;
  title?: string;
  department?: string;
  shiftLabel?: string;
  timeRange?: string;
  status?: "active" | "upcoming" | "off";
}

export interface SupervisorAnomalySummary {
  id: string;
  employeeName: string;
  issue: string;
  waitingMinutes: number;
  priority: "high" | "medium" | "low";
}

export interface SupervisorDashboardDto {
  facility: FacilitySummary;
  staffing: BffSection<SupervisorStaffingSummary>;
  pendingAnomalies: BffSection<SupervisorAnomalySummary[]>;
  incompleteTasks: BffSection<TaskSummary[]>;
  announcementAcks: BffSection<{ unconfirmed: number; totalRequired: number }>;
  handoverOverview: BffSection<{ open: number; confirmed: number }>;
  shifts: BffSection<ShiftSummary[]>;
  campaigns: BffSection<CampaignSummary[]>;
}

export interface SystemMetricSummary {
  label: string;
  value: string;
  status: "ok" | "warning" | "critical";
  helper: string;
}

export interface SystemIncidentSummary {
  id: string;
  title: string;
  time: string;
  severity: "critical" | "warning" | "info";
}

export interface SystemOverviewDto {
  checkedAt: string;
  healthScore: BffSection<{ score: number; statusLabel: string }>;
  metrics: BffSection<SystemMetricSummary[]>;
  incidents: BffSection<SystemIncidentSummary[]>;
  integrationFailures: BffSection<SystemIncidentSummary[]>;
  auditSummary: BffSection<{ todayEvents: number; rawInspectorQueries: number }>;
}
