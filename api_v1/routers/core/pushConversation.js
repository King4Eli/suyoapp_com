import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
 
// @ts-ignore
export default async function pushConversation({ match_id, messagee, file_meta }) {
    const response = {
        code: 404,
        message: "no message sent.",
    };
    const matchId = match_id?.trim();
    const messageText = messagee?.trim() ?? "";
    const mediaFiles = file_meta || [];
    if (!matchId || !sessions.currentUserID) {
        return response;
    }
    /** @type { any } */
    const groupedMedia = {
        image: [],
        video: [],
        audio: []
    };
    // Process uploaded media files
    if (mediaFiles.length > 0) {
        mediaFiles.forEach((/** @type {{ url: string; w: any; h: any; size: any; d: any; path: string; }} */ file) => {
            // Determine media type based on file properties or URL
            let mediaType = "image"; // Default to image
            if (file.url.includes('/img/') ||
                file.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                mediaType = "image";
            }
            else if (file.url.includes('/video/') ||
                file.url.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i)) {
                mediaType = "video";
            }
            else if (file.url.includes('/audio/') ||
                file.url.match(/\.(mp3|wav|m4a|aac|ogg|flac|mp4)$/i)) {
                mediaType = "audio";
            } 
            groupedMedia[mediaType].push({
                p: file.url,
                w: file.w || null,
                h: file.h || null,
                size: file.size || null,
                d: file.d || null,
                original: file.path.split('/').pop() || null,
            });
        });
    }
    const outgoingMessages = [];
    // Create text message if exists
    if (messageText.length > 0) {
        outgoingMessages.push({
            id: tools.generateAlphanumeric(19, 30),
            payload: {
                t: "text",
                str: messageText,
            }
        });
    }
    // Create media messages for each type
    ["image", "video", "audio"].forEach((type) => {

        if (groupedMedia[type].length > 0) {
            outgoingMessages.push({
                id: tools.generateAlphanumeric(19, 30),
                payload: {
                    t: type,
                    src: groupedMedia[type],
                }
            });
        }
    });
    try {
        if (outgoingMessages.length === 0) {
            response.message = "Empty message.";
            return response;
        }
        const sql = `
            INSERT INTO conversations
            (convo_id, convo_match_id, convo_message, convo_by_initiator)
            VALUES (
                ?,
                ?,
                ?,
                (
                    SELECT CASE
                        WHEN match_user_id_from = ? THEN '1'
                        ELSE '0'
                    END
                    FROM matches
                    WHERE match_id = ?
                )
            )
        `;
        let inserted = 0;
        for (const message of outgoingMessages) {
            const chattingMessage = JSON.stringify(message.payload);
            /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
            const [result] = await db_pool.execute(sql, [
                message.id,
                matchId,
                chattingMessage,
                sessions.currentUserID,
                matchId,
            ]); 
            inserted += result?.affectedRows ? Number(result.affectedRows) : 0;
            // Update last_message_id in matches table for this match
            if (result?.affectedRows > 0) {
                await db_pool.execute("UPDATE `matches` SET `last_message_id` = ? , `match_dateUpdated`=UNIX_TIMESTAMP() WHERE `matches`.`match_id` = ?;", [
                    message.id,
                    matchId, 
                ]); 
            }
        
        }
        response.code = inserted > 0 ? 200 : 404;
        response.message = inserted > 0 ? "Message sent successfully." : "Error sending message.";
    }
    catch (err) {
        tools.serverLog(`Error in pushConversation: ${err}`,"pushConversation-100");
        response.code = 500;
        // @ts-ignore
        response.message = err.message || "There has been an unrecognized error.";
    }
    return response;
}
