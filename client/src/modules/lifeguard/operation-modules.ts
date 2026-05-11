import type { LucideIcon } from "lucide-react";
import { CalendarDays, Camera, ClipboardList, Droplets, PackageSearch, Waves } from "lucide-react";

export type LifeguardOperationModuleId =
  | "water-quality"
  | "coach-dive"
  | "cleanup"
  | "lane-issues"
  | "lost-and-found"
  | "lane-rentals";

export interface LifeguardOperationModule {
  id: LifeguardOperationModuleId;
  label: string;
  helper: string;
  purpose: string;
  href: string;
  iconKey: string;
  Icon: LucideIcon;
  apiModule: "water_quality" | "coach_dive" | "cleanup" | "lost_and_found" | "lane_issue" | "lane_rentals";
  tone: "green" | "blue" | "amber" | "violet" | "rose" | "slate";
}

export interface LifeguardOperationDrawerConfig {
  title: string;
  statusLabel: string;
  emptyText: string;
  ctaLabel: string;
}

export const lifeguardOperationModules: LifeguardOperationModule[] = [
  {
    id: "water-quality",
    label: "水質檢測",
    helper: "拍照與數值紀錄",
    purpose: "保留當班水質檢測照片、量測時間與後續水質紀錄入口。",
    href: "/lifeguard/water-quality",
    apiModule: "water_quality",
    iconKey: "droplets",
    Icon: Droplets,
    tone: "green",
  },
  {
    id: "coach-dive",
    label: "教練下水",
    helper: "下水確認留存",
    purpose: "記錄教練下水狀態與現場照片，後續會串接照片回報表單。",
    href: "/lifeguard/coach-dive",
    apiModule: "coach_dive",
    iconKey: "camera",
    Icon: Camera,
    tone: "blue",
  },
  {
    id: "cleanup",
    label: "下班打掃",
    helper: "收班前回報",
    purpose: "下班前留存清潔照片與交接備註，作為每日收班檢核。",
    href: "/lifeguard/cleanup",
    apiModule: "cleanup",
    iconKey: "clipboard-list",
    Icon: ClipboardList,
    tone: "amber",
  },
  {
    id: "lane-issues",
    label: "水道事項",
    helper: "租借與異常註記",
    purpose: "記錄水道租借、臨時調整、現場異常與需要主管追蹤的事項。",
    href: "/lifeguard/lane-issues",
    apiModule: "lane_issue",
    iconKey: "waves",
    Icon: Waves,
    tone: "violet",
  },
  {
    id: "lost-and-found",
    label: "失物招領登記",
    helper: "拾獲物件紀錄",
    purpose: "登記拾獲物品、拾獲地點、照片與後續領回狀態。",
    href: "/lifeguard/lost-and-found",
    apiModule: "lost_and_found",
    iconKey: "package-search",
    Icon: PackageSearch,
    tone: "rose",
  },
  {
    id: "lane-rentals",
    label: "水道租借狀態",
    helper: "今日場租唯讀",
    purpose: "查看今日水道租借狀態，不提供任何修改操作。",
    href: "/lifeguard/lane-rentals",
    apiModule: "lane_rentals",
    iconKey: "calendar-days",
    Icon: CalendarDays,
    tone: "slate",
  },
];

export const lifeguardOperationDrawerConfig: Record<LifeguardOperationModuleId, LifeguardOperationDrawerConfig> = {
  "water-quality": {
    title: "水質檢測",
    statusLabel: "拍照 + GPS + 浮水印",
    emptyText: "進入後會先取得 GPS，拍照時由系統疊上時間、座標與地址浮水印。",
    ctaLabel: "前往水質檢測",
  },
  "coach-dive": {
    title: "教練下水",
    statusLabel: "拍照 + 教練姓名",
    emptyText: "記錄教練下水照片、教練姓名、GPS 與拍照時間。",
    ctaLabel: "前往下水記錄",
  },
  "cleanup": {
    title: "下班打掃",
    statusLabel: "收班照片回報",
    emptyText: "記錄收班清潔照片、GPS 與拍照時間。",
    ctaLabel: "前往打掃回報",
  },
  "lane-issues": {
    title: "水道事項",
    statusLabel: "文字回報",
    emptyText: "回報水道故障、異常、維修與其他事項，主管端可彙整查看。",
    ctaLabel: "前往水道事項",
  },
  "lost-and-found": {
    title: "失物招領登記",
    statusLabel: "待接失物登記流程",
    emptyText: "目前先保留失物招領入口；下一輪會接物品照片、位置與領回狀態。",
    ctaLabel: "前往失物登記",
  },
  "lane-rentals": {
    title: "水道租借狀態",
    statusLabel: "唯讀排程",
    emptyText: "查看今日水道租借狀態，不會新增、修改或刪除任何租借。",
    ctaLabel: "查看水道租借",
  },
};

export const getLifeguardOperationModule = (id: LifeguardOperationModuleId) =>
  lifeguardOperationModules.find((module) => module.id === id)!;
