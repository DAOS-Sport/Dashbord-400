// 多校場地設定（前後端共用，唯一真相）— ported from standalone 場地預約系統
// 任何新增/修改場地，都只需要改這個檔案。

import type { CourtSchoolId } from "./schema";

export type SchoolId = CourtSchoolId;

export interface SchoolInfo {
  id: SchoolId;
  name: string;
  shortName: string;
}

export const SCHOOLS: SchoolInfo[] = [
  { id: "xinbei", name: "新北高中場地預約系統", shortName: "新北高中" },
  { id: "sanchong", name: "三重商工場地預約系統", shortName: "三重商工" },
];

export const SCHOOL_IDS = SCHOOLS.map((s) => s.id) as SchoolId[];
export const DEFAULT_SCHOOL: SchoolId = "xinbei";

export const isValidSchool = (s: string | undefined | null): s is SchoolId =>
  !!s && (SCHOOL_IDS as readonly string[]).includes(s);

export const getSchool = (id: SchoolId): SchoolInfo | undefined =>
  SCHOOLS.find((s) => s.id === id);

export const getSchoolName = (id: SchoolId): string =>
  getSchool(id)?.shortName ?? id;

export type CourtType =
  | "badminton"
  | "baseball"
  | "gym"
  | "baseball2f"
  | "basketball"
  | "dance"
  | "oxygen"
  | "other";

export interface CourtInfo {
  id: number;
  school: SchoolId;
  name: string;
  type: CourtType;
}

const XINBEI_COURTS: CourtInfo[] = [
  { id: 1, school: "xinbei", name: "羽球場1", type: "badminton" },
  { id: 2, school: "xinbei", name: "羽球場2", type: "badminton" },
  { id: 3, school: "xinbei", name: "羽球場3", type: "badminton" },
  { id: 4, school: "xinbei", name: "羽球場4", type: "badminton" },
  { id: 5, school: "xinbei", name: "羽球場5", type: "badminton" },
  { id: 6, school: "xinbei", name: "羽球場6", type: "badminton" },
  { id: 7, school: "xinbei", name: "羽球場7", type: "badminton" },
  { id: 8, school: "xinbei", name: "B1棒球練習場", type: "baseball" },
  { id: 9, school: "xinbei", name: "重量訓練室", type: "gym" },
  { id: 10, school: "xinbei", name: "2F棒球場", type: "baseball2f" },
  { id: 11, school: "xinbei", name: "新北高中四樓籃球場", type: "basketball" },
  { id: 12, school: "xinbei", name: "B1大舞蹈教室", type: "dance" },
  { id: 13, school: "xinbei", name: "B1高壓氧恢復室1", type: "oxygen" },
  { id: 14, school: "xinbei", name: "B1高壓氧恢復室2", type: "oxygen" },
];

const SANCHONG_COURTS: CourtInfo[] = [
  { id: 101, school: "sanchong", name: "活動中心籃球場", type: "basketball" },
  { id: 102, school: "sanchong", name: "二樓籃球場", type: "basketball" },
  { id: 103, school: "sanchong", name: "四樓籃球場", type: "basketball" },
];

export const COURTS: CourtInfo[] = [...XINBEI_COURTS, ...SANCHONG_COURTS];

const COURT_MAP = new Map<number, CourtInfo>(COURTS.map((c) => [c.id, c]));

export const COURT_COUNT = COURTS.length;
export const MIN_COURT_ID = 1;
export const MAX_COURT_ID = COURTS.reduce((max, c) => Math.max(max, c.id), 0);

export const getCourt = (id: number): CourtInfo | undefined =>
  COURT_MAP.get(id);

export const getCourtName = (id: number): string =>
  COURT_MAP.get(id)?.name ?? `未知場地 ${id}`;

export const getCourtType = (id: number): CourtType | undefined =>
  COURT_MAP.get(id)?.type;

export const getCourtSchool = (id: number): SchoolId | undefined =>
  COURT_MAP.get(id)?.school;

export const isValidCourtId = (id: number): boolean => COURT_MAP.has(id);

export const isValidCourtForSchool = (school: SchoolId, id: number): boolean => {
  const c = COURT_MAP.get(id);
  return !!c && c.school === school;
};

export const getCourtsBySchool = (school: SchoolId): CourtInfo[] =>
  COURTS.filter((c) => c.school === school);

