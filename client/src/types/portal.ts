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

export interface PortalEventStats {
  totalEvents: number;
  byType: Array<{ eventType: string; count: number }>;
  topEmployees: Array<{ employeeNumber: string | null; employeeName: string | null; count: number }>;
  topTargets: Array<{ eventType: string; target: string | null; targetLabel: string | null; count: number }>;
  dailyCounts: Array<{ day: string; count: number }>;
}
