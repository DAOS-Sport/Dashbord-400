const SWIM_SCHEDULER_BASE_URL =
  process.env.SWIM_SCHEDULER_BASE_URL ?? "https://swim-scheduler-ronchen2.replit.app";

export interface SwimVenue {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
}

export interface SwimTimeSlot {
  period: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface SwimScheduleEntry {
  id: string;
  date: string;
  venue: SwimVenue;
  timeSlot: SwimTimeSlot;
  className: string;
  coachName: string;
  coachName2?: string;
  status?: string;
  note?: string;
}

let _venueCache: { data: SwimVenue[]; fetchedAt: number } | null = null;
const VENUE_TTL_MS = 5 * 60 * 1000;

export async function fetchVenues(): Promise<SwimVenue[]> {
  const now = Date.now();
  if (_venueCache && now - _venueCache.fetchedAt < VENUE_TTL_MS) {
    return _venueCache.data;
  }
  const res = await fetch(`${SWIM_SCHEDULER_BASE_URL}/api/venues`);
  if (!res.ok) throw new Error(`swim-scheduler /api/venues ${res.status}`);
  const data = (await res.json()) as SwimVenue[];
  _venueCache = { data, fetchedAt: now };
  return data;
}

export async function fetchSchedules(
  startDate: string,
  endDate: string,
  venueId?: string,
): Promise<SwimScheduleEntry[]> {
  const params = new URLSearchParams({ startDate, endDate });
  if (venueId) params.set("venueId", venueId);
  const res = await fetch(`${SWIM_SCHEDULER_BASE_URL}/api/schedules?${params}`);
  if (!res.ok) throw new Error(`swim-scheduler /api/schedules ${res.status}`);
  return res.json() as Promise<SwimScheduleEntry[]>;
}
