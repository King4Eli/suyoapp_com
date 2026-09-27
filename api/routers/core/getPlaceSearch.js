import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";
import { searchPlaces } from "../../global/geocoder.js";
import { checkRateLimit } from "../../global/rateLimit.js";
import { namer } from "../../global/namer.js";

// Shared by place search and adding a location (both call the geocoder). Nominatim
// allows ~1 request/second for the whole app, so keep each user well under that.
export const PLACES_PER_WINDOW = 30;
export const PLACES_WINDOW_SECONDS = 60;

/**
 * City search for picking a travel-mode location. VIP-only, since only VIP can
 * add one -- no reason to spend the shared geocoder quota on anyone else.
 * @param {unknown} query
 */
export default async function getPlaceSearch(query) {
  /** @type {any} */
  const response = {
    code: 400,
    message: "Error searching places.",
    places: [],
  };

  try {
    const q = typeof query === "string" ? query.trim() : "";
    if (q.length < 2 || q.length > 100) {
      response.message = "Type at least 2 characters.";
      return response;
    }

    const userId = sessions.currentUserID;
    if (!(await hasFeature(userId, "travelMode"))) {
      response.code = 403;
      response.message = "Travel mode is a VIP feature.";
      return response;
    }

    const limit = await checkRateLimit(
      `${namer.ratelimit.places_geocode}${userId}`,
      PLACES_PER_WINDOW,
      PLACES_WINDOW_SECONDS,
    );
    if (!limit.allowed) {
      response.code = 429;
      response.message = "Too many searches. Try again in a moment.";
      response.retryAfterSeconds = limit.retryAfterSeconds;
      return response;
    }

    const places = await searchPlaces(q);
    if (places === null) {
      response.code = 502;
      response.message = "Place search is unavailable right now.";
      return response;
    }

    response.code = 200;
    response.message = "ok";
    response.places = places;
  } catch (err) {
    tools.serverLog(`Error in getPlaceSearch: ${err}`, "getPlaceSearch-0");
    response.code = 500;
    response.message = "Error searching places.";
  }

  return response;
}
