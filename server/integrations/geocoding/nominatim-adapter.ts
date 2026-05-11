export interface ReverseGeocodeResult {
  address: string;
  city: string;
  district: string;
  raw: unknown;
}

export interface GeocodingProvider {
  reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null>;
}

let nextAllowedAt = 0;

const waitForRateLimit = async () => {
  const now = Date.now();
  if (now < nextAllowedAt) {
    await new Promise((resolve) => setTimeout(resolve, nextAllowedAt - now));
  }
  nextAllowedAt = Date.now() + 1000;
};

export const createNominatimGeocodingProvider = (): GeocodingProvider => ({
  async reverseGeocode(lat, lng) {
    try {
      await waitForRateLimit();
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "json");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("accept-language", "zh-TW");

      const res = await fetch(url, {
        headers: { "User-Agent": "Junsz-CMS/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const raw = await res.json() as {
        display_name?: string;
        address?: {
          city?: string;
          county?: string;
          state?: string;
          suburb?: string;
          city_district?: string;
          town?: string;
          village?: string;
        };
      };
      const address = raw.address ?? {};
      return {
        address: raw.display_name ?? "地址解析中",
        city: address.city ?? address.county ?? address.state ?? "",
        district: address.city_district ?? address.suburb ?? address.town ?? address.village ?? "",
        raw,
      };
    } catch {
      return null;
    }
  },
});