export interface CourtCategory {
  value: string;
  label: string;
  courts: number[];
}

const XINBEI_CATEGORIES: CourtCategory[] = [
  { value: "all", label: "全部場地", courts: XINBEI_COURTS.map((c) => c.id) },
  { value: "badminton", label: "全部羽球場", courts: [1, 2, 3, 4, 5, 6, 7] },
  { value: "baseball", label: "全部棒球場", courts: [8, 10] },
  { value: "gym", label: "重量訓練室", courts: [9] },
  { value: "basketball", label: "籃球場", courts: [11] },
  { value: "dance", label: "舞蹈教室", courts: [12] },
  { value: "oxygen", label: "高壓氧恢復室", courts: [13, 14] },
];

const SANCHONG_CATEGORIES: CourtCategory[] = [
  { value: "all", label: "全部場地", courts: SANCHONG_COURTS.map((c) => c.id) },
  { value: "basketball", label: "全部籃球場", courts: [101, 102, 103] },
];

export const getCourtCategories = (school: SchoolId): CourtCategory[] =>
  school === "sanchong" ? SANCHONG_CATEGORIES : XINBEI_CATEGORIES;

export const getCourtsByFilter = (
  school: SchoolId,
  filter: string,
): number[] => {
  if (filter.startsWith("court-")) {
    const id = parseInt(filter.replace("court-", ""), 10);
    return [id];
  }
  const cats = getCourtCategories(school);
  const cat = cats.find((c) => c.value === filter);
  return cat ? cat.courts : cats[0].courts;
};

export function parseSchoolFromText(
  summary = "",
  location = "",
  description = "",
): SchoolId {
  const text = `${summary} ${location} ${description}`;
  if (/三重商工|三商/i.test(text)) return "sanchong";
  return "xinbei";
}

function parseXinbeiCourt(text: string): number {
  if (text.match(/B1\s*棒球\s*練習場/i)) return 8;
  if (text.match(/重量\s*訓練室/i)) return 9;
  if (text.match(/2F\s*棒球/i)) return 10;
  if (text.match(/(?:新北高中)?\s*(?:四樓|4樓|4F)\s*籃球場/i)) return 11;
  if (text.match(/(?:B1\s*)?大舞蹈教室/i)) return 12;
  if (text.match(/(?:B1\s*)?高壓氧恢復室\s*1/i)) return 13;
  if (text.match(/(?:B1\s*)?高壓氧恢復室\s*2/i)) return 14;

  const providerMatch = text.match(
    /服務提供者[:：]?\s*0?([1-7])\.\s*新北羽球場/i,
  );
  if (providerMatch) return parseInt(providerMatch[1], 10);

  const providerMatch2 = text.match(/服務提供者[:：]?\s*0?([1-7])\./i);
  if (providerMatch2) return parseInt(providerMatch2[1], 10);

  const courtMatch = text.match(/(?:新北羽球場)?-?([1-7])號球場/i);
  if (courtMatch) return parseInt(courtMatch[1], 10);

  const m1 = text.match(/([A-G])\s*場/i);
  if (m1) {
    const idx = "ABCDEFG".indexOf(m1[1].toUpperCase());
    if (idx >= 0) return idx + 1;
  }

  const m2 = text.match(/(?:場地|號場)?\s*([1-7])(?!\d)/);
  if (m2) return parseInt(m2[1], 10);

  const m3 = text.match(/Court\s*([A-G])/i);
  if (m3) {
    const idx = "ABCDEFG".indexOf(m3[1].toUpperCase());
    if (idx >= 0) return idx + 1;
  }

  return -1;
}

function parseSanchongCourt(text: string): number {
  if (/活動中心\s*籃球場?/i.test(text)) return 101;
  if (/(?:二樓|2\s*樓|2F)\s*籃球場?/i.test(text)) return 102;
  if (/(?:四樓|4\s*樓|4F)\s*籃球場?/i.test(text)) return 103;
  return -1;
}

export function parseCourtFromText(
  school: SchoolId,
  summary = "",
  location = "",
  description = "",
): number {
  const text = `${summary} ${location} ${description}`;
  if (school === "sanchong") return parseSanchongCourt(text);
  return parseXinbeiCourt(text);
}
