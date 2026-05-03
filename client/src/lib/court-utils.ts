export {
  COURTS,
  COURT_COUNT,
  MIN_COURT_ID,
  MAX_COURT_ID,
  SCHOOLS,
  SCHOOL_IDS,
  DEFAULT_SCHOOL,
  getCourt,
  getCourtName,
  getCourtType,
  getCourtSchool,
  getCourtsBySchool,
  getCourtCategories,
  getCourtsByFilter,
  isValidCourtId,
  isValidCourtForSchool,
  isValidSchool,
  getSchool,
  getSchoolName,
  type CourtInfo,
  type CourtType,
  type CourtCategory,
  type SchoolId,
  type SchoolInfo,
} from "@shared/court-config";

import type { CourtType } from "@shared/court-config";

export const getCourtHeaderClass = (type: CourtType | undefined): string => {
  switch (type) {
    case "baseball":
      return "bg-orange-50 text-orange-800";
    case "gym":
      return "bg-purple-50 text-purple-800";
    case "baseball2f":
      return "bg-green-50 text-green-800";
    case "basketball":
      return "bg-red-50 text-red-800";
    case "dance":
      return "bg-pink-50 text-pink-800";
    case "oxygen":
      return "bg-cyan-50 text-cyan-800";
    case "badminton":
      return "bg-blue-50 text-blue-800";
    default:
      return "bg-gray-50 text-gray-700";
  }
};

export const getCourtBarClass = (type: CourtType | undefined): string => {
  switch (type) {
    case "baseball":
    case "baseball2f":
      return "bg-orange-500";
    case "gym":
      return "bg-purple-500";
    case "basketball":
      return "bg-red-500";
    case "dance":
      return "bg-pink-500";
    case "oxygen":
      return "bg-cyan-500";
    case "badminton":
      return "bg-blue-500";
    default:
      return "bg-gray-400";
  }
};

export const getCourtTypeLabel = (type: CourtType | undefined): string => {
  switch (type) {
    case "badminton":
      return "羽球場";
    case "baseball":
    case "baseball2f":
      return "棒球場";
    case "gym":
      return "健身房";
    case "basketball":
      return "籃球場";
    case "dance":
      return "舞蹈教室";
    case "oxygen":
      return "恢復室";
    default:
      return "場地";
  }
};
