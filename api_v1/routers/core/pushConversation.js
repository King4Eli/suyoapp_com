import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
 
/**
 * @param {{ match_id: string, messagee?: string, file_meta?: any[] }} args
 * @param {import("socket.io").Server} [io]
 */
// @ts-ignore
export default async function pushConversation({ match_id, messagee, file_meta }, io) {
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

    // Only participants of an active (not blocked/reported/declined) match may send messages.
    // match_status: 0=waiting,1=match,2=notinterested,3=block,4=reported,5=superlike
    const [matchRows] = await db_pool.execute(
        "SELECT match_status, match_user_id_from, match_user_id_to FROM matches WHERE match_id = ? AND (match_user_id_from = ? OR match_user_id_to = ?)",
        [matchId, sessions.currentUserID, sessions.currentUserID]
    );
    // @ts-ignore
    if (matchRows.length === 0) {
        response.code = 404;
        response.message = "Match not found or no access.";
        return response;
    }
    const blockedStatuses = ["2", "3", "4"];
    // @ts-ignore
    if (blockedStatuses.includes(String(matchRows[0].match_status))) {
        response.code = 403;
        response.message = "This match can no longer receive messages.";
        return response;
    }
    // @ts-ignore
    const matchRow = matchRows[0];
    const recipientID = String(matchRow.match_user_id_from) === String(sessions.currentUserID)
        ? matchRow.match_user_id_to
        : matchRow.match_user_id_from;

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
        const insertedConvoIds = [];
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
                insertedConvoIds.push(message.id);
            }

        }
        response.code = inserted > 0 ? 200 : 404;
        response.message = inserted > 0 ? "Message sent successfully." : "Error sending message.";

        // If the recipient already has a live socket in this match's room (i.e. they're
        // actively looking at this same conversation right now), the message they just
        // received counts as read immediately -- no need to wait for them to re-fetch
        // the conversation. Mirrors the mark-as-read + broadcast getConversation.js does,
        // so the sender's bubble flips to "read" in realtime without any client polling.
        if (io && insertedConvoIds.length > 0) {
            try {
                const roomName = `match-${matchId}`;
                const socketsInRoom = await io.in(roomName).fetchSockets();
                const recipientPresent = socketsInRoom.some((s) => String(s.data.userID) === String(recipientID));
                if (recipientPresent) {
                    const placeholders = insertedConvoIds.map(() => '?').join(',');
                    await db_pool.query(
                        `UPDATE conversations SET convo_status = '1' WHERE convo_id IN (${placeholders}) AND convo_status = '0'`,
                        insertedConvoIds
                    );
                    io.to(roomName).emit('messages-read', { matchId, readByUserId: recipientID });
                }
            } catch (error) {
                tools.serverLog(`Error marking live-recipient messages as read for match_id ${matchId}: ${error}`, 'pushConversation-200');
            }
        }
    }
    catch (err) {
        tools.serverLog(`Error in pushConversation: ${err}`,"pushConversation-100");
        response.code = 500;
        // @ts-ignore
        response.message = err.message || "There has been an unrecognized error.";
    }
    return response;
}
