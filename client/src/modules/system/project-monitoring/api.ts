import { apiGet } from "@/shared/api/client";
import type {
  LineXbsStatusDto,
  SystemProjectDetailDto,
  SystemProjectGroup,
  SystemProjectMonitoringDto,
} from "@shared/system/project-monitoring-contract";

export const fetchSystemProjectMonitoring = () =>
  apiGet<SystemProjectMonitoringDto>("/api/bff/system/project-monitoring");

export const fetchSystemProjectDetail = (projectKey: SystemProjectGroup) =>
  apiGet<SystemProjectDetailDto>(`/api/bff/system/project-monitoring/${projectKey}`);

export const fetchLineXbsStatus = () =>
  apiGet<LineXbsStatusDto>("/api/bff/system/lineXBS-status");
