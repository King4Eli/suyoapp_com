import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { matches } from "../../db/schema.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import { hasFeature } from "../../global/entitlements.js";

/**
 * Undo a pass on someone who had liked the caller, putting their like back to
 * pending so the caller can like back. Free for plans with `freeRewind`; free-tier
 * users buy a one-time rewind instead, which the payment webhook applies with the
 * same UPDATE (router_hook.js, category "rewind").
 * @param {{ matchId?: string }} data
 */
export default async function pushRewindMatch(data) {
  /** @type {any} */
  const response = { code: 400, message: "Missing match." };
  try {
    const matchId = data?.matchId;
    if (!matchId) return response;

    if (!(await hasFeature(sessions.currentUserID, "freeRewind"))) {
      response.code = 403;
      response.message = "Subscribe to rewind missed matches.";
      response.upgradeRequired = true;
      return response;
    }

    const [result] = await db
      .update(matches)
      .set({ matchStatus: "0" })
      .where(
        and(
          eq(matches.matchId, matchId),
          eq(matches.matchUserIdTo, sessions.currentUserID),
          eq(matches.matchStatus, "2"),
        ),
      );
    if (result.affectedRows === 0) {
      response.code = 409;
      response.message = "This match can't be rewound.";
      return response;
    }
    response.code = 200;
    response.message = "Match rewound";
  } catch (err) {
    tools.serverLog(`Error in pushRewindMatch: ${err}`, "pushRewindMatch-1");
    response.code = 500;
    response.message = "There has been an unrecognized error.";
  }
  return response;
}
