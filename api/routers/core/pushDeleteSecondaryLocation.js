import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { usersLocations } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Remove one of the caller's travel-mode locations. Not plan-gated, so someone
 * whose VIP lapsed can still clean up.
 * @param {unknown} id users_locations.id_ai
 */
export default async function pushDeleteSecondaryLocation(id) {
  /** @type {any} */
  const response = { code: 400, message: "Error removing location." };

  try {
    const locationId = Number(id);
    if (!Number.isInteger(locationId)) {
      response.message = "Invalid location.";
      return response;
    }

    const [result] = await db
      .delete(usersLocations)
      .where(
        and(
          eq(usersLocations.idAi, locationId),
          eq(usersLocations.userId, sessions.currentUserID),
        ),
      );

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "ok";
    } else {
      response.code = 404;
      response.message = "Location not found.";
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushDeleteSecondaryLocation: ${err}`,
      "pushDeleteSecondaryLocation-0",
    );
    response.code = 500;
    response.message = "Error removing location.";
  }

  return response;
}
