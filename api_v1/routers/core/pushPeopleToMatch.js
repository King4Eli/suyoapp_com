import db_pool from "../../global/database.js";
import { namer, sessions, tools } from "../../global/functions.js";
import { checkRateLimit } from "../../global/rateLimit.js";
import { getSubscriptionTier, spendRose, FREE_LIKE_DAILY_LIMIT, FREE_LIKE_WINDOW_SECONDS } from "../../global/entitlements.js";

/**
 * Tells the recipient's socket room about a new like/match so their app can toast it
 * immediately, without polling or reopening the screen. Best-effort: failures here must
 * never fail the underlying like/match write, which is why every error is swallowed.
 * @param {import("socket.io").Server | undefined} io
 * @param {string} recipientUserId
 * @param {'new-like' | 'new-match'} event
 * @param {Record<string, any>} extra
 */
async function notifyUser(io, recipientUserId, event, extra) {
    if (!io || !recipientUserId) return;
    try {
        /** @type {[any[], any]} */
        const [rows] = await db_pool.query(
            `SELECT user_fullname, user_image FROM users WHERE user_id = ? LIMIT 1`,
            [sessions.currentUserID]
        );
        const actor = rows?.[0];
        if (!actor) return;

        let firstPhoto = null;
        try {
            const images = JSON.parse(actor.user_image ?? "[]");
            firstPhoto = images?.[0]?.p ?? null;
        } catch { }

        io.to(`user-${recipientUserId}`).emit(event, {
            fromUserId: sessions.currentUserID,
            fromUserName: actor.user_fullname,
            fromUserPhoto: firstPhoto,
            timestamp: new Date().toISOString(),
            ...extra,
        });
    } catch (err) {
        tools.serverLog(`Error notifying user ${recipientUserId} of ${event}: ${err}`, 'pushPeopleToMatch-2');
    }
}

/**
 * @param {{ user_id2: any; match_status: any; matchId: any; }} data
 * @param {import("socket.io").Server} [io]
 */
export default async function pushPeopleToMatch(data, io) {
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
            const tier = await getSubscriptionTier(sessions.currentUserID ?? "-");
            if (tier === "free") {
                const limitCheck = await checkRateLimit(
                    `${namer.ratelimit.likes_daily}${sessions.currentUserID}`,
                    FREE_LIKE_DAILY_LIMIT,
                    FREE_LIKE_WINDOW_SECONDS
                );
                if (!limitCheck.allowed) {
                    response.code = 429;
                    response.message = "You've reached today's FREE limit.\nUpgrade to get unlimited likes and features.";
                    response.retryAfterSeconds = limitCheck.retryAfterSeconds;
                    response.likesRemainingToday = 0;
                    return response;
                }
                response.likesRemainingToday = Math.max(0, FREE_LIKE_DAILY_LIMIT - limitCheck.count);
            }
        }

        if (matchStatus === "5") {
            const roseResult = await spendRose(sessions?.currentUserID ?? "-");
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
                if (matchStatus === "0" || matchStatus === "5") {
                    notifyUser(io, secondUserId, "new-like", { matchId: genChatId, isSuperlike: matchStatus === "5" });
                }
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
            // The current caller already sees "It's a match!" locally -- only the other
            // party (who liked first and has been waiting) needs a real-time nudge.
            if (ifUsersMatched) {
                notifyUser(io, secondUserId, "new-match", { matchId });
            }
        }
    }
    catch (err) {
        tools.serverLog(`Error in pushPeopleToMatch: ${err}`,'pushPeopleToMatch-1');
        response.code = 500;
        response.message = "There has been an unrecognized error.";
    }
    return response;
}
