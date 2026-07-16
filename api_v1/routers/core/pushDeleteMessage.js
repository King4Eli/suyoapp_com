import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Deletes a message "for everyone" -- only the original sender may do this.
 * Status-flip only -- the original convo_message is left untouched at rest.
 * getConversation.js/getChatLists.js are what withhold the real content from
 * API responses once a row is flagged deleted; nothing here rewrites it.
 * @param {string} convoId
 * @param {import("socket.io").Server} [io]
 */
export default async function pushDeleteMessage(convoId, io) {
    const response = { code: 404, message: "Message not found or no access." };
    convoId = convoId?.trim();
    if (!convoId || !sessions.currentUserID) {
        return response;
    }

    try {
        const [rows] = await db_pool.execute(
            `SELECT c.convo_match_id, c.convo_by_initiator, m.match_user_id_from
             FROM conversations c
             INNER JOIN matches m ON m.match_id = c.convo_match_id
             WHERE c.convo_id = ? AND c.convo_status IN ('0','1')`,
            [convoId]
        );
        // @ts-ignore
        const row = rows?.[0];
        if (!row) {
            return response;
        }

        const isSender = (row.match_user_id_from === sessions.currentUserID && row.convo_by_initiator === '1') ||
            (row.match_user_id_from !== sessions.currentUserID && row.convo_by_initiator === '0');
        if (!isSender) {
            response.code = 403;
            response.message = "You can only delete your own messages.";
            return response;
        }

        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.execute(
            `UPDATE conversations SET convo_status = '-99' WHERE convo_id = ?`,
            [convoId]
        );

        if (result.affectedRows > 0) {
            if (io) {
                io.to(`match-${row.convo_match_id}`).emit('message-deleted', {
                    matchId: row.convo_match_id,
                    convoId,
                });
            }
            response.code = 200;
            response.message = "Message deleted.";
        }
    } catch (err) {
        tools.serverLog(`Error in pushDeleteMessage: ${err}`, "pushDeleteMessage-0");
        response.code = 500;
        // @ts-ignore
        response.message = err?.message || "Unable to delete message.";
    }

    return response;
}
