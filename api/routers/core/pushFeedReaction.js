import { and, count, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { feedPosts, feedReactions } from "../../db/schema.js";
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

    const postRows = await db
      .select({ post_user_id: feedPosts.postUserId })
      .from(feedPosts)
      .where(and(eq(feedPosts.postId, postId), eq(feedPosts.postStatus, "1")));
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
      await db
        .delete(feedReactions)
        .where(
          and(
            eq(feedReactions.reactionPostId, postId),
            eq(feedReactions.reactionUserId, sessions.currentUserID),
          ),
        );
    } else {
      await db
        .insert(feedReactions)
        .values({
          reactionPostId: postId,
          reactionUserId: sessions.currentUserID,
          reactionKind: reaction,
        })
        .onDuplicateKeyUpdate({ set: { reactionKind: reaction } });
    }

    const [counts] = await db
      .select({ reaction_count: count() })
      .from(feedReactions)
      .where(eq(feedReactions.reactionPostId, postId));

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
