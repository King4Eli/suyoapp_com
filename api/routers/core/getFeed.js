import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { feedPosts, users } from "../../db/schema.js";
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

    const rows = await db
      .select({
        post_id: feedPosts.postId,
        post_user_id: feedPosts.postUserId,
        post_caption: feedPosts.postCaption,
        post_media: feedPosts.postMedia,
        post_dateAdded: feedPosts.postDateAdded,
        user_fullname: users.userFullname,
        user_image: users.userImage,
        user_verified: users.userVerified,
        reaction_count:
          sql`(SELECT COUNT(*) FROM feed_reactions fr WHERE fr.reaction_post_id = ${feedPosts.postId})`.mapWith(
            Number,
          ),
        viewer_reaction: sql`(
          SELECT fr2.reaction_kind FROM feed_reactions fr2
          WHERE fr2.reaction_post_id = ${feedPosts.postId} AND fr2.reaction_user_id = ${sessions.currentUserID}
        )`,
        comment_count:
          sql`(SELECT COUNT(*) FROM feed_comments fc WHERE fc.comment_post_id = ${feedPosts.postId} AND fc.comment_status = '1')`.mapWith(
            Number,
          ),
      })
      .from(feedPosts)
      .innerJoin(users, eq(users.userId, feedPosts.postUserId))
      .where(
        and(
          eq(feedPosts.postStatus, "1"),
          onlyMine
            ? eq(feedPosts.postUserId, sessions.currentUserID)
            : ne(feedPosts.postUserId, sessions.currentUserID),
          hasCursor ? lt(feedPosts.postDateAdded, cursor) : undefined,
        ),
      )
      .orderBy(desc(feedPosts.postDateAdded), desc(feedPosts.postId))
      .limit(FEED_PAGE_SIZE);

    if (Array.isArray(rows) && rows.length > 0) {
      rows.forEach((post) => {
        post.user_image = JSON.parse(post.user_image ?? "[]");
        post.post_media = post.post_media ?? [];
        post.viewer_reaction = post.viewer_reaction ?? null;
        post.reaction_count = Number(post.reaction_count);
        post.comment_count = Number(post.comment_count);
        post.user_verified = Number(post.user_verified);
      });
      response.code = 200;
      response.message = "ok";
      response.feedPosts = rows;
      response.nextCursor =
        rows.length === FEED_PAGE_SIZE
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
