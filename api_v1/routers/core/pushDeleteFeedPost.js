import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

/**
 * Deletes a feed post -- only the original poster may do this. Status-flip only,
 * matching pushDeleteMessage.js's convention; getFeed.js already only returns
 * post_status = '1' rows, so a flagged post silently drops out of every feed.
 * @param {{ post_id?: string }} data
 */
export default async function pushDeleteFeedPost(data) {
  /** @type {any} */
  const response = { code: 404, message: "Post not found." };

  try {
    const postId = data?.post_id ?? "";
    if (!postId) {
      response.code = 400;
      response.message = "Invalid post.";
      return response;
    }

    /** @type {[any[], any]} */
    const [postRows] = await db_pool.query(
      `SELECT post_user_id FROM feed_posts WHERE post_id = ? AND post_status = '1'`,
      [postId],
    );
    const post = postRows?.[0];
    if (!post) {
      return response;
    }
    if (post.post_user_id !== sessions.currentUserID) {
      response.code = 403;
      response.message = "You can only delete your own posts.";
      return response;
    }

    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [result] = await db_pool.query(
      `UPDATE feed_posts SET post_status = '-99' WHERE post_id = ?`,
      [postId],
    );

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "Post deleted.";
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushDeleteFeedPost: ${err}`,
      "pushDeleteFeedPost-0",
    );
    response.code = 500;
    response.message = "Unable to delete post.";
  }

  return response;
}
