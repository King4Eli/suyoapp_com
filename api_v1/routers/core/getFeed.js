import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

const FEED_PAGE_SIZE = 20;

/**
 * Cursor-paginated dating-profile feed for the current viewer.
 * @param {{ cursor?: number; onlyMine?: boolean }} [params]
 */
export default async function getFeed(params) {
    /** @type {any} */
    const response = {
        code: 404,
        message: "No feed posts available right now.",
    };

    try {
        const cursor = Number(params?.cursor);
        const hasCursor = Number.isFinite(cursor) && cursor > 0;
        const onlyMine = params?.onlyMine === true;

        const sql = `
      SELECT
        fp.post_id, fp.post_user_id, fp.post_caption, fp.post_media, fp.post_dateAdded,
        u.user_fullname, u.user_image, u.user_verified,
        (SELECT COUNT(*) FROM feed_reactions fr WHERE fr.reaction_post_id = fp.post_id) AS like_count,
        EXISTS(
          SELECT 1 FROM feed_reactions fr2
          WHERE fr2.reaction_post_id = fp.post_id AND fr2.reaction_user_id = ?
        ) AS viewer_has_liked
      FROM feed_posts fp
      INNER JOIN users u ON u.user_id = fp.post_user_id
      WHERE fp.post_status = '1'
        AND fp.post_user_id ${onlyMine ? '=' : '!='} ?
        ${hasCursor ? "AND fp.post_dateAdded < ?" : ""}
      ORDER BY fp.post_dateAdded DESC, fp.post_id DESC
      LIMIT ${FEED_PAGE_SIZE}
    `;

        const queryParams = [
            sessions.currentUserID,
            sessions.currentUserID,
            ...(hasCursor ? [cursor] : []),
        ];

        /** @type {[any[], any]} */
        const [rows] = await db_pool.query(sql, queryParams);

        if (Array.isArray(rows) && rows.length > 0) {
            rows.forEach((post) => {
                post.user_image = JSON.parse(post.user_image ?? "[]");
                post.post_media = post.post_media ?? [];
                post.viewer_has_liked = Boolean(post.viewer_has_liked);
                post.like_count = Number(post.like_count);
                post.user_verified = Number(post.user_verified);
            });
            response.code = 200;
            response.message = "ok";
            response.feedPosts = rows;
            response.nextCursor = rows.length === FEED_PAGE_SIZE
                ? rows[rows.length - 1].post_dateAdded
                : null;
        } else {
            response.code = 200;
            response.message = "ok";
            response.feedPosts = [];
            response.nextCursor = null;
        }
    } catch (err) {
        tools.serverLog(`Error in getFeed: ${err}`, "getFeed-0");
        response.code = 500;
        response.message = "Database error.";
    }

    return response;
}
