import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import ngeohash from "ngeohash";

function normalizeLocation(value = {}) {
  const location = typeof value === "string" ? JSON.parse(value) : value;
  const latd = Number(location?.latd ?? location?.lat ?? location?.latitude);
  const long = Number(location?.long ?? location?.lng ?? location?.longitude);

  if (!Number.isFinite(latd) || !Number.isFinite(long)) {
    return null;
  }

  return {
    ...location,
    latd,
    long,
    geo_hash: ngeohash.encode(latd, long, 12),
  };
}

/**
 * @param {string} longlatd
 */
export default async function pushLocation(
  longlatd,
  userId = sessions.currentUserID,
) {
  const response = {
    code: 400,
    message: "Error updating location.",
    data: null,
  };
  try {
    if (!longlatd) {
      response.message = "Invalid coordinates.";
      return response;
    }
    const jsonDecodeLocation = normalizeLocation(longlatd);
    if (!jsonDecodeLocation) {
      response.message = "Invalid coordinates.";
      return response;
    }

    /** @type {any} */
    let specsDecode = {};
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${jsonDecodeLocation.latd}&lon=${jsonDecodeLocation.long}`;
      const apiRes = await fetch(url, { headers: { "User-Agent": "MyApp" } });
      specsDecode = await apiRes.json();
    } catch (err) {
      tools.serverLog(`Reverse geocode failed: ${err}`, "pushLocation-100");
    }

    const address = specsDecode.address ?? {};
    const enrichedLocation = {
      ...jsonDecodeLocation,
      display_name: specsDecode.display_name ?? "unknown",
      neighbourhood: address.neighbourhood ?? "unknown",
      city: address.city ?? "unknown",
      country: address.country ?? "unknown",
      state: address.state ?? "unknown",
      postcode: address.postcode ?? "unknown",
      road: address.road ?? "unknown",
      street: address.street ?? "unknown",
    };
    // geo_meta is a native JSON column -- Drizzle's json() stringifies on
    // write, so pass the object itself here, not a pre-stringified string
    // (that would double-encode it).
    const [result] = await db
      .update(users)
      .set({
        geoMeta: enrichedLocation,
        geoHash: jsonDecodeLocation.geo_hash,
        geoLong: jsonDecodeLocation.long,
        geoLatd: jsonDecodeLocation.latd,
      })
      .where(eq(users.userId, userId));

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "ok";
      response.data = enrichedLocation;
    }
  } catch (err) {
    tools.serverLog(`Error in pushLocation: ${err}`, "pushlocation-101");
    response.code = 500;
    response.message = "Error updating location.";
  }
  return response;
}
