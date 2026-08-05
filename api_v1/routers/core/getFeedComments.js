import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";

const COMMENTS_MAX = 200;

/**
 * All comments + replies for a post, flat (one level of nesting -- frontend groups
 * by comment_parent_id). No pagination for v1; feed posts don't see comment volume
 * that would need it yet.
 * @param {{ post_id?: string }} [params]
 */
export default async function getFeedComments(params) {
    /** @type {any} */
    const response = { code: 400, message: "Invalid post." };

    try {
        const postId = params?.post_id ?? "";
        if (!postId) return response;

        /** @type {[any[], any]} */
        const [rows] = await db_pool.query(
            `SELECT
                fc.comment_id, fc.comment_parent_id, fc.comment_user_id, fc.comment_text, fc.comment_dateAdded,
                u.user_fullname, u.user_image
             FROM feed_comments fc
             INNER JOIN users u ON u.user_id = fc.comment_user_id
             WHERE fc.comment_post_id = ? AND fc.comment_status = '1'
             ORDER BY fc.comment_dateAdded ASC
             LIMIT ${COMMENTS_MAX}`,
            [postId]
        );

        rows.forEach((row) => {
            row.user_image = JSON.parse(row.user_image ?? "[]");
        });

        response.code = 200;
        response.message = "ok";
        response.comments = rows;
    } catch (err) {
        tools.serverLog(`Error in getFeedComments: ${err}`, "getFeedComments-0");
        response.code = 500;
        response.message = "Database error.";
    }

    return response;
}
