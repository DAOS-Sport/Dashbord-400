export const CANONICAL_FACILITY_KEYS = [
  "xinbei_pool",
  "salu_counter",
  "songshan_pool",
  "sanmin_pool",
  "zhuke_pool",
] as const;

export type CanonicalFacilityKey = typeof CANONICAL_FACILITY_KEYS[number];

export const DEFAULT_FACILITY_KEY: CanonicalFacilityKey = "xinbei_pool";

const canonicalFacilityKeySet = new Set<string>(CANONICAL_FACILITY_KEYS);

const FACILITY_KEY_ALIASES: Record<string, CanonicalFacilityKey> = {
  "xinbei-high-school": "xinbei_pool",
  xinbei: "xinbei_pool",
  "xinbei-school": "xinbei_pool",
  "new-taipei-high-school": "xinbei_pool",
  sanchong: "salu_counter",
  sanlu: "salu_counter",
  "sanchong-commerce": "salu_counter",
  songshan: "songshan_pool",
  sanmin: "sanmin_pool",
  zhuke: "zhuke_pool",
  hsinchu: "zhuke_pool",
};

export const isCanonicalFacilityKey = (value: string | null | undefined): value is CanonicalFacilityKey =>
  Boolean(value && canonicalFacilityKeySet.has(value));

export const toCanonicalFacilityKey = (value: string | null | undefined): CanonicalFacilityKey | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (isCanonicalFacilityKey(trimmed)) return trimmed;
  return FACILITY_KEY_ALIASES[trimmed];
};

export const requireCanonicalFacilityKey = (value: string | null | undefined, context = "facilityKey"): CanonicalFacilityKey => {
  const key = toCanonicalFacilityKey(value);
  if (!key) {
    throw new Error(`INVALID_CANONICAL_FACILITY_KEY:${context}:${value ?? ""}`);
  }
  return key;
};

export const canonicalizeFacilityKeys = (values: readonly string[]): CanonicalFacilityKey[] => {
  const keys = values.map((value) => toCanonicalFacilityKey(value)).filter(Boolean) as CanonicalFacilityKey[];
  return Array.from(new Set(keys));
};
