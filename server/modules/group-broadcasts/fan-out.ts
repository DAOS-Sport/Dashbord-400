export const SANLU_SOURCE_FACILITY = "salu_counter";
export const SANLU_BROADCAST_TARGETS = [
  "xinbei_pool",
  "salu_counter",
  "sanmin_pool",
] as const;

export type FacilityKey = string;

export function resolveBroadcastTargets(sourceFacilityKey: FacilityKey): FacilityKey[] {
  if (sourceFacilityKey === SANLU_SOURCE_FACILITY) {
    return [...SANLU_BROADCAST_TARGETS];
  }
  return [sourceFacilityKey];
}

export function isFanOutSource(facilityKey: FacilityKey): boolean {
  return facilityKey === SANLU_SOURCE_FACILITY;
}
