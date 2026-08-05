import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Deletes a comment (and its replies, via ON DELETE CASCADE) -- only the
 * commenter may do this. Status-flip only, matching pushDeleteFeedPost.js.
 * @param {{ comment_id?: string }} data
 */
export default async function pushDeleteFeedComment(data) {
    /** @type {any} */
    const response = { code: 404, message: "Comment not found." };

    try {
        const commentId = data?.comment_id ?? "";
        if (!commentId) {
            response.code = 400;
            response.message = "Invalid comment.";
            return response;
        }

        /** @type {[any[], any]} */
        const [rows] = await db_pool.query(
            `SELECT comment_user_id FROM feed_comments WHERE comment_id = ? AND comment_status = '1'`,
            [commentId]
        );
        const comment = rows?.[0];
        if (!comment) return response;
        if (comment.comment_user_id !== sessions.currentUserID) {
            response.code = 403;
            response.message = "You can only delete your own comments.";
            return response;
        }

        /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
        const [result] = await db_pool.query(
            `UPDATE feed_comments SET comment_status = '-99' WHERE comment_id = ? OR comment_parent_id = ?`,
            [commentId, commentId]
        );

        if (result.affectedRows > 0) {
            response.code = 200;
            response.message = "Comment deleted.";
        }
    } catch (err) {
        tools.serverLog(`Error in pushDeleteFeedComment: ${err}`, "pushDeleteFeedComment-0");
        response.code = 500;
        response.message = "Unable to delete comment.";
    }

    return response;
}
