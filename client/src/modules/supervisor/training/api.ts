import { apiGet } from "@/shared/api/client";
import type { EmployeeResourceDTO } from "@/modules/employee/home/api";

export const fetchSupervisorTrainingResources = (facilityKey: string) =>
  apiGet<{ items: EmployeeResourceDTO[] }>(
    `/api/portal/employee-resources?facilityKey=${encodeURIComponent(facilityKey)}&category=training&limit=200`,
  );
