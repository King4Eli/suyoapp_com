import db_pool from "../../global/database.js";
import { tools } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";

const REACTION_KINDS = new Set([
  "like",
  "love",
  "haha",
  "wow",
  "celebrate",
  "support",
]);

/**
 * React/change-reaction/un-react to a feed post. One reaction per viewer per post --
 * picking a new kind overwrites the previous one rather than stacking.
 * @param {{ post_id?: string; reaction?: string }} data
 */
export default async function pushFeedReaction(data) {
  /** @type {any} */
  const response = {
    code: 400,
    message: "Error processing reaction.",
  };

  try {
    const postId = data?.post_id ?? "";
    const reaction = data?.reaction ?? "";

    if (!postId || (reaction !== "remove" && !REACTION_KINDS.has(reaction))) {
      response.message = "Invalid post or reaction.";
      return response;
    }

    /** @type {[any[], any]} */
    const [postRows] = await db_pool.query(
      `SELECT post_user_id FROM feed_posts WHERE post_id = ? AND post_status = '1'`,
      [postId],
    );
    const post = postRows?.[0];
    if (!post) {
      response.code = 404;
      response.message = "Post not found.";
      return response;
    }
    if (post.post_user_id === sessions.currentUserID) {
      response.code = 400;
      response.message = "You can't react to your own post.";
      return response;
    }

    if (reaction === "remove") {
      await db_pool.query(
        `DELETE FROM feed_reactions WHERE reaction_post_id = ? AND reaction_user_id = ?`,
        [postId, sessions.currentUserID],
      );
    } else {
      await db_pool.query(
        `INSERT INTO feed_reactions (reaction_post_id, reaction_user_id, reaction_kind)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE reaction_kind = VALUES(reaction_kind)`,
        [postId, sessions.currentUserID, reaction],
      );
    }

    /** @type {[any[], any]} */
    const [[counts]] = await db_pool.query(
      `SELECT COUNT(*) AS reaction_count FROM feed_reactions WHERE reaction_post_id = ?`,
      [postId],
    );

    response.code = 200;
    response.message = "ok";
    response.reactionCount = Number(counts?.reaction_count ?? 0);
    response.viewerReaction = reaction === "remove" ? null : reaction;
    response.postUserId = post.post_user_id;
  } catch (err) {
    tools.serverLog(`Error in pushFeedReaction: ${err}`, "pushFeedReaction-1");
    response.code = 500;
    response.message = "There has been an unrecognized error.";
  }

  return response;
}
