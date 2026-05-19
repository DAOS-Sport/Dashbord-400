import { apiGet } from "@/shared/api/client";
import type { SystemOverviewDto } from "@shared/domain/workbench";

export interface AnomalyReport {
  id: string | number;
  employeeName: string | null;
  employeeCode: string | null;
  role: string | null;
  context: string;
  clockStatus: string | null;
  clockType: string | null;
  clockTime: string | null;
  venueName: string | null;
  distance: string | null;
  failReason: string | null;
  errorMsg: string | null;
  userNote: string | null;
  imageUrls: string[] | null;
  reportText: string | null;
  resolution: "pending" | "resolved" | string | null;
  resolvedNote: string | null;
  createdAt: string;
}

export const fetchSystemAlertsOverview = () =>
  apiGet<SystemOverviewDto>("/api/bff/system/overview");

export const fetchSystemAnomalyReports = () =>
  apiGet<AnomalyReport[]>("/api/anomaly-reports");
