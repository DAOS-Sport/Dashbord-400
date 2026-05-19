export type BffSectionStatus = "ok" | "stale" | "unavailable" | "degraded";

export interface AnnouncementFilterBreakdown {
  upstreamTotal: number;
  approvedTotal: number;
  qualityFiltered: number;
  scopeFiltered: number;
  displayableTotal: number;
}

export interface BffSectionMeta {
  lastSyncAt?: string;
  errorCode?: string;
  fallbackReason?: string;
  filterBreakdown?: AnnouncementFilterBreakdown;
}

export interface BffSection<T> {
  status: BffSectionStatus;
  data: T | null;
  meta: BffSectionMeta;
}
