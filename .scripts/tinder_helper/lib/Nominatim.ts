// OpenStreetMap's Nominatim. Usage policy: ~1 request/second and an identifying
// User-Agent.
export class Nominatim {
  private static readonly MIN_INTERVAL_MS = 1100;
  private lastCall = 0;

  async reverse(lat: number, lng: number): Promise<any | null> {
    const json = await this.get(
      `/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`,
    );
    // points in water/unmapped areas come back as { error: "Unable to geocode" }
    return json?.error ? null : json;
  }

  async searchCountry(country: string): Promise<any | undefined> {
    const [result] = await this.get(
      `/search?format=jsonv2&featureType=country&polygon_geojson=1&polygon_threshold=0.05&addressdetails=1&limit=1&country=${encodeURIComponent(country)}`,
    );
    return result;
  }

  // Mirrors placeMeta() in api/global/geocoder.js (not imported: that module pulls
  // in the API's Stripe/Redis setup). Small places have no `city`, so fall back.
  static placeMeta(result: any) {
    const address = result?.address ?? {};
    return {
      display_name: result?.display_name ?? "unknown",
      city:
        address.city ??
        address.town ??
        address.village ??
        address.municipality ??
        address.county ??
        "unknown",
      state: address.state ?? "unknown",
      country: address.country ?? "unknown",
    };
  }

  private async get(path: string): Promise<any> {
    const wait = this.lastCall + Nominatim.MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();

    const res = await fetch(`https://nominatim.openstreetmap.org${path}`, {
      headers: { "User-Agent": "suyoapp-tinder-helper" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    return res.json();
  }
}
