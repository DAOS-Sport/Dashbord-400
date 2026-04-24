import type { SourceResult } from "../../shared/integrations/source-status";

/**
 * Schedule data is external source data. It should be snapshotted/projected
 * before being served as workbench BFF data.
 */
export interface ScheduleShift {
  id: string;
  facilityKey: string;
  label: string;
  timeRange?: string;
  startsAt: string;
  endsAt: string;
  employeeNumber?: string;
  employeeName?: string;
  venueName?: string;
  kind?: string;
  period?: "early" | "mid" | "late" | "custom";
  rawId?: string;
  assignmentStatus?: string;
}

export interface ScheduleSnapshotInput {
  facilityKey: string;
  from: string;
  to: string;
}

export interface ScheduleSnapshot {
  range: { from: string; to: string };
  venues: unknown[];
  shifts: unknown[];
  employees: unknown[];
  schedules: unknown[];
  changes: unknown[];
  generatedAt: string;
}

export interface ScheduleAdapter {
  listTodayShifts(facilityKey: string): Promise<SourceResult<ScheduleShift[]>>;
  getScheduleSnapshot(input: ScheduleSnapshotInput): Promise<SourceResult<ScheduleSnapshot>>;
  listRangeShifts(input: ScheduleSnapshotInput): Promise<SourceResult<ScheduleShift[]>>;
  resolveHandoverAssignee(input: {
    facilityKey: string;
    targetDate: string;
    targetShiftLabel: string;
    visibleFrom?: string | null;
    dueAt?: string | null;
  }): Promise<SourceResult<{ employeeNumber: string; name: string; scheduleRawId?: string; matchedBy: string; confidence: number } | null>>;
}
