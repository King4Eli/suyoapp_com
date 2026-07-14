import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
import { getSubscriptionTier } from "../../global/entitlements.js";

/**
 * Recovers a match the caller passed on (match_status '2') where the other user had
 * already liked them (caller is match_user_id_to). Gated purely by subscription tier —
 * Plus/VIP rewind for free, free-tier callers are turned away here and must go through
 * the one-time "buy once to rewind once" purchase flow instead (see rewind_... SKU /
 * router_hook.js, which performs the rewind directly on payment completion).
 * @param {string} matchId
 */
export default async function rewindMatch(matchId) {
    /** @type { any } */
    const response = { code: 400, message: "Unable to rewind this match." };

    if (!matchId) {
        response.message = "Missing matchId.";
        return response;
    }

    try {
        const tier = await getSubscriptionTier(sessions.currentUserID);
        if (tier === "free") {
            response.code = 402;
            response.message = "Subscribe to Plus/VIP for free rewinds, or buy a one-time rewind.";
            return response;
        }

        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.query(
            `UPDATE matches SET match_status = '0' WHERE match_id = ? AND match_user_id_to = ? AND match_status = '2'`,
            [matchId, sessions.currentUserID]
        );
        if (result.affectedRows === 0) {
            response.code = 404;
            response.message = "This match can no longer be rewound.";
            return response;
        }

        response.code = 200;
        response.message = "Match recovered! Say hi.";
    } catch (err) {
        tools.serverLog(`Error in rewindMatch: ${err}`, 'rewindMatch-0');
        response.code = 500;
        response.message = "There has been an unrecognized error.";
    }

    return response;
}
