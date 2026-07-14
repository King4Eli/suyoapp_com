import db_pool from "../../global/database.js";
import { namer, sessions, tools } from "../../global/functions.js";
import { checkRateLimit } from "../../global/rateLimit.js";
import { getSubscriptionTier, spendRose } from "../../global/entitlements.js";

const FREE_LIKE_LIMIT = 20;
const FREE_LIKE_WINDOW_SECONDS = 24 * 60 * 60; // 24HRS

/**
 * @param {{ user_id2: any; match_status: any; matchId: any; }} data
 */
export default async function pushPeopleToMatch(data) {
    /** @type { any } */
    const response = {
        code: 400,
        message: "Error processing match."
    };
    try {
        const secondUserId = data.user_id2?.toLowerCase() ?? "";
        const matchStatus = data.match_status != null ? String(data.match_status) : "0";
        const matchId = data.matchId ?? "";

        if (matchStatus === "0") {
            const tier = await getSubscriptionTier(sessions.currentUserID);
            if (tier === "free") {
                const limitCheck = await checkRateLimit(
                    `${namer.ratelimit.likes_daily}${sessions.currentUserID}`,
                    FREE_LIKE_LIMIT,
                    FREE_LIKE_WINDOW_SECONDS
                );
                if (!limitCheck.allowed) {
                    response.code = 429;
                    response.message = "You've reached today's FREE limit.\nUpgrade to get unlimited likes and features.";
                    response.retryAfterSeconds = limitCheck.retryAfterSeconds;
                    response.likesRemainingToday = 0;
                    return response;
                }
                response.likesRemainingToday = Math.max(0, FREE_LIKE_LIMIT - limitCheck.count);
            }
        }

        if (matchStatus === "5") {
            const roseResult = await spendRose(sessions.currentUserID);
            if (!roseResult.spent) {
                response.code = 402;
                response.message = "You're out of roses. Buy more to keep sending super likes.";
                response.rosesRemainingToday = 0;
                return response;
            }
            response.rosesRemainingToday = roseResult.remainingToday;
            if (roseResult.source === 'balance') response.roseBalance = roseResult.balance;
        }

        if (!matchId) {
            // Insert new match
            const genChatId = tools.generateAlphanumeric(21, 30);
            const sql = `
        INSERT INTO matches (match_id, match_user_id_from, match_user_id_to, match_status)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE match_status = ?;
      `;
            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query(sql, [
                genChatId,
                sessions.currentUserID,
                secondUserId,
                matchStatus,
                matchStatus,
            ]);
            if (result.affectedRows > 0) {
                response.code = 200;
                response.message = "Wait for them to match you back";
            }
        }
        else {
            // Update existing match
            const ku = (matchStatus === "0" || matchStatus === "5") ? "1" : matchStatus;
            const sql = `UPDATE matches SET match_status = ? WHERE match_id = ? AND (match_user_id_from = ? OR match_user_id_to = ?);`;
            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.query(sql, [ku, matchId, sessions.currentUserID, sessions.currentUserID]);
            if (result.affectedRows === 0) {
                response.code = 404;
                response.message = "Match not found or no access.";
                return response;
            }
            const ifUsersMatched = matchStatus === "1" || matchStatus === "0";
            response.code = 200;
            response.itisamatch = ifUsersMatched;
            response.message = ifUsersMatched
                ? "Hurray! you matched with someone."
                : "User blocked";
        }
    }
    catch (err) {
        tools.serverLog(`Error in pushPeopleToMatch: ${err}`,'pushPeopleToMatch-1');
        response.code = 500;
        response.message = "There has been an unrecognized error.";
    }
    return response;
}
