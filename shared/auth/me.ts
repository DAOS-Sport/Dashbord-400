export type WorkbenchRole = "employee" | "supervisor" | "system";

export interface AuthMeDto {
  userId: string;
  displayName: string;
  grantedRoles: WorkbenchRole[];
  activeRole: WorkbenchRole;
  grantedFacilities: string[];
  activeFacility: string;
  permissionsSnapshot: string[];
}

export interface FacilityCandidateDto {
  facilityKey: string;
  departmentName: string;
  displayName: string;
  regionGroup: string;
  operationType: string;
  statusLabel: string;
  isRecommended: boolean;
  source: "ragic-h05" | "local-fallback" | "mock-ragic-h05";
}

export interface FacilityCandidatesResponseDto {
  items: FacilityCandidateDto[];
  sourceStatus: {
    connected: boolean;
    source: string;
    lastSyncedAt?: string;
    errorMessage?: string;
  };
}

export interface LoginRequestDto {
  username: string;
  password: string;
}

export interface SwitchRoleRequestDto {
  activeRole: WorkbenchRole;
}

export interface SwitchFacilityRequestDto {
  activeFacility: string;
}

export const roleHomePath: Record<WorkbenchRole, string> = {
  employee: "/employee",
  supervisor: "/supervisor",
  system: "/system",
};

export const roleLabels: Record<WorkbenchRole, string> = {
  employee: "員工",
  supervisor: "主管",
  system: "系統",
};
