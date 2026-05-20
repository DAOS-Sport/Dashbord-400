import { apiGet } from "@/shared/api/client";
import type { ActionMonitoringDto } from "@shared/system/action-monitoring-contract";

export const fetchActionMonitoring = () =>
  apiGet<ActionMonitoringDto>("/api/bff/system/action-monitoring");
