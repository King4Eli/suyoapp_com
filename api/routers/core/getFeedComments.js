import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { feedComments, users } from "../../db/schema.js";
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

    const rows = await db
      .select({
        comment_id: feedComments.commentId,
        comment_parent_id: feedComments.commentParentId,
        comment_user_id: feedComments.commentUserId,
        comment_text: feedComments.commentText,
        comment_dateAdded: feedComments.commentDateAdded,
        user_fullname: users.userFullname,
        user_image: users.userImage,
      })
      .from(feedComments)
      .innerJoin(users, eq(users.userId, feedComments.commentUserId))
      .where(
        and(
          eq(feedComments.commentPostId, postId),
          eq(feedComments.commentStatus, "1"),
        ),
      )
      .orderBy(asc(feedComments.commentDateAdded))
      .limit(COMMENTS_MAX);

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
