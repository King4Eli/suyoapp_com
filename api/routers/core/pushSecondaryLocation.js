import { count, eq } from "drizzle-orm";
import ngeohash from "ngeohash";
import { db } from "../../db/client.js";
import { users, usersLocations } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";
import { placeMeta, reverseGeocode } from "../../global/geocoder.js";
import { MAX_SECONDARY_LOCATIONS } from "../../global/travelMode.js";
import { checkRateLimit } from "../../global/rateLimit.js";
import { namer } from "../../global/namer.js";
import { PLACES_PER_WINDOW, PLACES_WINDOW_SECONDS } from "./getPlaceSearch.js";

/**
 * Add a travel-mode location (VIP, at most MAX_SECONDARY_LOCATIONS). The client
 * sends coordinates from a place search result; the place's name is looked up
 * here rather than taken from the client.
 * @param {{ latd?: unknown; long?: unknown }} data
 */
export default async function pushSecondaryLocation(data) {
  /** @type {any} */
  const response = { code: 400, message: "Error adding location." };

  try {
    const userId = sessions.currentUserID;
    const latd = Number(data?.latd);
    const long = Number(data?.long);
    if (
      !Number.isFinite(latd) ||
      !Number.isFinite(long) ||
      Math.abs(latd) > 90 ||
      Math.abs(long) > 180
    ) {
      response.message = "Invalid coordinates.";
      return response;
    }

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
      response.message = "Too many requests. Try again in a moment.";
      response.retryAfterSeconds = limit.retryAfterSeconds;
      return response;
    }

    const place = await reverseGeocode(latd, long);
    if (!place) {
      response.code = 502;
      response.message = "Couldn't look up that place. Try again.";
      return response;
    }
    const meta = placeMeta(place);

    const inserted = await db.transaction(async (tx) => {
      // lock the user's row so two concurrent adds can't both pass the cap check
      await tx
        .select({ id: users.userId })
        .from(users)
        .where(eq(users.userId, userId))
        .for("update");
      const [{ total }] = await tx
        .select({ total: count() })
        .from(usersLocations)
        .where(eq(usersLocations.userId, userId));
      if (total >= MAX_SECONDARY_LOCATIONS) return null;

      const [result] = await tx.insert(usersLocations).values({
        userId,
        geoMeta: meta,
        geoHash: ngeohash.encode(latd, long, 12),
        geoLatd: latd,
        geoLong: long,
      });
      return result.insertId;
    });

    if (inserted == null) {
      response.message = `You can add up to ${MAX_SECONDARY_LOCATIONS} travel locations.`;
      return response;
    }

    response.code = 200;
    response.message = "ok";
    response.location = { id: inserted, ...meta };
  } catch (err) {
    tools.serverLog(
      `Error in pushSecondaryLocation: ${err}`,
      "pushSecondaryLocation-0",
    );
    response.code = 500;
    response.message = "Error adding location.";
  }

  return response;
}
