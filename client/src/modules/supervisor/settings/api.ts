import type { WorkbenchLayoutRole, WorkbenchWidgetLayoutItem } from "@shared/domain/layout";
import { apiGet, apiPatch } from "@/shared/api/client";
import type { QuickLinkDTO, SystemAnnouncementDTO } from "@/types/portal";

export interface LayoutSettingsDTO {
  facilityKey: string;
  role: WorkbenchLayoutRole;
  layoutKey: string;
  widgets: WorkbenchWidgetLayoutItem[];
  updatedAt: string | null;
}

export const fetchSupervisorQuickLinks = (facilityKey: string) =>
  apiGet<{ items: QuickLinkDTO[] }>(`/api/portal/quick-links?facilityKey=${encodeURIComponent(facilityKey)}&includeInactive=true`);

export const fetchSupervisorSystemAnnouncements = (facilityKey: string) =>
  apiGet<{ items: SystemAnnouncementDTO[] }>(`/api/portal/system-announcements?facilityKey=${encodeURIComponent(facilityKey)}&includeInactive=true`);

export const fetchSupervisorLayoutSettings = (
  facilityKey: string,
  role: WorkbenchLayoutRole = "employee",
  layoutKey = "employee-home",
) =>
  apiGet<LayoutSettingsDTO>(
    `/api/portal/layout-settings?facilityKey=${encodeURIComponent(facilityKey)}&role=${encodeURIComponent(role)}&layoutKey=${encodeURIComponent(layoutKey)}`,
  );

export const saveSupervisorLayoutSettings = (input: {
  facilityKey: string;
  role: WorkbenchLayoutRole;
  layoutKey: string;
  widgets: WorkbenchWidgetLayoutItem[];
}) => apiPatch<LayoutSettingsDTO>("/api/portal/layout-settings", input);
