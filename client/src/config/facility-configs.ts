import type { FacilityConfig } from "@/types/portal";

export const facilityConfigs: Record<string, FacilityConfig> = {
  xinbei_pool: {
    facilityKey: "xinbei_pool",
    facilityLineGroupId: "C66a4b3bb3fbc3dcf52d42626ec512484",
    facilityName: "新北高中游泳池&運動中心",
    shortName: "新北",
    area: "新北",
    portalPath: "/portal/xinbei_pool",
    isActive: true,
    sections: {
      mustRead: true,
      groupAnnouncements: true,
      campaigns: true,
      handover: true,
      onDutyStaff: true,
      contacts: true,
      rental: true,
    },
    contactPoints: [
      { type: "general", label: "櫃台窗口", name: "櫃台" },
      { type: "course", label: "課程窗口", name: "課程負責人" },
      { type: "supervisor", label: "主管窗口", name: "館主管" },
      { type: "maintenance", label: "維修窗口", name: "設備負責人" },
      { type: "rental", label: "場租窗口", name: "場租負責人" },
    ],
  },
  salu_counter: {
    facilityKey: "salu_counter",
    facilityLineGroupId: "Cc2100498c7c5627c1e86e93f7c4eb817",
    facilityName: "三重商工 / 三蘆區櫃台",
    shortName: "商工",
    portalPath: "/portal/salu_counter",
    isActive: true,
    sections: {
      mustRead: true,
      groupAnnouncements: true,
      campaigns: true,
      handover: true,
      onDutyStaff: true,
      contacts: true,
      rental: false,
    },
    contactPoints: [
      { type: "general", label: "櫃台窗口", name: "櫃台" },
      { type: "supervisor", label: "主管窗口", name: "館主管" },
    ],
  },
  songshan_pool: {
    facilityKey: "songshan_pool",
    facilityLineGroupId: "C9b3c5dfe2e005adafd2ed914714a1930",
    facilityName: "松山國小室內溫水游泳池",
    shortName: "松山",
    portalPath: "/portal/songshan_pool",
    isActive: true,
    sections: {
      mustRead: true,
      groupAnnouncements: true,
      campaigns: true,
      handover: true,
      onDutyStaff: true,
      contacts: true,
      rental: false,
    },
    contactPoints: [
      { type: "general", label: "櫃台窗口", name: "櫃台" },
      { type: "supervisor", label: "主管窗口", name: "館主管" },
    ],
  },
  sanmin_pool: {
    facilityKey: "sanmin_pool",
    facilityLineGroupId: "C2dc6991e51074dd47d5d275d568318f7",
    facilityName: "三民高中游泳池",
    shortName: "三民",
    portalPath: "/portal/sanmin_pool",
    isActive: true,
    sections: {
      mustRead: true,
      groupAnnouncements: true,
      campaigns: true,
      handover: true,
      onDutyStaff: true,
      contacts: true,
      rental: false,
    },
    contactPoints: [
      { type: "general", label: "櫃台窗口", name: "櫃台" },
      { type: "supervisor", label: "主管窗口", name: "館主管" },
    ],
  },
};

export function getFacilityConfig(key: string): FacilityConfig | null {
  return facilityConfigs[key] ?? null;
}

export function getAllActiveFacilities(): FacilityConfig[] {
  return Object.values(facilityConfigs).filter((f) => f.isActive);
}
