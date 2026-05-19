export const SANLU_BROADCAST_TARGETS = [
  "xinbei_pool",
  "salu_counter",
  "sanmin_pool",
] as const;

export const SANLU_FACILITY_KEY = "salu_counter";

export type FacilityKey = string;

/**
 * Maps a source LINE groupId to the corresponding facility key.
 * In production this mapping would come from the facility_announcement_groups table;
 * here we provide a static default that can be extended.
 *
 * The caller should pass sourceGroupId when available (webhook ingestion),
 * or fall back to sourceFacilityKey from manual supervisor entry.
 */
export function groupIdToFacilityKey(sourceGroupId: string): FacilityKey | null {
  // This static map can be replaced with a DB lookup when the
  // facility_announcement_groups table is wired for webhook ingestion.
  // For now, unknown groups return null (caller handles fallback).
  const staticMap: Record<string, FacilityKey> = {
    // Extend this map as LINE group IDs are registered per facility.
  };
  return staticMap[sourceGroupId] ?? null;
}

/**
 * Given a source facility key, return the list of target facility keys.
 * Any message from salu_counter fans out to all three 三蘆區 facilities.
 */
export function getFanOutTargets(sourceFacilityKey: FacilityKey): FacilityKey[] {
  if (sourceFacilityKey === SANLU_FACILITY_KEY) {
    return [...SANLU_BROADCAST_TARGETS];
  }
  return [sourceFacilityKey];
}

/**
 * Resolve broadcast targets from either a sourceGroupId or explicit sourceFacilityKey.
 * sourceGroupId takes precedence if it maps to a known facility.
 */
export function resolveBroadcastTargets(
  sourceFacilityKey: FacilityKey,
  sourceGroupId?: string | null,
): FacilityKey[] {
  if (sourceGroupId) {
    const mappedFacility = groupIdToFacilityKey(sourceGroupId);
    if (mappedFacility) {
      return getFanOutTargets(mappedFacility);
    }
  }
  return getFanOutTargets(sourceFacilityKey);
}

export function isFanOutSource(facilityKey: FacilityKey): boolean {
  return facilityKey === SANLU_FACILITY_KEY;
}
