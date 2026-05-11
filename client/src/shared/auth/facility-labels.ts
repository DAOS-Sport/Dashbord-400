import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FacilityCandidatesResponseDto } from "@shared/auth/me";
import { facilityLabel } from "@shared/domain/facilities";
import { apiGet } from "@/shared/api/client";

export const facilityCandidateQueryKey = ["/api/auth/facility-candidates"] as const;

export const useFacilityCandidates = (enabled = true) =>
  useQuery({
    queryKey: facilityCandidateQueryKey,
    queryFn: () => apiGet<FacilityCandidatesResponseDto>("/api/auth/facility-candidates"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

export const fallbackFacilityName = (facilityKey: string) =>
  facilityLabel(facilityKey);

export const displayFacilityName = (facilityKey: string, rawName: string | null | undefined) => {
  if (facilityKey === "salu_counter") return "三重商工";
  return rawName?.trim() || fallbackFacilityName(facilityKey);
};

export const useFacilityLabelMap = (facilityKeys: string[] = []) => {
  const candidatesQuery = useFacilityCandidates(facilityKeys.length > 0);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of candidatesQuery.data?.items ?? []) {
      map.set(candidate.facilityKey, displayFacilityName(candidate.facilityKey, candidate.displayName || candidate.departmentName));
    }
    for (const facilityKey of facilityKeys) {
      if (!map.has(facilityKey)) map.set(facilityKey, fallbackFacilityName(facilityKey));
    }
    return map;
  }, [candidatesQuery.data?.items, facilityKeys]);

  const getFacilityName = (facilityKey: string | null | undefined) =>
    facilityKey ? labelMap.get(facilityKey) ?? fallbackFacilityName(facilityKey) : "尚未選擇場館";

  return {
    ...candidatesQuery,
    labelMap,
    getFacilityName,
  };
};
