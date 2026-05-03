import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import {
  parseCourtFromText,
  parseSchoolFromText,
  isValidCourtForSchool,
  type SchoolId,
} from "@shared/court-config";
import { courtsStorage } from "./storage";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN,
  CALENDAR_ID = "primary",
} = process.env;

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
);

if (GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
}

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

export const isGoogleCalendarEnabled = () => !!GOOGLE_REFRESH_TOKEN;

async function recordUnknownCourt(
  school: SchoolId,
  event: any,
  summary: string,
  location: string,
  description: string,
) {
  try {
    await courtsStorage.recordSyncError({
      school,
      source: "google_calendar",
      eventId: event?.id ?? null,
      summary: summary.substring(0, 500),
      location: location.substring(0, 500),
      description: description.substring(0, 1000),
      reason: "unknown_court",
      payload: event ?? null,
    });
  } catch (e) {
    console.warn("[courts] Failed to record sync_error:", e);
  }
}

function extractPhone(description: string): string {
  const m = description.match(/(?:電話|手機|聯絡|phone)[:：]?\s*([0-9\-\s]+)/i);
  return m ? m[1].replace(/\s/g, "") : "";
}

function extractCustomerName(title: string, description: string): string {
  const titleMatch = title.match(/^([^|]+)/);
  if (titleMatch) return titleMatch[1].trim();
  const descMatch = description.match(/顧客[:：]\s*([^\n]+)/);
  if (descMatch) return descMatch[1].trim();
  return title;
}

function extractBookingNumber(title: string, description: string) {
  const titleMatch = title.match(/#(\d+)/);
  if (titleMatch) return titleMatch[1];
  const descMatch = description.match(/預訂編號[:：]\s*(\d+)/);
  if (descMatch) return descMatch[1];
  return null;
}

function extractServiceName(title: string, description: string) {
  const titleMatch = title.match(/\|\s*([^|]+)$/);
  if (titleMatch) return titleMatch[1].trim();
  const descMatch = description.match(/項目[:：]\s*([^\n]+)/);
  if (descMatch) return descMatch[1].trim();
  return null;
}

async function eventToReservation(
  event: any,
  school: SchoolId,
  dateOverride?: string,
) {
  const title = event.summary || "";
  const start = event.start?.dateTime
    ? new Date(event.start.dateTime)
    : new Date(event.start?.date + "T00:00:00");
  const end = event.end?.dateTime
    ? new Date(event.end.dateTime)
    : new Date(event.end?.date + "T23:59:59");
  const location = event.location || "";
  const description = event.description || "";

  let actualStartTime = "";
  let actualEndTime = "";

  const timeMatch = description.match(
    /開始時間[:：]\s*\d{4}-\d{2}-\d{2},\s*(\d{1,2}):(\d{2}):(\d{2})/,
  );
  const durationHourMatch = description.match(/總時間長度[:：]\s*(\d+)\s*小時/);
  const durationMinuteMatch = description.match(/總時間長度[:：]\s*(\d+)\s*分/);

  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    actualStartTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    let durationHours = 1;
    if (durationHourMatch) durationHours = parseInt(durationHourMatch[1], 10);
    else if (durationMinuteMatch) {
      const minutes = parseInt(durationMinuteMatch[1], 10);
      durationHours = Math.ceil(minutes / 60);
    }
    const endHour = hour + durationHours;
    actualEndTime = `${String(Math.min(endHour, 22)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  } else {
    const startHour = start.getHours();
    const endHour = end.getHours();
    actualStartTime = `${String(startHour).padStart(2, "0")}:00`;
    actualEndTime = `${String(Math.min(endHour, 22)).padStart(2, "0")}:00`;
  }

  const startHour = parseInt(actualStartTime.split(":")[0], 10);
  if (startHour < 6 || startHour >= 22) return null;

  const court = parseCourtFromText(school, title, location, description);
  if (!isValidCourtForSchool(school, court)) {
    await recordUnknownCourt(school, event, title, location, description);
    return null;
  }

  const eventDate =
    dateOverride ||
    `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  return {
    id: event.id || `google-${Date.now()}`,
    school,
    date: eventDate,
    court,
    startTime: actualStartTime,
    endTime: actualEndTime,
    customerName: extractCustomerName(title, description),
    phone: extractPhone(description),
    notes: description || location,
    status: "confirmed" as const,
    createdAt: new Date(),
    bookingNumber: extractBookingNumber(title, description),
    serviceName: extractServiceName(title, description),
    rawTitle: title,
    rawDescription: description,
    source: "google" as const,
  };
}

async function fetchAndConvert(
  school: SchoolId,
  scope: "day" | "range",
  startDate: string,
  endDate: string,
  dateOverride?: string,
) {
  if (!isGoogleCalendarEnabled()) return [];
  const t0 = Date.now();
  let mySchoolEvents = 0;
  let reservationCount = 0;
  try {
    const startIso = new Date(`${startDate}T00:00:00`);
    const endIso = new Date(`${endDate}T23:59:59`);
    const eventsResp = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startIso.toISOString(),
      timeMax: endIso.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    const events = eventsResp.data.items || [];
    const out: any[] = [];
    for (const event of events) {
      const title = event.summary || "";
      const location = event.location || "";
      const description = event.description || "";
      const eventSchool = parseSchoolFromText(title, location, description);
      if (eventSchool !== school) continue;
      mySchoolEvents++;
      const r = await eventToReservation(event, school, dateOverride);
      if (r) out.push(r);
    }
    reservationCount = out.length;
    courtsStorage
      .recordSyncLog({
        school,
        source: "google_calendar",
        scope,
        startDate,
        endDate,
        eventCount: mySchoolEvents,
        reservationCount,
        skippedCount: mySchoolEvents - reservationCount,
        durationMs: Date.now() - t0,
        status: "ok",
      })
      .catch((e) => console.warn("[courts] Failed to record sync_log:", e));
    return out;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[courts] Google Calendar (${school}/${scope}) error:`, error);
    courtsStorage
      .recordSyncLog({
        school,
        source: "google_calendar",
        scope,
        startDate,
        endDate,
        eventCount: mySchoolEvents,
        reservationCount,
        skippedCount: 0,
        durationMs: Date.now() - t0,
        status: "error",
        errorMessage: message.substring(0, 500),
      })
      .catch((e) => console.warn("[courts] Failed to record sync_log:", e));
    throw error;
  }
}

export async function getCalendarReservations(school: SchoolId, date: string) {
  return fetchAndConvert(school, "day", date, date, date);
}

export async function getCalendarReservationsRange(
  school: SchoolId,
  startDate: string,
  endDate: string,
) {
  return fetchAndConvert(school, "range", startDate, endDate);
}
