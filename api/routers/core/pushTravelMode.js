import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";

/**
 * Turn travel mode on/off. Turning it on needs a plan with travelMode; turning it
 * off is always allowed. (Discovery also re-checks the plan per query, so a lapsed
 * subscription stops travel mode even if this flag is still '1'.)
 * @param {unknown} enabled "1" | "0"
 */
export default async function pushTravelMode(enabled) {
  /** @type {any} */
  const response = { code: 400, message: "Error updating travel mode." };

  try {
    if (enabled !== "1" && enabled !== "0") {
      response.message = "Invalid value.";
      return response;
    }
    const userId = sessions.currentUserID;
    if (enabled === "1" && !(await hasFeature(userId, "travelMode"))) {
      response.code = 403;
      response.message = "Travel mode is a VIP feature.";
      return response;
    }

    await db
      .update(users)
      .set({ userTravelMode: enabled })
      .where(eq(users.userId, userId));

    response.code = 200;
    response.message = "ok";
    response.travel_mode = enabled === "1";
  } catch (err) {
    tools.serverLog(`Error in pushTravelMode: ${err}`, "pushTravelMode-0");
    response.code = 500;
    response.message = "Error updating travel mode.";
  }

  return response;
}
