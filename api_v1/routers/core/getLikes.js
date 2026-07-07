import db_pool from "../../global/database.js";
import { sessions, tools } from "../../global/functions.js";
export default async function getLikes() {
    /** @type { any } */
    const response = { code: 404, message: "No likes found." };
    const sql = `
        SELECT m.match_id, m.match_user_id_from, m.match_dateAdded, m.match_status, u.*
        FROM matches m
        INNER JOIN users u ON m.match_user_id_from = u.user_id
        WHERE m.match_user_id_to = ? AND m.match_status IN ('0','5')
        ORDER BY (m.match_status = '5') DESC, m.match_dateAdded DESC
    `;
    try {
        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [rows] = await db_pool.query(sql, [sessions.currentUserID]);
        // @ts-ignore
        const likedList = rows.map(row => ({
            likedUserId: row.match_user_id_from,
            likedUserDate: row.match_dateAdded,
            likedUserImages: row.user_image ? JSON.parse(row.user_image)[0] ?? "" : "",
            likedUserFullname: row.user_fullname,
            likedUserDob: row.user_bio_dob,
            likedMatchedId: row.match_id,
            match_status: Number(row.match_status ?? 0),
            is_superlike: Number(row.match_status ?? 0) === 5,
            verified: Number(row.user_verified ?? 0) === 1
        }));
        response.code = 200;
        response.message = "ok";
        response.likedlist = likedList;
    }
    catch (err) {
        tools.serverLog(`Error in getLikes: ${err}`,"getLikes-100");
        response.code = 500;
        response.message = "Database error.";
    }
    return response;
}
