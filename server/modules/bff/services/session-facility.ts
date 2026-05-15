import {
  DEFAULT_FACILITY_KEY,
  isCanonicalFacilityKey,
  toCanonicalFacilityKey,
} from "@shared/facility/canonical-keys";
import type { Request } from "express";

export const resolveSessionFacilityKey = (
  session: NonNullable<Request["workbenchSession"]>,
  requested?: string,
) => {
  const canonicalRequested = requested
    ? toCanonicalFacilityKey(requested)
    : undefined;
  if (requested && !canonicalRequested) {
    return { ok: false as const, status: 400, message: "INVALID_FACILITY_KEY" };
  }
  const canonicalActive = toCanonicalFacilityKey(session.activeFacility);
  if (session.activeFacility && !canonicalActive) {
    return { ok: false as const, status: 400, message: "INVALID_FACILITY_KEY" };
  }
  const granted = session.grantedFacilities
    .map((key) => toCanonicalFacilityKey(key))
    .filter(Boolean) as string[];
  const facilityKey =
    canonicalRequested ?? canonicalActive ?? DEFAULT_FACILITY_KEY;
  if (!isCanonicalFacilityKey(facilityKey)) {
    return { ok: false as const, status: 400, message: "INVALID_FACILITY_KEY" };
  }
  if (!granted.includes(facilityKey)) {
    return {
      ok: false as const,
      status: 403,
      message: "Facility is not granted",
    };
  }
  return { ok: true as const, facilityKey };
};
