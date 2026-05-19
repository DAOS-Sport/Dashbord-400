export type TopologyNodeType = "module" | "infra" | "external" | "group";

export interface TopologyNode {
  id: string;
  label: string;
  type: TopologyNodeType;
  group?: string;
  description?: string;
  route?: string;
  status?: "active" | "partial" | "planned";
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

export const TOPOLOGY_NODES: TopologyNode[] = [
  { id: "postgres", label: "PostgreSQL", type: "infra", group: "infra", description: "Neon serverless DB" },
  { id: "google-calendar", label: "Google Calendar", type: "external", group: "infra", description: "Court sync via googleapis" },
  { id: "line-bot", label: "LINE Bot API", type: "external", group: "infra", description: "line-bot-assistant proxy" },
  { id: "ragic", label: "Ragic API", type: "external", group: "infra", description: "Employee HR data source" },
  { id: "object-storage", label: "Object Storage", type: "infra", group: "infra", description: "Replit object storage bucket" },

  { id: "courts-xinbei", label: "新北高中\n場地預約", type: "module", group: "courts", description: "14 courts — calendar/week/month/search/admin", route: "/supervisor/courts/xinbei", status: "active" },
  { id: "courts-sanchong", label: "三重商工\n場地預約", type: "module", group: "courts", description: "3 courts — calendar/week/month/search/admin", route: "/supervisor/courts/sanchong", status: "active" },

  { id: "parking", label: "停車場管理", type: "module", group: "admin", description: "Contracts + e-signing + object storage photos", route: "/supervisor/parking", status: "active" },
  { id: "lane-rentals", label: "水道租借", type: "module", group: "admin", description: "松山國小 5 lanes — advisory lock booking", route: "/admin/lane-rentals", status: "active" },
  { id: "anomaly", label: "異常報告", type: "module", group: "admin", description: "Receive / notify / batch-resolve", route: "/system/watchdog", status: "active" },
  { id: "line-whitelist", label: "LINE 白名單", type: "module", group: "admin", description: "Feature flags + Ragic CRUD + VIP sync", route: "/system/line-whitelist", status: "active" },

  { id: "employee-home", label: "員工首頁", type: "module", group: "employee", description: "Announcements + courts + work-logs aggregator", route: "/employee", status: "active" },
  { id: "work-logs", label: "日誌模組", type: "module", group: "employee", description: "救生員 & 櫃台 daily/assigned/recurring/water-quality", route: "/admin/work-logs", status: "active" },
  { id: "announcement-groups", label: "公告群組", type: "module", group: "announcements", description: "LINE group binding + overlay (pin/hide/note)", route: "/supervisor/announcement-groups", status: "active" },
  { id: "announcement-classifier", label: "公告分類器", type: "module", group: "announcements", description: "AI candidate review + approve/reject workflow", route: "/announcements", status: "active" },
  { id: "group-broadcasts", label: "群組重要公告", type: "module", group: "announcements", description: "主管廣播 + 三蘆區 fan-out + Gemini 活動偵測", route: "/supervisor/group-broadcasts", status: "active" },
];

export const TOPOLOGY_EDGES: TopologyEdge[] = [
  { id: "courts-xinbei-db", source: "courts-xinbei", target: "postgres", label: "read/write" },
  { id: "courts-sanchong-db", source: "courts-sanchong", target: "postgres", label: "read/write" },
  { id: "courts-xinbei-cal", source: "courts-xinbei", target: "google-calendar", label: "sync", dashed: true },
  { id: "courts-sanchong-cal", source: "courts-sanchong", target: "google-calendar", label: "sync", dashed: true },

  { id: "parking-db", source: "parking", target: "postgres", label: "read/write" },
  { id: "parking-storage", source: "parking", target: "object-storage", label: "photos" },
  { id: "lane-rentals-db", source: "lane-rentals", target: "postgres", label: "advisory lock" },
  { id: "anomaly-db", source: "anomaly", target: "postgres", label: "read/write" },
  { id: "line-whitelist-db", source: "line-whitelist", target: "postgres", label: "feature flags" },
  { id: "line-whitelist-ragic", source: "line-whitelist", target: "ragic", label: "candidates", dashed: true },
  { id: "line-whitelist-bot", source: "line-whitelist", target: "line-bot", label: "VIP push", dashed: true },

  { id: "employee-home-db", source: "employee-home", target: "postgres", label: "read" },
  { id: "employee-home-courts", source: "employee-home", target: "courts-xinbei", label: "preview" },
  { id: "work-logs-db", source: "work-logs", target: "postgres", label: "read/write" },
  { id: "announcement-groups-bot", source: "announcement-groups", target: "line-bot", label: "messages" },
  { id: "announcement-groups-db", source: "announcement-groups", target: "postgres", label: "bindings" },
  { id: "announcement-classifier-bot", source: "announcement-classifier", target: "line-bot", label: "candidates" },
  { id: "group-broadcasts-db", source: "group-broadcasts", target: "postgres", label: "read/write" },
  { id: "group-broadcasts-candidates", source: "group-broadcasts", target: "announcement-classifier", label: "event upsert", dashed: true },
];

export const TOPOLOGY_GROUP_LABELS: Record<string, string> = {
  infra: "インフラ / 外部サービス",
  courts: "場地預約",
  admin: "管理・主管モジュール",
  employee: "員工工作台",
  announcements: "公告系統",
};
