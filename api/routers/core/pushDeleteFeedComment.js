import { and, eq, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { feedComments } from "../../db/schema.js";
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

    const rows = await db
      .select({ comment_user_id: feedComments.commentUserId })
      .from(feedComments)
      .where(
        and(
          eq(feedComments.commentId, commentId),
          eq(feedComments.commentStatus, "1"),
        ),
      );
    const comment = rows?.[0];
    if (!comment) return response;
    if (comment.comment_user_id !== sessions.currentUserID) {
      response.code = 403;
      response.message = "You can only delete your own comments.";
      return response;
    }

    const [result] = await db
      .update(feedComments)
      .set({ commentStatus: "-99" })
      .where(
        or(
          eq(feedComments.commentId, commentId),
          eq(feedComments.commentParentId, commentId),
        ),
      );

    if (result.affectedRows > 0) {
      response.code = 200;
      response.message = "Comment deleted.";
    }
  } catch (err) {
    tools.serverLog(
      `Error in pushDeleteFeedComment: ${err}`,
      "pushDeleteFeedComment-0",
    );
    response.code = 500;
    response.message = "Unable to delete comment.";
  }

  return response;
}
