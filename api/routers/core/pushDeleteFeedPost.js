import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { feedPosts } from "../../db/schema.js";
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

    const postRows = await db
      .select({ post_user_id: feedPosts.postUserId })
      .from(feedPosts)
      .where(and(eq(feedPosts.postId, postId), eq(feedPosts.postStatus, "1")));
    const post = postRows?.[0];
    if (!post) {
      return response;
    }
    if (post.post_user_id !== sessions.currentUserID) {
      response.code = 403;
      response.message = "You can only delete your own posts.";
      return response;
    }

    const [result] = await db
      .update(feedPosts)
      .set({ postStatus: "-99" })
      .where(eq(feedPosts.postId, postId));

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
