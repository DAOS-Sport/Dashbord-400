import type { ScheduleAdapter } from "./adapter";
import { env } from "../../shared/config/env";
import { sourceOk, sourceUnavailable } from "../../shared/integrations/source-status";
import { findFacilityLineGroup, findScheduleRegionKey } from "@shared/domain/facilities";

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

export const realScheduleAdapter: ScheduleAdapter = {
  async listTodayShifts(facilityKey) {
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
