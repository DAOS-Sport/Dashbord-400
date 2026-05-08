import { apiGet, apiPost } from "@/shared/api/client";
import { rawInspectorTargets, type RawInspectorPath } from "@shared/system/raw-inspector";

export { rawInspectorTargets, type RawInspectorPath };

export interface RawInspectorResponse {
  path: RawInspectorPath;
  label: string;
  queriedAt: string;
  status: number;
  data: unknown;
}

export const fetchRawInspectorTarget = async (path: RawInspectorPath) => {
  return apiPost<RawInspectorResponse>("/api/bff/system/raw-inspector", { path });
};
