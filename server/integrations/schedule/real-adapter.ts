import type { ScheduleAdapter, ScheduleShift, ScheduleSnapshot, ScheduleSnapshotInput } from "./adapter";
import { env } from "../../shared/config/env";
import { sourceOk, sourceUnavailable } from "../../shared/integrations/source-status";
import { facilityLineGroups, findFacilityLineGroup, findScheduleRegionKey } from "@shared/domain/facilities";

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");
const readText = (value: unknown, fallback = "") => (typeof value === "string" && value.trim() ? value : fallback);

const readNestedText = (value: unknown, keys: string[], fallback = "") => {
  if (!isObject(value)) return fallback;
  for (const key of keys) {
    const text = readText(value[key]);
    if (text) return text;
  }
  return fallback;
};

const withOptionalAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.smartScheduleApiToken) {
    headers.Authorization = `Bearer ${env.smartScheduleApiToken}`;
    headers["X-Internal-Token"] = env.smartScheduleApiToken;
    headers["X-API-Key"] = env.smartScheduleApiToken;
  }
  return headers;
};

const todayText = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const addDays = (dateText: string, days: number) => {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
};

const normalizePeriod = (period: string, startsAt: string): ScheduleShift["period"] => {
  if (period === "early" || period === "mid" || period === "late" || period === "custom") return period;
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) return "custom";
  const hour = parsed.getHours();
  if (hour < 12) return "early";
  if (hour < 16) return "mid";
  return "late";
};

const matchesFacility = (facilityKey: string, row: Record<string, unknown>) => {
  const facility = findFacilityLineGroup(facilityKey);
  if (!facility) return true;
  const venue = isObject(row.venue) ? row.venue : {};
  const names = [
    readText(venue.key),
    readText(venue.name),
    readText(venue.shortName),
    ...((Array.isArray(venue.aliases) ? venue.aliases : []) as unknown[]).map((item) => readText(item)),
  ].filter(Boolean);
  const aliases = [facility.facilityKey, facility.shortName, facility.fullName, ...facility.ragicDepartmentAliases];
  return names.length === 0 || names.some((name) => aliases.some((alias) => name.includes(alias) || alias.includes(name)));
};

const mapExportSchedule = (facilityKey: string, row: Record<string, unknown>, index: number): ScheduleShift | null => {
  const assignment = isObject(row.assignment) ? row.assignment : {};
  const status = readText(assignment.status, "scheduled");
  const raw = isObject(row.raw) ? row.raw : {};
  const rawRole = readText(raw.role);
  if (status && !["scheduled", "changed", "completed"].includes(status)) return null;
  if (/休假|取消|請假/.test(`${rawRole} ${status}`)) return null;
  if (!matchesFacility(facilityKey, row)) return null;

  const shift = isObject(row.shift) ? row.shift : {};
  const employee = isObject(row.employee) ? row.employee : {};
  const venue = isObject(row.venue) ? row.venue : {};
  const startsAt = readText(shift.startAt);
  const endsAt = readText(shift.endAt);
  const period = normalizePeriod(readText(shift.period), startsAt);
  const employeeName = readText(employee.name);
  const venueName = readText(venue.name, readText(venue.shortName));
  const kind = readText(assignment.kind, readText(row.kind, "regular"));

  return {
    id: String(row.rawId ?? row.sourceRowId ?? readText(shift.id) ?? `export-schedule-${index}`),
    rawId: String(row.rawId ?? row.sourceRowId ?? ""),
    facilityKey,
    employeeNumber: readText(employee.employeeNumber),
    employeeName,
    venueName,
    kind,
    period,
    assignmentStatus: status,
    label: [employeeName, venueName, readText(shift.label, period ?? kind)].filter(Boolean).join(" / ") || "班表",
    startsAt,
    endsAt,
    timeRange: startsAt && endsAt ? `${startsAt} - ${endsAt}` : "依排班系統",
  };
};

