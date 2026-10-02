import ngeohash from "ngeohash";
import { envInt, tools } from "./functions.js";
import { redisDo } from "./redisClient.js";
import { namer } from "./namer.js";

// OpenStreetMap's Nominatim, for both reverse geocoding and place search. Its
// usage policy caps clients at ~1 request/second and asks for an identifying
// User-Agent, so callers that take user input (place search) must be rate
// limited before they get here.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = { "User-Agent": "suyoapp-api" };
// A slow geocoder shouldn't hold up saving a location or a search.
const NOMINATIM_TIMEOUT_MS = 5000;

// Results are cached so repeat lookups don't spend the shared quota. Reverse
// lookups are city-level, so nearby points share one entry: a 5-char geohash
// cell is ~5km across.
const REVERSE_CACHE_TTL = envInt("GEOCODE_REVERSE_CACHE_TTL_SECONDS", 2592000);
const SEARCH_CACHE_TTL = envInt("GEOCODE_SEARCH_CACHE_TTL_SECONDS", 604800);
const REVERSE_CACHE_PRECISION = 5;

/**
 * @param {string} key
 * @returns {Promise<any | undefined>} undefined on a miss or when Redis is down
 */
async function cacheGet(key) {
  try {
    const raw = await redisDo((client) => client.get(key));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
async function cacheSet(key, value, ttlSeconds) {
  try {
    await redisDo((client) =>
      client.set(key, JSON.stringify(value), { EX: ttlSeconds }),
    );
  } catch {
    // caching is best effort
  }
}

/** @param {string} url */
async function nominatimGet(url) {
  const res = await fetch(url, {
    headers: NOMINATIM_HEADERS,
    signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

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
  const cacheKey = `${namer.redis.geocodeReverse}${ngeohash.encode(
    latd,
    long,
    REVERSE_CACHE_PRECISION,
  )}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;
  try {
    // only the address breakdown is used (see placeMeta)
    const url = `${NOMINATIM_URL}/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${latd}&lon=${long}`;
    const json = await nominatimGet(url);
    if (json?.error) return null;
    await cacheSet(cacheKey, json, REVERSE_CACHE_TTL);
    return json;
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
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  const cacheKey = `${namer.redis.geocodeSearch}${normalized}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const url = `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&limit=8&featureType=settlement&q=${encodeURIComponent(normalized)}`;
    const json = await nominatimGet(url);
    if (!Array.isArray(json)) return [];

    const seen = new Set();
    const places = json
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
    await cacheSet(cacheKey, places, SEARCH_CACHE_TTL);
    return places;
  } catch (err) {
    tools.serverLog(`Place search failed: ${err}`, "geocoder-101");
    return null;
  }
}
