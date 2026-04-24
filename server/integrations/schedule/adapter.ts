import type { SourceResult } from "../../shared/integrations/source-status";

/**
 * Schedule data is external source data. It should be snapshotted/projected
 * before being served as workbench BFF data.
 */
export interface ScheduleShift {
  id: string;
  facilityKey: string;
  label: string;
  startsAt: string;
  endsAt: string;
  employeeNumber?: string;
  employeeName?: string;
  venueName?: string;
  kind?: string;
}

export interface ScheduleAdapter {
  listTodayShifts(facilityKey: string): Promise<SourceResult<ScheduleShift[]>>;
}
