import { facilityLabel } from "@shared/domain/facilities";
import type { ShiftBoardDto, ShiftSummary } from "@shared/domain/workbench";

export const formatBusinessDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

export const buildShiftBoardFromSummaries = (
  facilityKey: string,
  userId: string,
  shifts: ShiftSummary[] | null | undefined,
  source: { connected: boolean; lastSyncedAt?: string; errorMessage?: string },
): ShiftBoardDto => {
  const nowIso = new Date().toISOString();
  const nowTime = Date.parse(nowIso);
  const grouped = new Map<string, ShiftBoardDto["shifts"][number]>();

  (shifts ?? [])
    .filter((shift) => shift.startsAt && shift.endsAt)
    .forEach((shift) => {
      const start = shift.startsAt!;
      const end = shift.endsAt!;
      const key = `${start}|${end}`;
      const startTime = Date.parse(start);
      const endTime = Date.parse(end);
      const current = grouped.get(key) ?? {
        shiftId: key,
        start,
        end,
        isCurrent:
          Number.isFinite(startTime) &&
          Number.isFinite(endTime) &&
          nowTime >= startTime &&
          nowTime < endTime,
        isFuture: Number.isFinite(startTime) && startTime > nowTime,
        people: [],
      };
      const personId =
        shift.id ||
        `${shift.employeeName ?? "unknown"}-${current.people.length}`;
      current.people.push({
        userId: personId,
        name:
          shift.employeeName || shift.label.split("/")[0]?.trim() || "未命名",
        role: shift.kind || shift.label.split("/")[1]?.trim() || "當班",
        isCurrentUser: Boolean(
          userId && (personId === userId || shift.employeeName === userId),
        ),
      });
      grouped.set(key, current);
    });

  const boardShifts = Array.from(grouped.values()).sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );

  return {
    facility: {
      key: facilityKey,
      name: facilityLabel(facilityKey),
    },
    date: formatBusinessDate(),
    now: nowIso,
    currentUserId: userId,
    shifts: boardShifts,
    totalCount: boardShifts.reduce(
      (sum, shift) => sum + shift.people.length,
      0,
    ),
    sourceStatus: {
      connected: source.connected,
      lastSyncedAt: source.lastSyncedAt,
      errorMessage: source.errorMessage,
    },
  };
};

export const filterShiftSummariesForFacility = (
  shifts: ShiftSummary[] | null | undefined,
  facilityKey: string,
) =>
  (shifts ?? []).filter(
    (shift) => !shift.facilityKey || shift.facilityKey === facilityKey,
  );
