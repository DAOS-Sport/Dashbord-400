import type { FacilityCandidateDto } from "@shared/auth/me";
import { facilityLineGroups, findFacilityLineGroup } from "@shared/domain/facilities";
import { env } from "../../shared/config/env";
import { sourceOk, sourceUnavailable, type SourceResult } from "../../shared/integrations/source-status";

const RAGIC_FACILITY_KEY = {
  departmentName: ["部門名稱", "部門", "場館名稱", "名稱"],
  operationType: ["運營性質", "營運性質"],
  status: ["狀態", "場館狀態", "合約狀態"],
} as const;

const readAny = (row: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
};

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, "").toLowerCase();
const normalizeOperationType = (value: string) => normalizeLabel(value).toUpperCase();
const isEndedStatus = (value: string) => {
  const normalized = normalizeLabel(value);
  return normalized === "結束" || normalized.includes("已結束") || normalized.includes("終止") || normalized.includes("ended");
};

const resolveFacilityKey = (departmentName: string) => {
  const normalized = departmentName.replace(/\s+/g, "");
  const matched = facilityLineGroups.find((facility) =>
    facility.ragicDepartmentAliases.some((alias) => {
      const normalizedAlias = alias.replace(/\s+/g, "");
      return normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    }),
  );
  return matched?.facilityKey;
};

const toCandidate = (
  row: Record<string, unknown>,
  source: FacilityCandidateDto["source"],
): FacilityCandidateDto | null => {
  const departmentName = readAny(row, RAGIC_FACILITY_KEY.departmentName);
  const operationType = readAny(row, RAGIC_FACILITY_KEY.operationType);
  const statusLabel = readAny(row, RAGIC_FACILITY_KEY.status) || "履約中";
  if (!departmentName || normalizeOperationType(operationType) !== "OT" || isEndedStatus(statusLabel)) return null;

  const facilityKey = resolveFacilityKey(departmentName);
  if (!facilityKey) return null;
  const facility = findFacilityLineGroup(facilityKey);
  return {
    facilityKey,
    departmentName,
    displayName: departmentName,
    regionGroup: facility?.area ?? "未分區",
    operationType,
    statusLabel,
    isRecommended: Boolean(facility?.isPrimary),
    source,
  };
};

export const localFacilityCandidates = (
  facilityKeys: string[],
  source: FacilityCandidateDto["source"] = "local-fallback",
): FacilityCandidateDto[] =>
  facilityLineGroups
    .filter((facility) => facilityKeys.includes(facility.facilityKey))
    .map((facility) => ({
      facilityKey: facility.facilityKey,
      departmentName: facility.ragicDepartmentAliases[0] ?? facility.fullName,
      displayName: facility.ragicDepartmentAliases[0] ?? facility.fullName,
      regionGroup: facility.area,
      operationType: "OT",
      statusLabel: "履約中",
      isRecommended: Boolean(facility.isPrimary),
      source,
    }));

export const listRagicH05FacilityCandidates = async (): Promise<SourceResult<FacilityCandidateDto[]>> => {
  if (env.ragicAdapterMode === "mock") {
    return sourceOk("mock-ragic-h05", localFacilityCandidates(facilityLineGroups.map((facility) => facility.facilityKey), "mock-ragic-h05"));
  }

  if (!env.ragicApiKey) {
    return sourceUnavailable("ragic-h05", "RAGIC_API_KEY is not configured", "RAGIC_API_KEY_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);
  try {
    const url = new URL(`https://${env.ragicHost}/${env.ragicAccountPath}${env.ragicFacilitySheet}`);
    url.searchParams.set("api", "");
    url.searchParams.set("limit", "1000");
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${env.ragicApiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return sourceUnavailable("ragic-h05", `Ragic returned ${response.status}`, "RAGIC_HTTP_ERROR");
    }

    const json = await response.json() as Record<string, Record<string, unknown>> | Array<Record<string, unknown>>;
    const rows = Array.isArray(json) ? json : Object.values(json);
    const seen = new Set<string>();
    const candidates = rows
      .map((row) => toCandidate(row, "ragic-h05"))
      .filter((candidate): candidate is FacilityCandidateDto => Boolean(candidate))
      .filter((candidate) => {
        if (seen.has(candidate.facilityKey)) return false;
        seen.add(candidate.facilityKey);
        return true;
      });
    return sourceOk("ragic-h05", candidates);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ragic H05 error";
    return sourceUnavailable("ragic-h05", message, "RAGIC_H05_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
};
