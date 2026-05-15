import type { ShiftSummary } from "@shared/domain/workbench";
import type { AppContainer } from "../../../app/container";

export const mapScheduleShifts = (
  items: Awaited<
    ReturnType<AppContainer["integrations"]["schedule"]["listTodayShifts"]>
  >["data"],
): ShiftSummary[] => {
  const now = Date.now();
  return (items ?? [])
    .map((item) => {
      const status: ShiftSummary["status"] =
        item.startsAt &&
        item.endsAt &&
        Date.parse(item.startsAt) <= now &&
        Date.parse(item.endsAt) >= now
          ? "active"
          : item.endsAt && Date.parse(item.endsAt) < now
            ? "finished"
            : "upcoming";
      return {
        id: item.id,
        label: item.label,
        timeRange:
          item.startsAt && item.endsAt
            ? `${item.startsAt} - ${item.endsAt}`
            : "依排班系統",
        status,
        employeeName: item.employeeName,
        venueName: item.venueName,
        facilityKey: item.facilityKey,
        role: item.role,
        period: item.period,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        kind: item.kind,
      };
    })
    .sort(
      (a, b) => Date.parse(a.startsAt ?? "") - Date.parse(b.startsAt ?? ""),
    );
};
