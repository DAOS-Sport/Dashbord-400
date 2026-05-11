import type { SchoolId } from "@shared/court-config";

export const getEmployeeCourtSchoolsForFacility = (facilityKey?: string | null, facilityName?: string | null): SchoolId[] => {
  const key = (facilityKey ?? "").toLowerCase();
  const name = facilityName ?? "";

  if (key.includes("salu") || key.includes("sanchong") || key.includes("sanlu") || /三重商工|三蘆|商工/.test(name)) {
    return ["sanchong"];
  }

  if (key.includes("xinbei") || /新北高中|新北高中游泳池|新北/.test(name)) {
    return ["xinbei"];
  }

  return [];
};

