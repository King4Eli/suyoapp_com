import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { feedComments, feedPosts } from "../../db/schema.js";
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

    const postRows = await db
      .select({ post_id: feedPosts.postId })
      .from(feedPosts)
      .where(and(eq(feedPosts.postId, postId), eq(feedPosts.postStatus, "1")));
    if (!postRows?.[0]) {
      response.code = 404;
      response.message = "Post not found.";
      return response;
    }

    if (parentId) {
      const parentRows = await db
        .select({ comment_id: feedComments.commentId })
        .from(feedComments)
        .where(
          and(
            eq(feedComments.commentId, parentId),
            eq(feedComments.commentPostId, postId),
            isNull(feedComments.commentParentId),
            eq(feedComments.commentStatus, "1"),
          ),
        );
      if (!parentRows?.[0]) {
        response.message = "Can't reply to that comment.";
        return response;
      }
    }

    const commentId = tools.generateAlphanumeric(21, 30);
    const [result] = await db.insert(feedComments).values({
      commentId,
      commentPostId: postId,
      commentUserId: sessions.currentUserID,
      commentParentId: parentId,
      commentText: text,
    });

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
