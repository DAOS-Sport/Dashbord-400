import { apiGet } from "@/shared/api/client";

export interface TrainingViewReport {
  totalViews: number;
  uniqueViewers: number;
  uniqueResources: number;
  byResource: Array<{
    resourceId: string;
    title: string;
    mediaType?: string;
    url?: string;
    count: number;
    lastViewedAt: string;
  }>;
  byViewer: Array<{
    userId: string;
    role?: string;
    facilityKey?: string;
    count: number;
    lastViewedAt: string;
  }>;
  latestViews: Array<{
    id?: number;
    resourceId?: string;
    title?: string;
    mediaType?: string;
    url?: string;
    userId?: string;
    role?: string;
    facilityKey?: string;
    page: string;
    occurredAt: string;
    correlationId?: string;
  }>;
}

export const fetchTrainingViewReport = () =>
  apiGet<TrainingViewReport>("/api/telemetry/training-views");
