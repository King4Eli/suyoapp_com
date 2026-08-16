import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

const COMMENT_MAX_LENGTH = 500;

/**
 * Add a comment, or a reply when parent_id is set (one level of nesting only --
 * a reply's parent must itself be a top-level comment).
 * @param {{ post_id?: string; text?: string; parent_id?: string }} data
 */
export default async function pushFeedComment(data) {
  /** @type {any} */
  const response = { code: 400, message: "Error posting comment." };

  try {
    const postId = data?.post_id ?? "";
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    const parentId = data?.parent_id || null;

    if (!postId || !text) {
      response.message = "Comment needs a post and some text.";
      return response;
    }
    if (text.length > COMMENT_MAX_LENGTH) {
      response.message = `Comments are limited to ${COMMENT_MAX_LENGTH} characters.`;
      return response;
    }

    /** @type {[any[], any]} */
    const [postRows] = await db_pool.query(
      `SELECT post_id FROM feed_posts WHERE post_id = ? AND post_status = '1'`,
      [postId],
    );
    if (!postRows?.[0]) {
      response.code = 404;
      response.message = "Post not found.";
      return response;
    }

    if (parentId) {
      /** @type {[any[], any]} */
      const [parentRows] = await db_pool.query(
        `SELECT comment_id FROM feed_comments
                 WHERE comment_id = ? AND comment_post_id = ? AND comment_parent_id IS NULL AND comment_status = '1'`,
        [parentId, postId],
      );
      if (!parentRows?.[0]) {
        response.message = "Can't reply to that comment.";
        return response;
      }
    }

    const commentId = tools.generateAlphanumeric(21, 30);
    /** @type {[import('mysql2/promise').ResultSetHeader, any]} */
    const [result] = await db_pool.query(
      `INSERT INTO feed_comments (comment_id, comment_post_id, comment_user_id, comment_parent_id, comment_text)
             VALUES (?, ?, ?, ?, ?)`,
      [commentId, postId, sessions.currentUserID, parentId, text],
    );

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "ok";
      response.commentId = commentId;
      response.dateAdded = Math.floor(Date.now() / 1000);
    }
  } catch (err) {
    tools.serverLog(`Error in pushFeedComment: ${err}`, "pushFeedComment-0");
    response.code = 500;
    response.message = "Error posting comment.";
  }

  return response;
}
