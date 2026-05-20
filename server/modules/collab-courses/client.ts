import { env } from "../../shared/config/env";

const SWIM_SCHEDULER_BASE_URL =
  process.env.SWIM_SCHEDULER_BASE_URL || "https://swim-scheduler-ronchen2.replit.app";

const TIMEOUT_MS = env.externalApiTimeoutMs;

const fetchJson = async <T>(path: string, params?: Record<string, string>): Promise<T | null> => {
  const url = new URL(path, SWIM_SCHEDULER_BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export interface SwimVenue {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface SwimTimeSlot {
  id: string;
  period: string;
  startTime: string;
  endTime: string;
  order: number;
}

export interface SwimScheduleItem {
  id: string;
  date: string;
  venueId: string;
  timeSlotId: string;
  className: string;
  coachName: string | null;
  coachName2: string | null;
  coachCount: number;
  isClassLocked: boolean;
  notes: string | null;
  venue: SwimVenue;
  timeSlot: SwimTimeSlot;
}

let venueCache: { data: SwimVenue[]; ts: number } | null = null;
const VENUE_CACHE_TTL = 5 * 60 * 1000;

export const fetchSwimVenues = async (): Promise<SwimVenue[]> => {
  if (venueCache && Date.now() - venueCache.ts < VENUE_CACHE_TTL) return venueCache.data;
  const data = await fetchJson<SwimVenue[]>("/api/venues");
  const venues = (data ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  venueCache = { data: venues, ts: Date.now() };
  return venues;
};

export const fetchSwimSchedules = async (
  startDate: string,
  endDate: string,
): Promise<SwimScheduleItem[]> => {
  const data = await fetchJson<SwimScheduleItem[]>("/api/schedules", { startDate, endDate });
  return data ?? [];
};
