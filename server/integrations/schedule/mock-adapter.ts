import type { ScheduleAdapter } from "./adapter";
import { sourceOk } from "../../shared/integrations/source-status";

export const mockScheduleAdapter: ScheduleAdapter = {
  async listTodayShifts(facilityKey) {
    return sourceOk("mock-schedule", [
      {
        id: "shift-early",
        facilityKey,
        employeeNumber: "A001",
        employeeName: "新北值班人員",
        venueName: "新北高中",
        kind: "regular",
        label: "新北值班人員 / 早班",
        startsAt: "2026-04-23T08:00:00+08:00",
        endsAt: "2026-04-23T16:00:00+08:00",
      },
      {
        id: "shift-late",
        facilityKey,
        employeeNumber: "A002",
        employeeName: "商工值班人員",
        venueName: "三重商工",
        kind: "regular",
        label: "商工值班人員 / 晚班",
        startsAt: "2026-04-23T16:00:00+08:00",
        endsAt: "2026-04-23T22:00:00+08:00",
      },
    ]);
  },
};
