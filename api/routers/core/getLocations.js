import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { getEntitlements } from "../../global/entitlements.js";
import {
  MAX_SECONDARY_LOCATIONS,
  getSecondaryLocations,
} from "../../global/travelMode.js";

/**
 * The caller's current location, their travel-mode locations, and whether their
 * plan lets them use travel mode -- everything the Location screen shows.
 */
export default async function getLocations() {
  /** @type {any} */
  const response = { code: 400, message: "Error loading locations." };

  try {
    const userId = sessions.currentUserID;
    const [me] = await db
      .select({ geo_meta: users.geoMeta, travel_mode: users.userTravelMode })
      .from(users)
      .where(eq(users.userId, userId));
    if (!me) {
      response.code = 401;
      response.message = "User not found.";
      return response;
    }

    const { features } = await getEntitlements(userId);
    const secondary = await getSecondaryLocations(userId);

    response.code = 200;
    response.message = "ok";
    response.primary = me.geo_meta ?? {};
    response.secondary = secondary.map((loc) => ({
      id: loc.id,
      .../** @type {any} */ (loc.geo_meta ?? {}),
    }));
    response.travel_mode = me.travel_mode === "1";
    response.can_use_travel_mode = features.travelMode;
    response.max_secondary = MAX_SECONDARY_LOCATIONS;
  } catch (err) {
    tools.serverLog(`Error in getLocations: ${err}`, "getLocations-0");
    response.code = 500;
    response.message = "Error loading locations.";
  }

  return response;
}
