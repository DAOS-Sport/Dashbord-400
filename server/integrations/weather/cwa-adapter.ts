import type { WeatherSummary } from "@shared/domain/workbench";

const CWA_API_KEY = process.env.CWA_API_KEY ?? "";

const STATION_ID = process.env.CWA_STATION_ID ?? "466920";

interface CachedWeather {
  data: WeatherSummary;
  fetchedAt: number;
}
let _cache: CachedWeather | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

function mapWeatherLabel(raw: string): string {
  if (!raw || raw === "-99" || raw === "N/A") return "天氣資料無法取得";
  return raw;
}

export const isCwaEnabled = () => Boolean(CWA_API_KEY);

export async function fetchCwaWeather(): Promise<WeatherSummary | null> {
  if (!CWA_API_KEY) return null;

  const now = Date.now();
  if (_cache && now - _cache.fetchedAt < CACHE_TTL_MS) return _cache.data;

  try {
    const url = new URL(
      "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001"
    );
    url.searchParams.set("Authorization", CWA_API_KEY);
    url.searchParams.set("StationId", STATION_ID);
    url.searchParams.set("format", "JSON");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[cwa] HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const stations: any[] =
      json?.records?.Station ?? json?.records?.Location ?? [];
    const station = stations.find((s: any) => s.StationId === STATION_ID) ?? stations[0];
    if (!station) return null;

    const el = station.WeatherElement ?? station.weatherElement ?? {};
    const tempRaw = el.AirTemperature ?? el.airTemperature;
    const humRaw = el.RelativeHumidity ?? el.relativeHumidity;
    const wxRaw = el.Weather ?? el.weather ?? station.Weather ?? "";

    const temperatureC = parseFloat(tempRaw);
    const humidity = parseFloat(humRaw);
    if (Number.isNaN(temperatureC) || Number.isNaN(humidity)) return null;

    const data: WeatherSummary = {
      temperatureC: Math.round(temperatureC * 10) / 10,
      label: mapWeatherLabel(String(wxRaw)),
      humidity: Math.round(humidity),
    };

    _cache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    console.warn("[cwa] fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
