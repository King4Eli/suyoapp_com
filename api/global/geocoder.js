import { tools } from "./functions.js";

// OpenStreetMap's Nominatim -- same service pushLocation.js reverse-geocodes with.
// Its usage policy caps clients at ~1 request/second, so callers that take user
// input (place search) must be rate limited before they get here.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = { "User-Agent": "MyApp" };

/**
 * City-level fields for display, from a Nominatim result's `address`. Small places
 * have no `city`, so fall back through town/village/etc.
 * @param {any} result
 */
export function placeMeta(result) {
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

/**
 * @param {number} latd
 * @param {number} long
 * @returns {Promise<any | null>} the raw Nominatim result, or null on failure
 */
export async function reverseGeocode(latd, long) {
  try {
    const url = `${NOMINATIM_URL}/reverse?format=jsonv2&zoom=10&lat=${latd}&lon=${long}`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    const json = await res.json();
    return json?.error ? null : json;
  } catch (err) {
    tools.serverLog(`Reverse geocode failed: ${err}`, "geocoder-100");
    return null;
  }
}

/**
 * Cities/towns matching `query`, for picking a travel-mode location.
 * @param {string} query
 * @returns {Promise<Array<{ latd: number; long: number } & ReturnType<typeof placeMeta>> | null>}
 *   null when the geocoder is unreachable (vs. [] for "no matches")
 */
export async function searchPlaces(query) {
  try {
    const url = `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&limit=8&featureType=settlement&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    const json = await res.json();
    if (!Array.isArray(json)) return [];

    const seen = new Set();
    return json
      .map((r) => ({
        ...placeMeta(r),
        latd: Number(r.lat),
        long: Number(r.lon),
      }))
      .filter((p) => {
        if (!Number.isFinite(p.latd) || !Number.isFinite(p.long)) return false;
        // the same city often comes back as several OSM objects (boundary, node, ...)
        const key = `${p.city}|${p.state}|${p.country}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch (err) {
    tools.serverLog(`Place search failed: ${err}`, "geocoder-101");
    return null;
  }
}
