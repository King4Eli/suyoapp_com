import { sessions, tools } from '../../global/functions.js';
import db_pool from '../../global/database.js';

export default async function getChatsListings() {
    const response = {
        code: 200,
        message: 'ok', 
        chatsListings: {
            withoutmessages: [],
            withmessages: [],
            countLikes: 0,
            imageLikes: null
        }
    };

    const currentUserId = sessions.currentUserID;

    try {
        // 1. Optimized likes query - add index on (match_user_id_to, match_status)
        /** @type any */
        const [likesResult] = await db_pool.query(
            `SELECT usr.user_image 
             FROM matches m
             LEFT JOIN users usr ON usr.user_id = m.match_user_id_from
             WHERE m.match_user_id_to = ? 
               AND m.match_status IN ('0', '5')`,  // Only need first image for preview
            [currentUserId]
        );
        
        response.chatsListings.countLikes = likesResult?.length || 0;
        if (likesResult?.[0]?.user_image) {
            try {
                const images = JSON.parse(likesResult[0].user_image);
                response.chatsListings.imageLikes = images?.[0] || null;
            } catch (e) {
                response.chatsListings.imageLikes = null;
            }
        }

        // 2. Use matches.last_message_id as the source of truth for the latest message.
        /** @type any */
        const [matchesResult] = await db_pool.query(`
            SELECT
                m.match_id,
                m.match_status,
                m.match_dateAdded,
                m.match_user_id_from,
                m.match_user_id_to,
                m.last_message_id,
                other_user.user_id AS other_user_id,
                other_user.user_fullname AS other_user_fullname,
                other_user.user_image AS other_user_image,
                other_user.user_verified AS other_user_verified,
                other_user.user_bio_dob AS other_user_dob,
                latest.convo_id,
                latest.convo_message,
                latest.convo_date_added,
                latest.convo_by_initiator,
                latest.convo_status,
                CASE 
                    WHEN latest.convo_by_initiator = '1' AND m.match_user_id_from = ? THEN 1
                    WHEN latest.convo_by_initiator = '0' AND m.match_user_id_to = ? THEN 1
                    ELSE 0 
                END AS last_message_from_me
            FROM matches m
            INNER JOIN users other_user ON other_user.user_id = 
                CASE 
                    WHEN m.match_user_id_from = ? THEN m.match_user_id_to 
                    ELSE m.match_user_id_from 
                END
            LEFT JOIN conversations latest ON latest.convo_id = m.last_message_id
                AND latest.convo_match_id = m.match_id
                AND latest.convo_status IN ('0', '1')
            WHERE m.match_status = '1'
                AND (m.match_user_id_from = ? OR m.match_user_id_to = ?)
            ORDER BY COALESCE(latest.convo_date_added, m.match_dateAdded) DESC
         `, [
            currentUserId, currentUserId,  // for last_message_from_me
            currentUserId,                  // for users JOIN
            currentUserId, currentUserId    // for WHERE clause
        ]);

        // Process matches without JSON.parse in loop where possible
        for (const row of matchesResult) {
        /** @type any */
            const matchData = {
                match_id: row.match_id,
                chat_with_user_id: row.other_user_id,
                user_fullname: row.other_user_fullname || '',
                user_dob: row.other_user_dob || null,
                user_verified: Number(row.other_user_verified) === 1,
                match_date: row.match_dateAdded,
                last_message_id: row.last_message_id || null,
                user_image: null
            };

            // Parse user image once
            if (row.other_user_image) {
                try {
                    const userImage = JSON.parse(row.other_user_image);
                    matchData.user_image = userImage.length > 0 ? userImage[0] : null;
                } catch (error) {
                    tools.serverLog(`Error parsing user image for match_id ${row.match_id}: ${error}`,'getChatsListings-300');
                }
            }

            // Check if match has messages
            if (row.convo_id && row.convo_message) {
                try {
                    const lastMessage = JSON.parse(row.convo_message);
                    
                    matchData.user_lastmessage = lastMessage;
                    matchData.user_lastmessage_date = row.convo_date_added;
                    matchData.convo_from_me = Boolean(row.last_message_from_me);
                    
                    // Message read status logic
                    if (!matchData.convo_from_me && Number(row.convo_status) === 0) {
                        matchData.last_message_read = false;
                    } else {
                        matchData.last_message_read = true;
                    }
                    
                    // @ts-ignore
                    response.chatsListings.withmessages.push(matchData  );
                } catch (error) {
                    tools.serverLog(`Error parsing last message for match_id ${row.match_id}: ${error}`,'getChatsListings-100');
                    // @ts-ignore
                    response.chatsListings.withoutmessages.push(matchData);
                }
            } else {
                // @ts-ignore
                response.chatsListings.withoutmessages.push(matchData);
            }
        }

        return response;

    } catch (error) {
        tools.serverLog(`Error in getChatsListings: ${error}`,'getChatsListings-200');
        response.code = 500;
        response.message = 'Internal server error';
        return response;
    }
}
