import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
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
            const sql = `UPDATE matches SET match_status = ? WHERE match_id = ?;`;
            const [result] = await db_pool.query(sql, [ku, matchId]);
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