const fetchSnapshot = async (input: ScheduleSnapshotInput): Promise<ScheduleSnapshot> => {
  const url = new URL("/api/internal/export/snapshot", env.smartScheduleBaseUrl);
  url.searchParams.set("from", input.from);
  url.searchParams.set("to", input.to);
  url.searchParams.set("facilityKey", findScheduleRegionKey(input.facilityKey));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);
  try {
    const response = await fetch(url, { headers: withOptionalAuthHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error(`Smart Schedule export returned ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Smart Schedule export returned non-JSON response");
    const payload = await response.json() as Record<string, unknown>;
    return {
      range: isObject(payload.range) ? payload.range as ScheduleSnapshot["range"] : { from: input.from, to: input.to },
      venues: Array.isArray(payload.venues) ? payload.venues : [],
      shifts: Array.isArray(payload.shifts) ? payload.shifts : [],
      employees: Array.isArray(payload.employees) ? payload.employees : [],
      schedules: Array.isArray(payload.schedules) ? payload.schedules : [],
      changes: Array.isArray(payload.changes) ? payload.changes : [],
      generatedAt: readText(payload.generatedAt, new Date().toISOString()),
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const realScheduleAdapter: ScheduleAdapter = {
  async getScheduleSnapshot(input) {
    try {
      return sourceOk("smart-schedule-export", await fetchSnapshot(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Smart Schedule export error";
      return sourceUnavailable("smart-schedule-export", message, "SMART_SCHEDULE_EXPORT_FAILED");
    }
  },

  async listRangeShifts(input) {
    const snapshot = await this.getScheduleSnapshot(input);
    if (snapshot.data) {
      return sourceOk(
        "smart-schedule-export",
        snapshot.data.schedules
          .filter((row): row is Record<string, unknown> => isObject(row))
          .map((row, index) => mapExportSchedule(input.facilityKey, row, index))
          .filter((row): row is ScheduleShift => Boolean(row)),
      );
    }
    return sourceUnavailable("smart-schedule-export", snapshot.meta.fallbackReason || "Smart Schedule export unavailable", snapshot.meta.errorCode || "SMART_SCHEDULE_EXPORT_FAILED");
  },

  async resolveHandoverAssignee(input) {
    const snapshot = await this.getScheduleSnapshot({ facilityKey: input.facilityKey, from: input.targetDate, to: input.targetDate });
    if (!snapshot.data) return sourceUnavailable("smart-schedule-export", snapshot.meta.fallbackReason || "Smart Schedule export unavailable", snapshot.meta.errorCode || "SMART_SCHEDULE_EXPORT_FAILED");
    const target = input.targetShiftLabel;
    const candidates = snapshot.data.schedules
      .filter((row): row is Record<string, unknown> => isObject(row))
      .map((row, index) => ({ row, mapped: mapExportSchedule(input.facilityKey, row, index) }))
      .filter((item) => item.mapped);
    const matched = candidates.find(({ row, mapped }) => {
      const shift = isObject(row.shift) ? row.shift : {};
      const label = `${readText(shift.label)} ${readText(shift.name)} ${mapped?.period ?? ""}`;
      return label.includes(target) ||
        (target.includes("早") && mapped?.period === "early") ||
        (target.includes("中") && mapped?.period === "mid") ||
        (target.includes("晚") && mapped?.period === "late");
    });
    if (!matched?.mapped) return sourceOk("smart-schedule-export", null);
    return sourceOk("smart-schedule-export", {
      employeeNumber: matched.mapped.employeeNumber || "",
      name: matched.mapped.employeeName || "",
      scheduleRawId: matched.mapped.rawId,
      matchedBy: "date+facility+period",
      confidence: matched.mapped.period === "custom" ? 0.72 : 0.9,
    });
  },

  async listTodayShifts(facilityKey) {
    const today = todayText();
    const exportResult = await this.listRangeShifts({ facilityKey, from: today, to: today });
    if (exportResult.data?.length) return exportResult;

    const scheduleFacilityKey = findScheduleRegionKey(facilityKey);
    const facility = findFacilityLineGroup(facilityKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);

    try {
      const url = new URL("/api/internal/schedules/today", env.smartScheduleBaseUrl);
      url.searchParams.set("facilityKey", scheduleFacilityKey);
      const response = await fetch(url, {
        headers: withOptionalAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        return sourceUnavailable("smart-schedule", `Smart Schedule returned ${response.status}`, "SMART_SCHEDULE_HTTP_ERROR");
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return sourceUnavailable("smart-schedule", "Smart Schedule returned non-JSON response", "SMART_SCHEDULE_NON_JSON_RESPONSE");
      }

      const payload = await response.json() as Record<string, unknown>;
      const rows = Array.isArray(payload.shifts)
        ? payload.shifts
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      const date = readText(payload.date, new Date().toISOString().slice(0, 10));

      return sourceOk(
        "smart-schedule-internal",
        rows
          .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
          .filter((row) => {
            const venueName = readNestedText(row.venue, ["name", "venueName", "facilityName"]);
            if (!venueName || !facility) return true;
            const aliases = [facility.shortName, facility.fullName, ...facility.ragicDepartmentAliases];
            return aliases.some((alias) => venueName.includes(alias) || alias.includes(venueName));
          })
          .map((row, index) => ({
            id: String(row.shiftId ?? row.id ?? row._id ?? `smart-schedule-${index}`),
            facilityKey: String(row.facilityKey ?? facilityKey),
            employeeNumber: readNestedText(row.employee, ["employeeNumber", "employeeCode", "code"]),
            employeeName: readNestedText(row.employee, ["name", "employeeName", "displayName"]),
            venueName: readNestedText(row.venue, ["name", "venueName", "facilityName"]),
            kind: readText(row.kind),
            label: [
              readNestedText(row.employee, ["name", "employeeName", "displayName"]),
              readNestedText(row.venue, ["name", "venueName", "facilityName"]),
              readText(row.kind),
            ].filter(Boolean).join(" / ") || readText(row.label ?? row.shiftLabel ?? row.name, "班別"),
            startsAt: normalizeDateTime(readText(row.startsAt ?? row.startAt ?? row.startTime), date),
            endsAt: normalizeDateTime(readText(row.endsAt ?? row.endAt ?? row.endTime), date),
          })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Smart Schedule error";
      return sourceUnavailable("smart-schedule", message, "SMART_SCHEDULE_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  },
};

const normalizeDateTime = (value: string, date: string) => {
  if (!value) return "";
  if (value.includes("T")) return value;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return `${date}T${value.length === 5 ? `${value}:00` : value}+08:00`;
  return value;
};
