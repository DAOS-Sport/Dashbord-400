export interface FacilityLineGroup {
  facilityKey: string;
  fullName: string;
  shortName: string;
  area: string;
  lineGroupId: string;
  scheduleRegionKey?: string;
  ragicDepartmentAliases: string[];
}

export const facilityLineGroups: readonly FacilityLineGroup[] = [
  {
    facilityKey: "xinbei_pool",
    fullName: "新北高中游泳池&運動中心",
    shortName: "新北",
    area: "新北",
    lineGroupId: "C66a4b3bb3fbc3dcf52d42626ec512484",
    scheduleRegionKey: "A",
    ragicDepartmentAliases: ["新北高中", "新北高中游泳池", "新北高中游泳池&運動中心"],
  },
  {
    facilityKey: "salu_counter",
    fullName: "駿斯-三蘆區櫃台",
    shortName: "三蘆",
    area: "三蘆區",
    lineGroupId: "Cc2100498c7c5627c1e86e93f7c4eb817",
    scheduleRegionKey: "A",
    ragicDepartmentAliases: ["三蘆", "三蘆區", "三重商工", "駿斯-三蘆區櫃台"],
  },
  {
    facilityKey: "songshan_pool",
    fullName: "松山國小室內溫水游泳池",
    shortName: "松山",
    area: "三蘆區",
    lineGroupId: "C9b3c5dfe2e005adafd2ed914714a1930",
    scheduleRegionKey: "A",
    ragicDepartmentAliases: ["松山國小", "松山國小室內溫水游泳池"],
  },
  {
    facilityKey: "sanmin_pool",
    fullName: "三民高中游泳池",
    shortName: "三民",
    area: "三蘆區",
    lineGroupId: "C2dc6991e51074dd47d5d275d568318f7",
    scheduleRegionKey: "A",
    ragicDepartmentAliases: ["三民高中", "三民高中游泳池"],
  },
] as const;

export const findFacilityLineGroup = (facilityKeyOrGroupId: string): FacilityLineGroup | undefined =>
  facilityLineGroups.find(
    (facility) =>
      facility.facilityKey === facilityKeyOrGroupId ||
      facility.lineGroupId === facilityKeyOrGroupId,
  );

const normalizeDepartmentName = (value: string) => value.trim().replace(/\s+/g, "");

export const facilityKeysFromRagicDepartments = (departments: string | string[] | undefined): string[] => {
  const values = Array.isArray(departments)
    ? departments
    : String(departments || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const normalized = new Set(values.map(normalizeDepartmentName));
  const keys = facilityLineGroups
    .filter((facility) => facility.ragicDepartmentAliases.some((alias) => normalized.has(normalizeDepartmentName(alias))))
    .map((facility) => facility.facilityKey);

  return Array.from(new Set(keys));
};

export const findScheduleRegionKey = (facilityKey: string): string => {
  const facility = findFacilityLineGroup(facilityKey);
  return facility?.scheduleRegionKey || "A";
};
