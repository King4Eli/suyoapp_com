import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * @param {string} matchId
 */
export default async function getConversation(matchId) {
    matchId = matchId?.trim() || 'ERRNAME';

    const sql = `SELECT 
        m.match_id,
        m.match_status,
        m.match_dateAdded AS match_date,
        u.user_id AS other_user_id,
        u.user_fullname AS other_user_fullname,
        u.user_image AS other_user_image,
        u.geo_meta AS geo_meta,
        u.user_verified AS other_user_verified,
        c.convo_id,
        c.convo_message,
        c.convo_by_initiator,
        c.convo_status,
        c.convo_date_added,
        c.convo_date_updated,
        m.match_user_id_from,
        CASE 
            WHEN m.match_user_id_from = ? THEN 1
            ELSE 0 
        END AS is_from_me
    FROM matches m
    INNER JOIN users u ON (
        u.user_id = CASE 
            WHEN m.match_user_id_from = ? THEN m.match_user_id_to 
            ELSE m.match_user_id_from 
        END
    )
    LEFT JOIN conversations c ON c.convo_match_id = m.match_id 
        AND c.convo_status IN ('0','1')
    WHERE m.match_id = ?
        AND (m.match_user_id_from = ? OR m.match_user_id_to = ?)
    ORDER BY c.convo_date_added ASC;
    `;

    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [rows] = await db_pool.query(sql, [
        sessions.currentUserID,  // for is_from_me CASE
        sessions.currentUserID,  // for users JOIN CASE
        matchId,                 // for WHERE m.match_id
        sessions.currentUserID,  // for WHERE user access check 1
        sessions.currentUserID   // for WHERE user access check 2
    ]);

    /** @type { any } */
    const response = {
        code: 200,
        message: 'No conversation found.',
        chatsMessageListings: [],
        u2deets: null,
        convostarter: [],
    };

    // If no rows returned, either match doesn't exist or user doesn't have access
    if (!Array.isArray(rows) || rows.length === 0) {
        response.code = 404;
        response.message = 'Match not found or no access';
        return response;
    }

    const messages = [];
    let user2Details = null;
    /** @type {string[]} */
    const randomConvoStarter = [];
    // Variables to track the last message for update
    let fromMe;
    let lastMessageId = null;
    let lastMessageFromMe = false;
    let lastMessageStatus = null;

    // Get user details from the first row (will exist even if no conversations)
    if (rows[0]) {
        const row = rows[0];
        try {
            const userImage = row.other_user_image ? JSON.parse(row.other_user_image) : [];
            const geo_meta = (row.geo_meta ??  {} );

            user2Details = {
                fullname: row.other_user_fullname || '',
                image: userImage.length > 0 ? userImage[0] : null,
                verified: Boolean(row.other_user_verified),
                uid: row.other_user_id || '',
                city: geo_meta?.city || null,
            };
        } catch (error) { 
            tools.serverLog(`Error parsing user data for match_id ${row.match_id}: ${error}`,"getConversation-100");
            user2Details = {
                fullname: row.other_user_fullname || '',
                image: null,
                verified: false,
                uid: row.other_user_id || '',
                city: null,
            };
        }
    }

    // Process conversations (if any)
    for (const row of rows) {
        // Skip rows where convo_id is null (these are from the LEFT JOIN when no conversations)
        if (!row.convo_id) {
            continue;
        }

        try {
            const convo = row.convo_message ? JSON.parse(row.convo_message) : {};
            if (convo?.t) {
                fromMe = (row.match_user_id_from === sessions.currentUserID) && (Number(row.convo_by_initiator) === 1) ||
                    (row.match_user_id_from !== sessions.currentUserID) && (Number(row.convo_by_initiator) === 0);
                messages.push({
                    messageId: row.convo_id,
                    fromMe,
                    type: convo.t,
                    message: convo.str ?? null,
                    src: convo.src ?? null,
                    dateAdded: row.convo_date_added ?? null,
                });
                // Track the last message (messages are ordered ASC, so last one wins)
                lastMessageId = row.convo_id;
                lastMessageFromMe = fromMe;
                lastMessageStatus = row.convo_status;
            }
        } catch (error) {
             tools.serverLog(`Error parsing conversation message for convo_id ${row.convo_id}: ${error}`,"getConversation-200");
        }
    }

    // UPDATE: Mark last message as read if it's not from me and is currently unread
    if (lastMessageId && !lastMessageFromMe && lastMessageStatus === '0') {
        try {
            const updateSql = `UPDATE conversations SET convo_status = '1' WHERE convo_id = ?`;
            await db_pool.query(updateSql, [lastMessageId]);
        } catch (error) {
            tools.serverLog(`Error updating message status for convo_id ${lastMessageId}: ${error}`,'getConversation-300');
        }
    }
    response.code = 200;
    response.message = messages.length > 0 ? 'ok' : 'No messages yet';
    response.u2deets = user2Details;
    response.chatsMessageListings = messages;
    response.convostarter = randomConvoStarter;

    return response;
}
